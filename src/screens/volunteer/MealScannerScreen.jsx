import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: '🥐' },
  { key: 'lunch',     label: 'Lunch',     icon: '🥗' },
  { key: 'dinner',    label: 'Dinner',    icon: '🍽' },
]

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function pickDefaultMeal() {
  const h = new Date().getHours()
  if (h < 11)  return 'breakfast'
  if (h < 16)  return 'lunch'
  return 'dinner'
}

// Extract a profile id from an NDEF record payload (plain-text or URL encoded)
function extractId(text) {
  if (!text) return null
  const m = String(text).match(UUID_RE)
  return m ? m[0] : null
}

async function readNDEF(record) {
  // Prefer decoding text/URL records; fallback to raw bytes
  try {
    if (record.recordType === 'text') {
      const dec = new TextDecoder(record.encoding || 'utf-8')
      return dec.decode(record.data)
    }
    if (record.recordType === 'url') {
      const dec = new TextDecoder()
      return dec.decode(record.data)
    }
    const dec = new TextDecoder()
    return dec.decode(record.data)
  } catch {
    return ''
  }
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function MealScannerScreen() {
  const { user } = useAuth()
  const toast = useToast()

  const [meal,       setMeal]       = useState(pickDefaultMeal)
  const [scanning,   setScanning]   = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [recent,     setRecent]     = useState([])
  const [lookup,     setLookup]     = useState(null) // { profile, alreadyServed }
  const [busy,       setBusy]       = useState(false)

  const readerRef = useRef(null)
  const abortRef  = useRef(null)

  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

  // ── Recent feed ──────────────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    const { data } = await supabase
      .from('meal_records')
      .select('id, meal_type, served_at, profiles!user_id(full_name, team_code)')
      .eq('meal_date', todayISO())
      .order('served_at', { ascending: false })
      .limit(15)
    if (data) setRecent(data)
  }, [])

  useEffect(() => {
    loadRecent()
    const ch = supabase
      .channel('volunteer_meals_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_records' }, loadRecent)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadRecent])

  // ── Core flow: identify participant + record meal ────────────────────────
  const recordMeal = useCallback(async (profileId, mealType) => {
    if (!profileId) { toast.error('No participant ID found on tag'); return }
    setBusy(true)
    try {
      // 1. Fetch profile (also confirms the id exists under RLS)
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, team_code, team_name, role')
        .eq('id', profileId)
        .maybeSingle()

      if (pErr || !profile) {
        toast.error('Participant not found')
        setLookup(null)
        return
      }

      // 2. Check if already served today
      const { data: existing } = await supabase
        .from('meal_records')
        .select('id, served_at')
        .eq('user_id', profileId)
        .eq('meal_type', mealType)
        .eq('meal_date', todayISO())
        .maybeSingle()

      if (existing) {
        setLookup({ profile, alreadyServed: existing })
        toast.error(`${profile.full_name} already had ${mealType} today`)
        return
      }

      // 3. Insert record
      const { error: insErr } = await supabase.from('meal_records').insert({
        user_id: profileId,
        meal_type: mealType,
        served_by: user?.id ?? null,
      })

      if (insErr) {
        // Unique constraint race — treat as already served
        if (insErr.code === '23505') {
          toast.error(`${profile.full_name} already had ${mealType} today`)
          setLookup({ profile, alreadyServed: true })
        } else {
          toast.error('Failed to record meal')
        }
        return
      }

      setLookup({ profile, alreadyServed: null })
      toast.success(`✓ ${profile.full_name} — ${mealType}`)
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(80)
    } finally {
      setBusy(false)
    }
  }, [toast, user?.id])

  // ── NFC scanning ─────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!nfcSupported) {
      toast.error('Web NFC not supported — use Chrome on Android')
      return
    }
    try {
      const reader = new window.NDEFReader()
      readerRef.current = reader
      const ac = new AbortController()
      abortRef.current = ac

      await reader.scan({ signal: ac.signal })
      setScanning(true)

      reader.onreadingerror = () => toast.error('Tag read error — try again')
      reader.onreading = async (ev) => {
        for (const rec of ev.message.records) {
          const text = await readNDEF(rec)
          const id = extractId(text)
          if (id) {
            await recordMeal(id, meal)
            return
          }
        }
        toast.error('Tag has no valid participant ID')
      }
    } catch (e) {
      toast.error(e?.message ?? 'Failed to start NFC scan')
      setScanning(false)
    }
  }, [nfcSupported, toast, meal, recordMeal])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    readerRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Manual lookup (by team_code or UUID) ─────────────────────────────────
  async function handleManualSubmit(e) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return

    // UUID? Use directly. Otherwise treat as team_code and look up profile
    if (UUID_RE.test(code)) {
      await recordMeal(code.match(UUID_RE)[0], meal)
      setManualCode('')
      return
    }

    setBusy(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, team_code')
      .eq('team_code', code.toUpperCase())
    setBusy(false)

    if (!profiles || profiles.length === 0) {
      toast.error(`No participant with code "${code}"`)
      return
    }
    if (profiles.length > 1) {
      toast.error(`${profiles.length} participants share that team code — scan NFC instead`)
      return
    }
    await recordMeal(profiles[0].id, meal)
    setManualCode('')
  }

  // ── NFC write mode (for provisioning stickers) ───────────────────────────
  async function writeTag() {
    if (!nfcSupported) { toast.error('Web NFC not supported'); return }
    const code = manualCode.trim()
    if (!code) { toast.error('Enter a team code or UUID first'); return }

    let id = extractId(code)
    if (!id) {
      // Look up by team code
      const { data: profiles } = await supabase
        .from('profiles').select('id, team_code').eq('team_code', code.toUpperCase())
      if (!profiles || profiles.length !== 1) {
        toast.error('Enter a unique team code or the participant UUID')
        return
      }
      id = profiles[0].id
    }

    try {
      const writer = new window.NDEFReader()
      await writer.write({ records: [{ recordType: 'text', data: `htf4:${id}` }] })
      toast.success('Tag written — tap the blank sticker now')
    } catch (e) {
      toast.error(e?.message ?? 'Write failed')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Meals</h1>
        <span className="font-body font-bold text-sm text-surface-variant">{recent.length} served recently</span>
      </div>

      {/* Meal selector */}
      <div className="grid grid-cols-3 gap-2">
        {MEAL_TYPES.map(m => (
          <button
            key={m.key}
            onClick={() => setMeal(m.key)}
            className={`border-4 border-black py-3 font-headline font-black text-sm uppercase italic drop-block rounded-2xl transition-all active:scale-95 ${
              meal === m.key
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface hover:bg-surface-container text-black'
            }`}
          >
            <div className="text-2xl mb-0.5">{m.icon}</div>
            {m.label}
          </button>
        ))}
      </div>

      {/* Scanner card */}
      <div className="bg-surface border-4 border-black rounded-3xl p-6 drop-block">
        {!nfcSupported ? (
          <div className="text-center">
            <div className="text-5xl mb-3">📱</div>
            <p className="font-headline font-black text-base uppercase italic text-black">NFC Not Supported</p>
            <p className="font-body font-bold text-sm text-on-surface-variant mt-2">
              Web NFC only works in <span className="text-black">Chrome on Android</span>. Use manual entry below.
            </p>
          </div>
        ) : scanning ? (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-primary-container rounded-full animate-ping opacity-60" />
              <div className="relative bg-primary-container border-4 border-black rounded-full w-20 h-20 flex items-center justify-center text-4xl">
                📡
              </div>
            </div>
            <p className="font-headline font-black text-lg uppercase italic text-black">Tap a Sticker</p>
            <p className="font-body font-bold text-sm text-on-surface-variant">
              Hold the back of the phone against the NFC sticker
            </p>
            <button
              onClick={stopScan}
              className="mt-2 bg-error-container border-2 border-error text-on-error-container px-5 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
            >
              Stop Scanning
            </button>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="text-5xl">📡</div>
            <p className="font-headline font-black text-lg uppercase italic text-black">Ready to Scan</p>
            <p className="font-body font-bold text-sm text-on-surface-variant">
              Recording as <span className="text-black">{meal}</span>
            </p>
            <button
              onClick={startScan}
              className="bg-primary-container text-on-primary-container border-4 border-black px-6 py-3 font-headline font-black text-sm uppercase italic drop-block rounded-2xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Start NFC Scan →
            </button>
          </div>
        )}
      </div>

      {/* Last lookup feedback */}
      {lookup && (
        <div className={`border-4 p-4 rounded-2xl drop-block ${
          lookup.alreadyServed
            ? 'bg-error-container border-error text-on-error-container'
            : 'bg-primary-container border-black text-on-primary-container'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lookup.alreadyServed ? '⚠' : '✓'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-black text-lg italic truncate">{lookup.profile.full_name}</p>
              <p className="font-body font-bold text-sm opacity-80">
                {lookup.profile.team_code ? `Team ${lookup.profile.team_code} · ` : ''}
                {lookup.alreadyServed
                  ? `Already had ${meal} today`
                  : `${meal} served ✓`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="bg-surface-container border-4 border-black p-4 rounded-3xl">
        <h2 className="font-headline font-black text-sm uppercase italic mb-3 text-black">Manual Entry</h2>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Team code (e.g. A00) or UUID"
            className="flex-1 bg-white border-4 border-black px-3 py-2 font-body font-bold text-sm focus:outline-none focus:border-primary rounded-xl"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-primary-container text-on-primary-container border-4 border-black px-4 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95 disabled:opacity-50"
          >
            {busy ? <LoadingSpinner size="sm" /> : 'Serve'}
          </button>
        </form>
        {nfcSupported && (
          <button
            type="button"
            onClick={writeTag}
            className="mt-2 w-full bg-tertiary-container text-on-tertiary-container border-2 border-black px-3 py-2 font-headline font-black text-xs uppercase italic rounded-xl active:scale-95"
          >
            ✎ Write Tag with Above Code
          </button>
        )}
        <p className="font-body text-xs text-on-surface-variant mt-2">
          NFC stickers store the participant UUID as text. Use <span className="text-black">Write Tag</span> to
          provision a blank sticker for a participant.
        </p>
      </div>

      {/* Recent feed */}
      <div>
        <h2 className="font-headline font-black text-sm uppercase italic mb-3 text-white">Served Today</h2>
        {recent.length === 0 ? (
          <div className="bg-surface-container border-4 border-black p-6 rounded-3xl text-center">
            <p className="font-body font-bold text-on-surface-variant">No meals recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <div key={r.id} className="bg-surface border-4 border-black px-4 py-3 rounded-2xl flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">
                  {MEAL_TYPES.find(m => m.key === r.meal_type)?.icon ?? '🍽'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-black text-base italic truncate text-black">
                    {r.profiles?.full_name ?? 'Unknown'}
                  </p>
                  <p className="font-body font-bold text-xs text-on-surface-variant">
                    {r.meal_type}
                    {r.profiles?.team_code && (
                      <span className="font-mono text-primary"> · {r.profiles.team_code}</span>
                    )}
                  </p>
                </div>
                <p className="font-mono text-xs text-outline flex-shrink-0">
                  {new Date(r.served_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

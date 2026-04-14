import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function parsePayload(raw) {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && typeof obj.uid === 'string' && UUID_RE.test(obj.uid)) {
      return { uid: obj.uid.match(UUID_RE)[0], team_name: obj.name ?? obj.team ?? null, team_code: obj.code ?? null }
    }
  } catch { /* not json */ }
  const m = String(raw).match(UUID_RE)
  return m ? { uid: m[0], team_name: null, team_code: null } : null
}

function detectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export default function CheckinMonitorScreen() {
  const toast = useToast()
  const [checkins, setCheckins] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [busy, setBusy] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)
  const busyRef = useRef(false)

  const loadCheckins = useCallback(async () => {
    const { data, count } = await supabase
      .from('checkins')
      .select('*, profiles(team_name, team_code)', { count: 'exact' })
      .order('checked_in_at', { ascending: false })
    if (data) setCheckins(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCheckins()
    const ch = supabase
      .channel('admin_checkins_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkins' }, loadCheckins)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadCheckins])

  const confirmCheckin = useCallback(async ({ uid, team_name, team_code }) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      let profile = null
      if (uid) {
        const { data } = await supabase
          .from('profiles').select('id, team_name, team_code').eq('id', uid).maybeSingle()
        profile = data
      }
      if (!profile && team_code) {
        const { data } = await supabase
          .from('profiles').select('id, team_name, team_code').eq('team_code', team_code.toUpperCase()).maybeSingle()
        profile = data
      }
      if (!profile) {
        setLastResult({ ok: false, message: 'Participant not found' })
        toast.error('Participant not found')
        return
      }

      const { data: existing } = await supabase
        .from('checkins').select('id, checked_in_at').eq('user_id', profile.id).maybeSingle()

      if (existing) {
        setLastResult({ ok: true, already: true, profile, at: existing.checked_in_at })
        toast.info(`${profile.team_name ?? team_name ?? 'Team'} already checked in`)
        return
      }

      const { error: insErr } = await supabase.from('checkins').insert({ user_id: profile.id })
      if (insErr) {
        if (insErr.code === '23505') {
          setLastResult({ ok: true, already: true, profile })
          toast.info('Already checked in')
          return
        }
        setLastResult({ ok: false, message: insErr.message || 'Check-in failed' })
        toast.error('Check-in failed')
        return
      }

      await supabase.from('profiles').update({
        checked_in: true, checked_in_at: new Date().toISOString(),
      }).eq('id', profile.id)

      setLastResult({ ok: true, already: false, profile, at: new Date().toISOString() })
      toast.success(`✓ ${profile.team_name ?? 'Team'} checked in`)
      if (navigator.vibrate) navigator.vibrate(80)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [toast])

  const stopScan = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const startScan = useCallback(async () => {
    if (!detectorSupported()) {
      toast.error('QR scanning unavailable — use manual entry or Chrome on Android')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setScanning(true)
      // Attach after render — videoRef may not exist until scanning=true
      setTimeout(async () => {
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play().catch(() => {})
        // eslint-disable-next-line no-undef
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (!videoRef.current) return
          try {
            const codes = await detectorRef.current.detect(videoRef.current)
            if (codes?.[0]?.rawValue) {
              const payload = parsePayload(codes[0].rawValue)
              if (payload) {
                await confirmCheckin(payload)
              } else {
                toast.error('Unrecognised QR')
              }
            }
          } catch { /* frame error */ }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }, 50)
    } catch (e) {
      toast.error(e?.message ?? 'Camera permission denied')
      setScanning(false)
    }
  }, [toast, confirmCheckin])

  useEffect(() => () => stopScan(), [stopScan])

  async function handleManualSubmit(e) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    const payload = parsePayload(code) ?? { uid: null, team_name: null, team_code: code }
    await confirmCheckin(payload)
    setManualCode('')
  }

  const filtered = search.trim()
    ? checkins.filter(c => {
      const q = search.toLowerCase()
      return (
        c.profiles?.team_name?.toLowerCase().includes(q) ||
        c.profiles?.team_code?.toLowerCase().includes(q)
      )
    })
    : checkins

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Check-ins</h1>
        <div className="bg-primary-container border-4 border-black px-4 py-2 drop-block rounded-2xl">
          <span className="font-headline font-black text-2xl text-on-primary-container">{total}</span>
          <span className="font-body font-bold text-xs text-on-primary-container opacity-80 ml-1">in</span>
        </div>
      </div>

      {/* Scanner card */}
      <div className="bg-surface border-4 border-black rounded-3xl p-5 drop-block">
        {scanning ? (
          <div className="flex flex-col items-center gap-3">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-w-sm aspect-square object-cover border-4 border-black rounded-2xl bg-black"
            />
            <p className="font-body font-bold text-sm text-on-surface-variant">
              Point the camera at the participant&apos;s QR
            </p>
            <button
              onClick={stopScan}
              className="bg-error-container border-2 border-error text-on-error-container px-5 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
            >
              Stop Scanning
            </button>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="text-5xl">📷</div>
            <p className="font-headline font-black text-lg uppercase italic text-black">Scan Participant QR</p>
            {!detectorSupported() && (
              <p className="font-body font-bold text-xs text-on-surface-variant max-w-xs">
                Camera QR detection requires Chrome on Android. Use manual entry below on other devices.
              </p>
            )}
            <button
              onClick={startScan}
              disabled={!detectorSupported() || busy}
              className="bg-primary-container text-on-primary-container border-4 border-black px-6 py-3 font-headline font-black text-sm uppercase italic drop-block rounded-2xl active:scale-95 disabled:opacity-50"
            >
              Start Camera →
            </button>
          </div>
        )}
      </div>

      {/* Last result */}
      {lastResult && (
        <div className={`border-4 p-4 rounded-2xl drop-block ${
          !lastResult.ok
            ? 'bg-error-container border-error text-on-error-container'
            : lastResult.already
              ? 'bg-surface-variant border-black text-on-surface'
              : 'bg-primary-container border-black text-on-primary-container'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{!lastResult.ok ? '⚠' : lastResult.already ? 'ℹ' : '✓'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-black text-lg italic truncate">
                {lastResult.profile?.team_name ?? lastResult.message ?? '—'}
              </p>
              <p className="font-body font-bold text-sm opacity-80">
                {lastResult.profile?.team_code ? `Team ${lastResult.profile.team_code} · ` : ''}
                {!lastResult.ok ? 'Error' : lastResult.already ? 'Already checked in' : 'Checked in ✓'}
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
            placeholder="Team code or participant UUID"
            className="flex-1 bg-white border-4 border-black px-3 py-2 font-body font-bold text-sm focus:outline-none focus:border-primary rounded-xl"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-primary-container text-on-primary-container border-4 border-black px-4 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95 disabled:opacity-50"
          >
            {busy ? <LoadingSpinner size="sm" /> : 'Confirm'}
          </button>
        </form>
      </div>

      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline font-black text-sm uppercase italic text-white">Recent</h2>
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or team..."
          className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary rounded-xl mb-3"
        />

        {filtered.length === 0 ? (
          <div className="bg-surface-container border-4 border-black p-6 rounded-3xl text-center">
            <p className="font-body font-bold text-on-surface-variant">
              {search ? 'No matches found' : 'No one checked in yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item, idx) => (
              <div key={item.id} className="bg-surface border-4 border-black px-4 py-3 rounded-2xl flex items-center gap-3">
                <span className="font-headline font-black text-lg text-outline w-7 flex-shrink-0 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-black text-base italic truncate">{item.profiles?.team_name ?? 'Unknown'}</p>
                  <p className="font-body font-bold text-sm text-on-surface-variant">
                    {item.profiles?.team_code && (
                      <span className="font-mono text-primary">{item.profiles.team_code}</span>
                    )}
                  </p>
                </div>
                <p className="font-mono text-xs text-outline flex-shrink-0">
                  {new Date(item.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

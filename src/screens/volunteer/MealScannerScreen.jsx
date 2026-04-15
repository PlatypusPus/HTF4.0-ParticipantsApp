import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { parsePayload, normalizeName } from '../../lib/nfcPayload'

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: '🥐' },
  { key: 'lunch',     label: 'Lunch',     icon: '🥗' },
  { key: 'dinner',    label: 'Dinner',    icon: '🍽' },
]

const MAX_PER_MEAL_TYPE = 2

function pickDefaultMeal() {
  const h = new Date().getHours()
  if (h < 11)  return 'breakfast'
  if (h < 16)  return 'lunch'
  return 'dinner'
}

async function readNDEF(record) {
  try {
    const dec = new TextDecoder(record.encoding || 'utf-8')
    return dec.decode(record.data)
  } catch { return '' }
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function MealScannerScreen() {
  const { user } = useAuth()
  const toast = useToast()

  const [meal, setMeal] = useState(pickDefaultMeal)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lookup, setLookup] = useState(null)
  const [busy, setBusy] = useState(false)

  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [records, setRecords] = useState([])
  const [openTeamId, setOpenTeamId] = useState(null)

  const readerRef = useRef(null)
  const abortRef  = useRef(null)

  const nfcStatus = (() => {
    if (typeof window === 'undefined') return { ok: false, reason: 'ssr', msg: '' }
    if (!window.isSecureContext) return {
      ok: false, reason: 'insecure',
      msg: 'Web NFC needs HTTPS.',
    }
    const ua = navigator.userAgent
    const isAndroid = /Android/i.test(ua)
    const isChrome  = /Chrome\/\d+/.test(ua) && !/Edg|SamsungBrowser|Firefox|OPR/i.test(ua)
    if (!isAndroid) return { ok: false, reason: 'platform', msg: 'Web NFC only works on Android.' }
    if (!isChrome)  return { ok: false, reason: 'browser',  msg: 'Open this page in Chrome for Android.' }
    if (!('NDEFReader' in window)) return { ok: false, reason: 'api', msg: 'NFC not exposed by this Chrome build.' }
    return { ok: true, reason: 'ok', msg: '' }
  })()
  const nfcSupported = nfcStatus.ok

  // ── Load teams + members + meal records ──────────────────────────────────
  const load = useCallback(async () => {
    const [t, m, r] = await Promise.all([
      supabase.from('profiles').select('id, team_code, team_name, role').eq('role', 'participant').order('team_code'),
      supabase.from('team_members').select('id, team_id, full_name').order('full_name'),
      supabase.from('meal_records').select('id, user_id, team_member_id, meal_type, served_at').order('served_at', { ascending: false }),
    ])
    if (t.data) setTeams(t.data)
    if (m.data) setMembers(m.data)
    if (r.data) setRecords(r.data)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('meals_by_team_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_records' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // ── Grouped progress for selected meal ───────────────────────────────────
  const grouped = useMemo(() => {
    const memberByTeam = new Map()
    for (const mem of members) {
      const arr = memberByTeam.get(mem.team_id) ?? []
      arr.push(mem); memberByTeam.set(mem.team_id, arr)
    }

    const memberCount = new Map() // team_member_id -> count for selected meal
    const teamCount = new Map()   // team_id (legacy, no member) -> count
    for (const r of records) {
      if (r.meal_type !== meal) continue
      if (r.team_member_id) memberCount.set(r.team_member_id, (memberCount.get(r.team_member_id) ?? 0) + 1)
      else teamCount.set(r.user_id, (teamCount.get(r.user_id) ?? 0) + 1)
    }

    const rows = teams.map(team => {
      const ms = memberByTeam.get(team.id) ?? []
      const served = ms.filter(m => (memberCount.get(m.id) ?? 0) > 0)
      const teamLevel = teamCount.get(team.id) ?? 0
      return {
        ...team,
        members: ms.map(m => ({ ...m, count: memberCount.get(m.id) ?? 0 })),
        servedCount: served.length,
        totalCount: ms.length,
        teamLevelCount: teamLevel,
      }
    })

    const totals = rows.reduce(
      (acc, r) => ({ served: acc.served + r.servedCount, total: acc.total + r.totalCount }),
      { served: 0, total: 0 },
    )

    return { rows, totals }
  }, [teams, members, records, meal])

  // ── Core flow: identify participant/member and record meal ──────────────
  // tag = { uuid, teamCode, name } — any/all may be present
  const recordMeal = useCallback(async (tag, mealType) => {
    const { uuid, teamCode, name } = tag ?? {}
    if (!uuid && !teamCode) { toast.error('No ID on tag'); return }
    setBusy(true)
    try {
      let member = null
      let team = null

      // 1) UUID path (organizer stickers / legacy)
      if (uuid) {
        const { data: mem } = await supabase
          .from('team_members')
          .select('id, team_id, full_name')
          .eq('id', uuid).maybeSingle()
        if (mem) {
          member = mem
          const { data: prof } = await supabase
            .from('profiles').select('id, team_code, team_name')
            .eq('id', mem.team_id).maybeSingle()
          if (prof) team = prof
        }

        if (!team) {
          const { data: prof } = await supabase
            .from('profiles').select('id, team_code, team_name').eq('id', uuid).maybeSingle()
          if (prof) team = prof
        }
      }

      // 2) team_code path (participant NFC stickers: htf4:team=CODE;name=NAME)
      if (!team && teamCode) {
        const { data: prof } = await supabase
          .from('profiles').select('id, team_code, team_name')
          .eq('team_code', teamCode).maybeSingle()
        if (prof) team = prof
      }

      // 3) Resolve member by name within the team, if we have a name
      if (team && !member && name) {
        const target = normalizeName(name)
        const { data: mems } = await supabase
          .from('team_members').select('id, team_id, full_name').eq('team_id', team.id)
        const hit = (mems ?? []).find(m => normalizeName(m.full_name) === target)
        if (hit) member = { ...hit, team }
      }

      if (!team) {
        toast.error('Not found'); setLookup(null); return
      }

      // Count how many times already served (per-member if we have one, else per-team)
      let servedCount = 0
      if (member) {
        const { count } = await supabase
          .from('meal_records').select('id', { count: 'exact', head: true })
          .eq('team_member_id', member.id).eq('meal_type', mealType)
        servedCount = count ?? 0
      } else {
        const { count } = await supabase
          .from('meal_records').select('id', { count: 'exact', head: true })
          .eq('user_id', team.id).eq('meal_type', mealType).is('team_member_id', null)
        servedCount = count ?? 0
      }

      if (servedCount >= MAX_PER_MEAL_TYPE) {
        setLookup({ team, member, alreadyServed: true, servedCount, mealType })
        toast.error(`${member?.full_name ?? team.team_name} already had ${mealType} ${MAX_PER_MEAL_TYPE}×`)
        return
      }

      const { error } = await supabase.from('meal_records').insert({
        user_id: team.id,
        team_member_id: member?.id ?? null,
        meal_type: mealType,
        served_by: user?.id ?? null,
      })

      if (error) {
        if (error.code === '23505') {
          setLookup({ team, member, alreadyServed: true })
          toast.error('Already served')
        } else {
          console.error('meal_records insert failed', error)
          toast.error(`Failed: ${error.message ?? error.code ?? 'unknown error'}`)
        }
        return
      }

      setLookup({ team, member, alreadyServed: false, servedCount: servedCount + 1, mealType })
      toast.success(`✓ ${member?.full_name ?? team.team_name} — ${mealType} (${servedCount + 1}/${MAX_PER_MEAL_TYPE})`)
      if (navigator.vibrate) navigator.vibrate(80)
    } finally {
      setBusy(false)
    }
  }, [toast, user?.id])

  // ── NFC scanning ─────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!nfcSupported) { toast.error('Web NFC not supported'); return }
    try {
      const reader = new window.NDEFReader()
      readerRef.current = reader
      const ac = new AbortController()
      abortRef.current = ac
      await reader.scan({ signal: ac.signal })
      setScanning(true)

      reader.onreadingerror = () => toast.error('Tag read error')
      reader.onreading = async (ev) => {
        for (const rec of ev.message.records) {
          const text = await readNDEF(rec)
          const parsed = parsePayload(text)
          if (parsed.uuid || parsed.teamCode) {
            await recordMeal(parsed, meal)
            return
          }
        }
        toast.error('Tag has no valid ID')
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

  async function handleManualSubmit(e) {
    e.preventDefault()
    const raw = manualCode.trim()
    if (!raw) return

    const parsed = parsePayload(raw)
    if (parsed.uuid || parsed.teamCode) {
      await recordMeal(parsed, meal)
      setManualCode('')
      return
    }

    // Treat plain input as a team code
    await recordMeal({ uuid: null, teamCode: raw.toUpperCase(), name: null }, meal)
    setManualCode('')
  }

  async function writeTag() {
    if (!nfcSupported) { toast.error('Web NFC not supported'); return }
    const raw = manualCode.trim()
    if (!raw) { toast.error('Enter a UUID first'); return }
    const parsed = parsePayload(raw)
    if (!parsed.uuid) { toast.error('Enter a valid UUID'); return }
    try {
      const writer = new window.NDEFReader()
      await writer.write({ records: [{ recordType: 'text', data: `htf4:${parsed.uuid}` }] })
      toast.success('Tag written — tap the blank sticker now')
    } catch (e) {
      toast.error(e?.message ?? 'Write failed')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Meals</h1>
        {grouped.totals.total > 0 && (
          <div className="bg-tertiary-container border-4 border-black px-3 py-1 drop-block rounded-2xl">
            <span className="font-headline font-black text-lg text-on-tertiary-container">{grouped.totals.served}</span>
            <span className="font-body font-bold text-[10px] text-on-tertiary-container opacity-80 ml-1">/{grouped.totals.total} had {meal}</span>
          </div>
        )}
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
            <p className="font-headline font-black text-base uppercase italic text-black">NFC Unavailable</p>
            <p className="font-body font-bold text-sm text-on-surface-variant mt-2">
              {nfcStatus.msg || 'Chrome on Android + HTTPS required.'}
            </p>
            <p className="font-body text-xs text-on-surface-variant mt-2">Use manual entry below.</p>
          </div>
        ) : scanning ? (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-primary-container rounded-full animate-ping opacity-60" />
              <div className="relative bg-primary-container border-4 border-black rounded-full w-20 h-20 flex items-center justify-center text-4xl">📡</div>
            </div>
            <p className="font-headline font-black text-lg uppercase italic text-black">Tap a Sticker</p>
            <p className="font-body font-bold text-sm text-on-surface-variant">Hold phone against the NFC sticker</p>
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

      {/* Last lookup */}
      {lookup && (
        <div className={`border-4 p-4 rounded-2xl drop-block ${
          lookup.alreadyServed
            ? 'bg-error-container border-error text-on-error-container'
            : 'bg-primary-container border-black text-on-primary-container'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lookup.alreadyServed ? '⚠' : '✓'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-black text-lg italic truncate">
                {lookup.member?.full_name ?? lookup.team?.team_name}
              </p>
              <p className="font-body font-bold text-sm opacity-80">
                {lookup.team?.team_code ? `Team ${lookup.team.team_code} · ` : ''}
                {lookup.alreadyServed
                  ? `Max ${MAX_PER_MEAL_TYPE}× ${lookup.mealType ?? meal} reached`
                  : `${lookup.mealType ?? meal} served (${lookup.servedCount ?? 1}/${MAX_PER_MEAL_TYPE})`}
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
            placeholder="Team code or UUID"
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
            ✎ Write Tag with Above UUID
          </button>
        )}
        <p className="font-body text-xs text-on-surface-variant mt-2">
          NFC stickers hold the team member&apos;s UUID. The team is resolved automatically.
        </p>
      </div>

      {/* Grouped progress for the selected meal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline font-black text-sm uppercase italic text-white">
            {meal.charAt(0).toUpperCase() + meal.slice(1)} — by team
          </h2>
        </div>

        {grouped.rows.length === 0 ? (
          <div className="bg-surface-container border-4 border-black p-6 rounded-3xl text-center">
            <p className="font-body font-bold text-on-surface-variant">No teams seeded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.rows.map(row => {
              const open = openTeamId === row.id
              const pct = row.totalCount > 0 ? row.servedCount / row.totalCount : 0
              const bg = row.totalCount === 0
                ? 'bg-surface'
                : row.servedCount === row.totalCount
                  ? 'bg-primary-container'
                  : row.servedCount > 0
                    ? 'bg-tertiary-container'
                    : 'bg-surface'
              return (
                <div key={row.id} className={`${bg} border-4 border-black rounded-2xl overflow-hidden`}>
                  <button
                    onClick={() => setOpenTeamId(open ? null : row.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="font-mono font-bold text-xs bg-black text-white px-2 py-0.5 rounded w-14 text-center flex-shrink-0">
                      {row.team_code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-black text-base italic truncate">{row.team_name}</p>
                      <p className="font-body font-bold text-xs opacity-80">
                        {row.totalCount > 0
                          ? `${row.servedCount}/${row.totalCount} had ${meal}`
                          : row.teamLevelCount > 0
                            ? `Team-level: ${row.teamLevelCount}× ${meal}`
                            : 'No members added'}
                      </p>
                    </div>
                    {row.totalCount > 0 && (
                      <div className="w-14 h-2 bg-black/20 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-black" style={{ width: `${pct * 100}%` }} />
                      </div>
                    )}
                    <span className="text-lg">{open ? '▴' : '▾'}</span>
                  </button>
                  {open && row.members.length > 0 && (
                    <ul className="border-t-4 border-black bg-white/60">
                      {row.members.map(m => (
                        <li key={m.id} className="flex items-center justify-between px-4 py-2 border-b-2 border-black/10 last:border-b-0">
                          <span className="font-body font-bold text-sm truncate">{m.full_name}</span>
                          <span className={`font-headline font-black text-[10px] uppercase italic px-2 py-0.5 rounded-lg ${
                            m.count >= MAX_PER_MEAL_TYPE
                              ? 'bg-surface-variant text-on-surface'
                              : m.count > 0
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-error-container text-on-error-container'
                          }`}>
                            {m.count >= MAX_PER_MEAL_TYPE ? `max ${MAX_PER_MEAL_TYPE}×` : m.count > 0 ? `${m.count}×` : 'missed'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {open && row.members.length === 0 && (
                    <div className="border-t-4 border-black bg-white/60 px-4 py-3">
                      <p className="font-body font-bold text-xs text-on-surface-variant">
                        No members on this team yet. Upload participant data to enable per-person tracking.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

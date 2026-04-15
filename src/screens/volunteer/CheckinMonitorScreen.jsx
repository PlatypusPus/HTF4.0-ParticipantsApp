import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { parsePayload, normalizeName } from '../../lib/nfcPayload'

function detectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export default function CheckinMonitorScreen() {
  const toast = useToast()
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [search, setSearch] = useState('')
  const [openTeamId, setOpenTeamId] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const [t, m, c] = await Promise.all([
      supabase.from('profiles').select('id, team_code, team_name, role').eq('role', 'participant').order('team_code'),
      supabase.from('team_members').select('id, team_id, full_name, checked_in, checked_in_at').order('full_name'),
      supabase.from('checkins').select('id, user_id, team_member_id, checked_in_at').order('checked_in_at', { ascending: false }),
    ])
    if (t.data) setTeams(t.data)
    if (m.data) setMembers(m.data)
    if (c.data) setCheckins(c.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('checkins_monitor_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // ─── Grouped view: team → {members[], present} ──────────────────────────────
  const grouped = useMemo(() => {
    const memberByTeam = new Map()
    for (const mem of members) {
      const arr = memberByTeam.get(mem.team_id) ?? []
      arr.push(mem)
      memberByTeam.set(mem.team_id, arr)
    }
    const checkinByMember = new Map()
    const teamCheckin = new Map()
    for (const c of checkins) {
      if (c.team_member_id) checkinByMember.set(c.team_member_id, c)
      else teamCheckin.set(c.user_id, c)
    }

    const totals = { teamsPresent: 0, teamsTotal: teams.length, membersPresent: 0, membersTotal: members.length }

    const rows = teams.map(team => {
      const memberList = memberByTeam.get(team.id) ?? []
      const present = memberList.filter(m => checkinByMember.has(m.id))
      const teamLevel = teamCheckin.get(team.id) ?? null
      const isTeamIn = !!teamLevel || present.length > 0
      if (isTeamIn) totals.teamsPresent += 1
      totals.membersPresent += present.length
      return {
        ...team,
        members: memberList.map(m => ({
          ...m,
          checkin: checkinByMember.get(m.id) ?? null,
        })),
        teamLevelCheckin: teamLevel,
        presentCount: present.length,
        totalCount: memberList.length,
        isTeamIn,
      }
    })

    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter(r =>
        r.team_code.toLowerCase().includes(q) ||
        r.team_name.toLowerCase().includes(q) ||
        r.members.some(m => m.full_name.toLowerCase().includes(q)))
      : rows

    return { rows: filtered, totals }
  }, [teams, members, checkins, search])

  // ─── Core: confirm check-in ────────────────────────────────────────────────
  const confirmCheckin = useCallback(async ({ uid, code, name }) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      let member = null
      let team = null

      if (uid) {
        const { data: mem } = await supabase
          .from('team_members')
          .select('id, team_id, full_name')
          .eq('id', uid).maybeSingle()
        if (mem) {
          member = mem
          const { data: prof } = await supabase
            .from('profiles').select('id, team_code, team_name')
            .eq('id', mem.team_id).maybeSingle()
          if (prof) team = prof
        }
      }

      if (!team && uid) {
        const { data: prof } = await supabase
          .from('profiles').select('id, team_code, team_name').eq('id', uid).maybeSingle()
        if (prof) team = prof
      }

      if (!team && code) {
        const { data: prof } = await supabase
          .from('profiles').select('id, team_code, team_name').eq('team_code', code).maybeSingle()
        if (prof) team = prof
      }

      // Resolve a named member within the team (participant stickers/QRs)
      if (team && !member && name) {
        const target = normalizeName(name)
        const { data: mems } = await supabase
          .from('team_members').select('id, team_id, full_name').eq('team_id', team.id)
        const hit = (mems ?? []).find(m => normalizeName(m.full_name) === target)
        if (hit) member = { ...hit, team }
      }

      if (!team) {
        setLastResult({ ok: false, message: 'Participant not found' })
        toast.error('Not found')
        return
      }

      // Already checked in?
      if (member) {
        const { data: existing } = await supabase
          .from('checkins').select('id, checked_in_at').eq('team_member_id', member.id).maybeSingle()
        if (existing) {
          setLastResult({ ok: true, already: true, team, member, at: existing.checked_in_at })
          toast.info(`${member.full_name} already checked in`)
          return
        }
        const { error } = await supabase.from('checkins').insert({
          user_id: team.id, team_member_id: member.id,
        })
        if (error && error.code !== '23505') {
          setLastResult({ ok: false, message: error.message }); toast.error('Check-in failed'); return
        }
        await supabase.from('team_members').update({
          checked_in: true, checked_in_at: new Date().toISOString(),
        }).eq('id', member.id)
        setLastResult({ ok: true, already: false, team, member })
        toast.success(`✓ ${member.full_name} (${team.team_code})`)
      } else {
        const { data: existing } = await supabase
          .from('checkins').select('id, checked_in_at')
          .eq('user_id', team.id).is('team_member_id', null).maybeSingle()
        if (existing) {
          setLastResult({ ok: true, already: true, team, at: existing.checked_in_at })
          toast.info(`Team ${team.team_code} already checked in`)
          return
        }
        const { error } = await supabase.from('checkins').insert({ user_id: team.id })
        if (error && error.code !== '23505') {
          setLastResult({ ok: false, message: error.message }); toast.error('Check-in failed'); return
        }
        await supabase.from('profiles').update({
          checked_in: true, checked_in_at: new Date().toISOString(),
        }).eq('id', team.id)
        setLastResult({ ok: true, already: false, team })
        toast.success(`✓ Team ${team.team_code} checked in`)
      }

      if (navigator.vibrate) navigator.vibrate(80)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [toast])

  // ─── QR scanner ──────────────────────────────────────────────────────────
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
    if (!detectorSupported()) { toast.error('QR scanning needs Chrome on Android'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      })
      streamRef.current = stream
      setScanning(true)
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
              const raw = codes[0].rawValue
              const parsed = parsePayload(raw)
              if (parsed.uuid || parsed.teamCode || parsed.name) {
                await confirmCheckin({ uid: parsed.uuid, code: parsed.teamCode, name: parsed.name })
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
      toast.error(e?.message ?? 'Camera permission denied'); setScanning(false)
    }
  }, [toast, confirmCheckin])

  useEffect(() => () => stopScan(), [stopScan])

  async function handleManualSubmit(e) {
    e.preventDefault()
    const raw = manualCode.trim()
    if (!raw) return
    const parsed = parsePayload(raw)
    if (parsed.uuid || parsed.teamCode || parsed.name) {
      await confirmCheckin({ uid: parsed.uuid, code: parsed.teamCode, name: parsed.name })
    } else {
      await confirmCheckin({ uid: null, code: raw.toUpperCase(), name: null })
    }
    setManualCode('')
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Check-ins</h1>
        <div className="flex gap-2">
          <div className="bg-primary-container border-4 border-black px-3 py-1 drop-block rounded-2xl">
            <span className="font-headline font-black text-lg text-on-primary-container">{grouped.totals.teamsPresent}</span>
            <span className="font-body font-bold text-[10px] text-on-primary-container opacity-80 ml-1">/{grouped.totals.teamsTotal} teams</span>
          </div>
          {grouped.totals.membersTotal > 0 && (
            <div className="bg-tertiary-container border-4 border-black px-3 py-1 drop-block rounded-2xl">
              <span className="font-headline font-black text-lg text-on-tertiary-container">{grouped.totals.membersPresent}</span>
              <span className="font-body font-bold text-[10px] text-on-tertiary-container opacity-80 ml-1">/{grouped.totals.membersTotal} ppl</span>
            </div>
          )}
        </div>
      </div>

      {/* Scanner */}
      <div className="bg-surface border-4 border-black rounded-3xl p-5 drop-block">
        {scanning ? (
          <div className="flex flex-col items-center gap-3">
            <video ref={videoRef} playsInline muted
              className="w-full max-w-sm aspect-square object-cover border-4 border-black rounded-2xl bg-black" />
            <p className="font-body font-bold text-sm text-on-surface-variant">
              Point at the participant&apos;s QR
            </p>
            <button onClick={stopScan}
              className="bg-error-container border-2 border-error text-on-error-container px-5 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95">
              Stop Scanning
            </button>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="text-5xl">📷</div>
            <p className="font-headline font-black text-lg uppercase italic text-black">Scan Participant QR</p>
            {!detectorSupported() && (
              <p className="font-body font-bold text-xs text-on-surface-variant max-w-xs">
                Camera scanning needs Chrome on Android. Use manual entry below otherwise.
              </p>
            )}
            <button onClick={startScan} disabled={!detectorSupported() || busy}
              className="bg-primary-container text-on-primary-container border-4 border-black px-6 py-3 font-headline font-black text-sm uppercase italic drop-block rounded-2xl active:scale-95 disabled:opacity-50">
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
                {lastResult.member?.full_name ?? lastResult.team?.team_name ?? lastResult.message ?? '—'}
              </p>
              <p className="font-body font-bold text-sm opacity-80">
                {lastResult.team?.team_code ? `Team ${lastResult.team.team_code}` : ''}
                {lastResult.ok ? (lastResult.already ? ' · Already checked in' : ' · Checked in ✓') : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="bg-surface-container border-4 border-black p-4 rounded-3xl">
        <h2 className="font-headline font-black text-sm uppercase italic mb-3 text-black">Manual Entry</h2>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input value={manualCode} onChange={e => setManualCode(e.target.value)}
            placeholder="Team code or UUID"
            className="flex-1 bg-white border-4 border-black px-3 py-2 font-body font-bold text-sm focus:outline-none focus:border-primary rounded-xl" />
          <button type="submit" disabled={busy}
            className="bg-primary-container text-on-primary-container border-4 border-black px-4 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95 disabled:opacity-50">
            {busy ? <LoadingSpinner size="sm" /> : 'Confirm'}
          </button>
        </form>
      </div>

      {/* Grouped list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline font-black text-sm uppercase italic text-white">By Team</h2>
        </div>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search team, code, or member..."
          className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary rounded-xl mb-3" />

        {grouped.rows.length === 0 ? (
          <div className="bg-surface-container border-4 border-black p-6 rounded-3xl text-center">
            <p className="font-body font-bold text-on-surface-variant">
              {search ? 'No matches' : 'No teams seeded'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.rows.map(row => {
              const open = openTeamId === row.id
              const pct = row.totalCount > 0 ? row.presentCount / row.totalCount : 0
              const bg = row.totalCount === 0
                ? (row.isTeamIn ? 'bg-primary-container' : 'bg-surface')
                : (row.presentCount === row.totalCount ? 'bg-primary-container' : row.presentCount > 0 ? 'bg-tertiary-container' : 'bg-surface')
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
                          ? `${row.presentCount}/${row.totalCount} present`
                          : row.isTeamIn ? 'Team checked in' : 'Not checked in'}
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
                            m.checkin ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'
                          }`}>
                            {m.checkin ? '✓ in' : 'absent'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {open && row.members.length === 0 && (
                    <div className="border-t-4 border-black bg-white/60 px-4 py-3">
                      <p className="font-body font-bold text-xs text-on-surface-variant">
                        No members added yet. Scan the team QR/code for a team-level check-in.
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

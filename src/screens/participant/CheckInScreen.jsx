import { useState, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { NFC_TEAMS } from '../../data/nfcTeams'
import { buildMemberPayload, normalizeName } from '../../lib/nfcPayload'

const WIFI_SSID = 'HackToFuture4'
const WIFI_PASSWORD = '4HTF0@Sjec'

function memberStorageKey(teamCode) {
  return `htf4.member.${teamCode || 'unknown'}`
}

export default function CheckInScreen() {
  const { user, profile, fetchProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [checkedIn, setCheckedIn] = useState(!!profile?.checked_in)
  const [revealPwd, setRevealPwd] = useState(false)
  const [copied, setCopied] = useState(null)
  const [selectedName, setSelectedName] = useState(null)
  const [memberCheckins, setMemberCheckins] = useState([])

  const teamCode = profile?.team_code ?? ''

  // Roster for this team (from the same data used by NfcWriteScreen)
  const roster = useMemo(
    () => NFC_TEAMS.filter(r => r.teamCode === teamCode).map(r => r.name),
    [teamCode],
  )

  // Restore the member selection per team_code
  useEffect(() => {
    if (!teamCode) return
    const saved = localStorage.getItem(memberStorageKey(teamCode))
    if (saved && roster.some(n => normalizeName(n) === normalizeName(saved))) {
      setSelectedName(saved)
    } else {
      setSelectedName(null)
    }
  }, [teamCode, roster])

  function chooseMember(name) {
    setSelectedName(name)
    if (teamCode) localStorage.setItem(memberStorageKey(teamCode), name)
  }

  function clearMember() {
    setSelectedName(null)
    if (teamCode) localStorage.removeItem(memberStorageKey(teamCode))
  }

  // Payload that matches what's written on the NFC sticker
  const qrPayload = selectedName
    ? buildMemberPayload(teamCode, selectedName)
    : JSON.stringify({ uid: user?.id ?? '', team: profile?.team_name ?? '', code: teamCode })

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function probe() {
      const { data } = await supabase
        .from('checkins').select('id, team_member_id').eq('user_id', user.id)
      if (cancelled || !data) return
      setMemberCheckins(data)
      if (data.some(r => r.team_member_id === null)) {
        setCheckedIn(true)
        fetchProfile(user.id)
      }
    }
    probe()

    const ch = supabase
      .channel(`checkin_self_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkins', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new
          setMemberCheckins(prev => [...prev, { id: row.id, team_member_id: row.team_member_id ?? null }])
          if (!row.team_member_id) {
            setCheckedIn(true)
            toast.success('Checked in! Welcome to HTF4 🎉')
            fetchProfile(user.id)
          } else {
            toast.success('A teammate just checked in')
          }
        }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [user, fetchProfile, toast])

  useEffect(() => {
    if (profile?.checked_in) setCheckedIn(true)
  }, [profile?.checked_in])

  // Has the selected member been checked in individually?
  const [myMemberCheckedIn, setMyMemberCheckedIn] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!selectedName || !user) { setMyMemberCheckedIn(false); return }
      const { data: mems } = await supabase
        .from('team_members').select('id, full_name, checked_in').eq('team_id', user.id)
      if (cancelled) return
      const target = normalizeName(selectedName)
      const me = (mems ?? []).find(m => normalizeName(m.full_name) === target)
      setMyMemberCheckedIn(!!me?.checked_in)
    }
    run()
  }, [selectedName, user, memberCheckins])

  async function copy(value, kind) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.info('Copy not available')
    }
  }

  const INFO = [
    { label: 'Team', value: profile?.team_name },
    { label: 'Code', value: teamCode, mono: true },
    ...(selectedName ? [{ label: 'You', value: selectedName }] : []),
  ]

  const showCheckedIn = selectedName ? myMemberCheckedIn : checkedIn

  return (
    <div className="px-4 sm:px-6 pt-6 pb-6 flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="bg-surface-variant border-4 border-black w-10 h-10 flex items-center justify-center font-headline font-black text-lg drop-block rounded-xl active:scale-95 flex-shrink-0"
        >
          ←
        </button>
        <div>
          <h1 className="font-headline font-black text-2xl uppercase italic leading-none text-white">Check-in QR</h1>
          <p className="font-body font-bold text-xs text-on-surface-variant text-white">
            {showCheckedIn ? 'You are checked in — details below' : 'Show this to a volunteer at the entrance'}
          </p>
        </div>
      </div>

      {/* Member picker */}
      {roster.length > 0 && (
        <div className="bg-surface border-4 border-black rounded-3xl overflow-hidden">
          <div className="bg-tertiary-container px-4 py-3 border-b-4 border-black flex items-center justify-between">
            <p className="font-headline font-black text-base uppercase italic text-on-tertiary-container">
              Who Are You?
            </p>
            {selectedName && (
              <button
                onClick={clearMember}
                className="font-headline font-black text-[10px] uppercase italic bg-white border-2 border-black px-2 py-0.5 rounded-lg active:scale-95"
              >
                Change
              </button>
            )}
          </div>
          {!selectedName ? (
            <ul>
              {roster.map((name, i) => (
                <li key={name} className={i < roster.length - 1 ? 'border-b-4 border-black' : ''}>
                  <button
                    onClick={() => chooseMember(name)}
                    className="w-full text-left px-4 py-3 font-body font-bold text-on-surface active:bg-surface-container"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3">
              <p className="font-body font-bold text-sm text-on-surface">
                <span className="text-outline">Generating a QR for </span>
                <span className="text-black">{selectedName}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* QR */}
      <div className="bg-surface border-4 border-black p-5 drop-block rounded-3xl flex flex-col items-center gap-3">
        <div className="bg-primary-container border-4 border-black p-3 rounded-2xl">
          <QRCodeSVG value={qrPayload} size={240} bgColor="#fddc00" fgColor="#383833" level="M" className="sm:!w-72 sm:!h-72" />
        </div>
        <p className="font-body font-bold text-xs text-on-surface-variant text-center">
          {selectedName
            ? 'This QR is unique to you — matches your NFC sticker'
            : roster.length > 0
              ? 'Pick your name above to get a personal QR'
              : 'A volunteer will scan this to check you in'}
        </p>
      </div>

      {/* Info rows */}
      <div className="bg-surface border-4 border-black rounded-3xl overflow-hidden">
        {INFO.map(({ label, value, mono }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${i < INFO.length - 1 ? 'border-b-4 border-black' : ''}`}
          >
            <span className="font-headline font-black uppercase italic text-xs text-outline tracking-widest flex-shrink-0">
              {label}
            </span>
            <span className={`font-body font-bold text-on-surface text-right ${mono ? 'font-mono tracking-wider' : ''}`}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Status + Wi-Fi reveal */}
      {showCheckedIn ? (
        <>
          <div className="bg-primary-container border-4 border-black py-5 px-6 rounded-2xl drop-block text-center">
            <p className="font-headline font-black text-2xl uppercase italic text-on-primary-container">✓ You&apos;re In!</p>
            {profile?.checked_in_at && (
              <p className="font-body font-bold text-sm text-on-primary-container opacity-70 mt-1">
                Checked in at{' '}
                {new Date(profile.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="bg-surface border-4 border-black rounded-3xl overflow-hidden drop-block">
            <div className="bg-tertiary-container px-4 py-3 border-b-4 border-black">
              <p className="font-headline font-black text-base uppercase italic text-on-tertiary-container">
                📶 Event Wi-Fi
              </p>
            </div>
            <button
              onClick={() => copy(WIFI_SSID, 'ssid')}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 border-b-4 border-black active:bg-surface-container text-left"
            >
              <span className="font-headline font-black uppercase italic text-xs text-outline tracking-widest">SSID</span>
              <span className="font-body font-bold font-mono tracking-wider text-on-surface">
                {WIFI_SSID} <span className="text-xs text-outline ml-1">{copied === 'ssid' ? '✓' : '⧉'}</span>
              </span>
            </button>
            <button
              onClick={() => copy(WIFI_PASSWORD, 'pwd')}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 active:bg-surface-container text-left"
            >
              <span className="font-headline font-black uppercase italic text-xs text-outline tracking-widest">Password</span>
              <span className="font-body font-bold font-mono tracking-wider text-on-surface flex items-center gap-2">
                {revealPwd ? WIFI_PASSWORD : '••••••••••'}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setRevealPwd(v => !v) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setRevealPwd(v => !v) } }}
                  className="text-xs text-primary underline"
                >
                  {revealPwd ? 'hide' : 'show'}
                </span>
                <span className="text-xs text-outline">{copied === 'pwd' ? '✓' : '⧉'}</span>
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="bg-surface-variant border-4 border-black py-4 px-5 rounded-2xl text-center">
          <p className="font-headline font-black text-base uppercase italic text-on-surface">
            Waiting for volunteer…
          </p>
          <p className="font-body font-bold text-xs text-on-surface-variant mt-1">
            The Wi-Fi details will appear here the moment you&apos;re checked in.
          </p>
        </div>
      )}
    </div>
  )
}

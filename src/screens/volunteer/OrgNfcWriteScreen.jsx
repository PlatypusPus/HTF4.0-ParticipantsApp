import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// Stickers use the same format the meal/check-in scanners already accept:
// `htf4:<team_member.id>`. The scanner extracts the UUID and resolves
// everything else from the team_members + profiles tables.
function buildPayload(uuid) {
  return `htf4:${uuid}`
}

function useNfcStatus() {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr', msg: '' }
  if (!window.isSecureContext) return {
    ok: false, reason: 'insecure',
    msg: 'Web NFC needs HTTPS. Use the deployed site or an HTTPS tunnel.',
  }
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isChrome  = /Chrome\/\d+/.test(ua) && !/Edg|SamsungBrowser|Firefox|OPR/i.test(ua)
  if (!isAndroid) return { ok: false, reason: 'platform', msg: 'Web NFC only works on Android.' }
  if (!isChrome)  return { ok: false, reason: 'browser',  msg: 'Open this page in Chrome for Android.' }
  if (!('NDEFReader' in window)) return {
    ok: false, reason: 'api',
    msg: 'Your Chrome build does not expose Web NFC.',
  }
  return { ok: true, reason: 'ok', msg: '' }
}

export default function OrgNfcWriteScreen() {
  const toast = useToast()
  const nfc = useNfcStatus()

  const [organizers, setOrganizers] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [writing, setWriting]       = useState(false)
  const [written, setWritten]       = useState(() => new Set())
  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: prof } = await supabase
        .from('profiles').select('id').eq('team_code', 'ORG').maybeSingle()
      if (!prof) {
        if (!cancelled) { setOrganizers([]); setLoading(false) }
        return
      }
      const { data } = await supabase
        .from('team_members').select('id, full_name')
        .eq('team_id', prof.id).order('full_name')
      if (!cancelled) { setOrganizers(data ?? []); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return organizers
    return organizers.filter(o => o.full_name.toLowerCase().includes(q))
  }, [organizers, search])

  async function handleWrite() {
    if (!selected) { toast.error('Pick an organizer first'); return }
    if (!nfc.ok)   { toast.error(nfc.msg || 'Web NFC unavailable'); return }

    setWriting(true)
    try {
      const writer = new window.NDEFReader()
      const ac = new AbortController()
      abortRef.current = ac
      await writer.write(
        { records: [{ recordType: 'text', data: buildPayload(selected.id) }] },
        { signal: ac.signal },
      )
      toast.success(`✓ Wrote ${selected.full_name}`)
      if (navigator.vibrate) navigator.vibrate(80)
      setWritten(prev => {
        const next = new Set(prev); next.add(selected.id); return next
      })
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast.error(e?.message ?? 'Write failed — keep the sticker on the phone back')
      }
    } finally {
      abortRef.current = null
      setWriting(false)
    }
  }

  function cancelWrite() {
    abortRef.current?.abort()
    abortRef.current = null
    setWriting(false)
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Organizers NFC</h1>
        <span className="font-body font-bold text-sm text-surface-variant">
          {written.size}/{organizers.length} written
        </span>
      </div>

      {!nfc.ok && (
        <div className="bg-error-container border-4 border-error text-on-error-container p-4 rounded-2xl">
          <p className="font-headline font-black text-sm uppercase italic mb-1">NFC Unavailable</p>
          <p className="font-body font-bold text-xs">{nfc.msg}</p>
        </div>
      )}

      {organizers.length === 0 && (
        <div className="bg-surface-container border-4 border-black p-6 rounded-2xl">
          <p className="font-body font-bold text-on-surface">
            No organizers seeded. Run <span className="font-mono text-primary">supabase/seed_organizers.sql</span>.
          </p>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search organizer name…"
        className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-sm focus:outline-none focus:border-primary rounded-xl"
      />

      {/* Selected preview + write button */}
      <div className="bg-surface border-4 border-black rounded-3xl p-5 drop-block">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-tertiary-container border-4 border-black rounded-2xl flex items-center justify-center font-headline font-black text-2xl text-on-tertiary-container flex-shrink-0">
                {selected.full_name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-primary font-bold text-xs">ORG</p>
                <p className="font-headline font-black text-lg uppercase italic leading-tight truncate text-black">
                  {selected.full_name}
                </p>
              </div>
            </div>

            <div className="bg-surface-container border-2 border-black rounded-xl px-3 py-2 font-mono text-[11px] text-on-surface-variant break-all">
              {buildPayload(selected.id)}
            </div>

            {writing ? (
              <div className="text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary-container rounded-full animate-ping opacity-60" />
                  <div className="relative bg-primary-container border-4 border-black rounded-full w-16 h-16 flex items-center justify-center text-3xl">📡</div>
                </div>
                <p className="font-headline font-black text-base uppercase italic text-black">Tap sticker to phone back</p>
                <button
                  onClick={cancelWrite}
                  className="bg-error-container border-2 border-error text-on-error-container px-5 py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleWrite}
                disabled={!nfc.ok}
                className="w-full bg-primary-container text-on-primary-container border-4 border-black py-3 font-headline font-black text-base uppercase italic drop-block rounded-2xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
              >
                ✎ Write to NFC Sticker
              </button>
            )}
          </div>
        ) : (
          <p className="font-body font-bold text-sm text-on-surface-variant text-center py-3">
            Pick an organizer below to start writing.
          </p>
        )}
      </div>

      {/* List */}
      <div>
        <h2 className="font-headline font-black text-sm uppercase italic mb-3 text-white">
          {filtered.length} organizer{filtered.length === 1 ? '' : 's'}
        </h2>
        <div className="space-y-2">
          {filtered.map(o => {
            const isSel = selected?.id === o.id
            const isDone = written.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o)}
                className={`w-full text-left border-4 border-black px-4 py-3 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.99] ${
                  isSel
                    ? 'bg-primary-container text-on-primary-container drop-block'
                    : 'bg-surface hover:bg-surface-container text-black'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-black text-sm italic truncate uppercase">
                    {o.full_name}
                  </p>
                  <p className={`font-mono text-[10px] ${isSel ? 'opacity-80' : 'text-on-surface-variant'} truncate`}>
                    {o.id}
                  </p>
                </div>
                {isDone && (
                  <span className="bg-tertiary-container border-2 border-black text-on-tertiary-container px-2 py-0.5 font-headline font-black text-[10px] uppercase italic rounded-lg flex-shrink-0">
                    ✓ Done
                  </span>
                )}
              </button>
            )
          })}
          {filtered.length === 0 && organizers.length > 0 && (
            <div className="bg-surface-container border-4 border-black p-6 rounded-2xl text-center">
              <p className="font-body font-bold text-on-surface-variant">No matches</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

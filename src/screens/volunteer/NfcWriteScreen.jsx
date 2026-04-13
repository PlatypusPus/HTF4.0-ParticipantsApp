import { useMemo, useRef, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { NFC_TEAMS } from '../../data/nfcTeams'

// NFC payload format — plain-text NDEF record. Scanners can parse
// `htf4:team=CODE;name=NAME` for team identification.
function buildPayload({ teamCode, name }) {
  return `htf4:team=${teamCode};name=${name}`
}

// Diagnose why Web NFC is unavailable (matches MealScannerScreen's check)
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
    msg: 'Your Chrome build does not expose Web NFC. Update Chrome and enable NFC in Android settings.',
  }
  return { ok: true, reason: 'ok', msg: '' }
}

const CATEGORIES = ['All', 'Cloud', 'Cyberspace', 'Devops', 'OpenIno']

export default function NfcWriteScreen() {
  const toast = useToast()
  const nfc = useNfcStatus()

  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('All')
  const [selected, setSelected]   = useState(null) // { teamCode, name, category }
  const [writing, setWriting]     = useState(false)
  const [written, setWritten]     = useState(() => new Set()) // composite key "CODE|name"
  const abortRef = useRef(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return NFC_TEAMS.filter(r => {
      if (category !== 'All' && r.category !== category) return false
      if (!q) return true
      return (
        r.teamCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      )
    })
  }, [search, category])

  const keyOf = (r) => `${r.teamCode}|${r.name}`

  async function handleWrite() {
    if (!selected) { toast.error('Pick a participant first'); return }
    if (!nfc.ok)   { toast.error(nfc.msg || 'Web NFC unavailable'); return }

    setWriting(true)
    try {
      const writer = new window.NDEFReader()
      const ac = new AbortController()
      abortRef.current = ac

      await writer.write(
        { records: [{ recordType: 'text', data: buildPayload(selected) }] },
        { signal: ac.signal },
      )

      toast.success(`✓ Wrote ${selected.teamCode} · ${selected.name}`)
      if (navigator.vibrate) navigator.vibrate(80)
      setWritten(prev => {
        const next = new Set(prev)
        next.add(keyOf(selected))
        return next
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Write NFC</h1>
        <span className="font-body font-bold text-sm text-surface-variant">
          {written.size}/{NFC_TEAMS.length} written
        </span>
      </div>

      {/* NFC status banner */}
      {!nfc.ok && (
        <div className="bg-error-container border-4 border-error text-on-error-container p-4 rounded-2xl">
          <p className="font-headline font-black text-sm uppercase italic mb-1">NFC Unavailable</p>
          <p className="font-body font-bold text-xs">{nfc.msg}</p>
        </div>
      )}

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`border-4 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic rounded-xl drop-block active:scale-95 ${
              category === c
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface text-black hover:bg-surface-container'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search team code or name…"
        className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-sm focus:outline-none focus:border-primary rounded-xl"
      />

      {/* Selected preview + write button */}
      <div className="bg-surface border-4 border-black rounded-3xl p-5 drop-block">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-primary-container border-4 border-black rounded-2xl flex items-center justify-center font-headline font-black text-2xl text-on-primary-container flex-shrink-0">
                {selected.teamCode[0]}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-primary font-bold text-base">{selected.teamCode}</p>
                <p className="font-headline font-black text-lg uppercase italic leading-tight truncate text-black">
                  {selected.name}
                </p>
                <p className="font-body font-bold text-xs text-on-surface-variant">{selected.category}</p>
              </div>
            </div>

            <div className="bg-surface-container border-2 border-black rounded-xl px-3 py-2 font-mono text-[11px] text-on-surface-variant break-all">
              {buildPayload(selected)}
            </div>

            {writing ? (
              <div className="text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary-container rounded-full animate-ping opacity-60" />
                  <div className="relative bg-primary-container border-4 border-black rounded-full w-16 h-16 flex items-center justify-center text-3xl">
                    📡
                  </div>
                </div>
                <p className="font-headline font-black text-base uppercase italic text-black">
                  Tap sticker to phone back
                </p>
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
            Pick a participant below to start writing.
          </p>
        )}
      </div>

      {/* List */}
      <div>
        <h2 className="font-headline font-black text-sm uppercase italic mb-3 text-white">
          {filtered.length} participant{filtered.length === 1 ? '' : 's'}
        </h2>
        <div className="space-y-2">
          {filtered.map(r => {
            const k = keyOf(r)
            const isSel = selected && keyOf(selected) === k
            const isDone = written.has(k)
            return (
              <button
                key={k}
                onClick={() => setSelected(r)}
                className={`w-full text-left border-4 border-black px-4 py-3 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.99] ${
                  isSel
                    ? 'bg-primary-container text-on-primary-container drop-block'
                    : 'bg-surface hover:bg-surface-container text-black'
                }`}
              >
                <span className={`font-mono font-bold text-sm w-12 flex-shrink-0 ${isSel ? 'text-on-primary-container' : 'text-primary'}`}>
                  {r.teamCode}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-black text-sm italic truncate uppercase">
                    {r.name}
                  </p>
                  <p className={`font-body font-bold text-[11px] ${isSel ? 'opacity-80' : 'text-on-surface-variant'}`}>
                    {r.category}
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
          {filtered.length === 0 && (
            <div className="bg-surface-container border-4 border-black p-6 rounded-2xl text-center">
              <p className="font-body font-bold text-on-surface-variant">No matches</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

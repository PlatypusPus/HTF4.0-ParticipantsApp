import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { searchTracks } from '../../lib/spotify'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const MAX_SONGS = 3
const WINDOW_MS = 5 * 60 * 1000

function fmtDuration(ms) {
  if (!ms) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SongQueueScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const [queue, setQueue] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const debounce = useRef(null)

  useEffect(() => {
    loadQueue()
    const ch = supabase
      .channel('queue_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_queue' }, loadQueue)
      .subscribe()
    const poll = setInterval(loadQueue, 5000)
    const onFocus = () => loadQueue()
    const onVisible = () => { if (document.visibilityState === 'visible') loadQueue() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(ch)
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function loadQueue() {
    const { data } = await supabase
      .from('song_queue')
      .select('*, profiles(team_name)')
      .eq('is_played', false)
      .order('position', { ascending: true })
    if (data) {
      setNowPlaying(data.find(s => s.is_playing) ?? null)
      setQueue(data.filter(s => !s.is_playing))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchTracks(query)) }
      catch (err) { toast.error(err.message ?? 'Search failed') }
      setSearching(false)
    }, 400)
    return () => clearTimeout(debounce.current)
  }, [query, toast])

  async function addToQueue(track) {
    if (!user || addingId) return
    setAddingId(track.id)
    try {
      const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
      const { count } = await supabase
        .from('song_queue').select('*', { count: 'exact', head: true })
        .eq('added_by', user.id).gte('added_at', windowStart)

      if (count >= MAX_SONGS) {
        toast.error(`Max ${MAX_SONGS} songs per 5 min. Cooldown active!`)
        setAddingId(null)
        return
      }

      const { data: last } = await supabase
        .from('song_queue').select('position').order('position', { ascending: false }).limit(1).maybeSingle()

      const { error } = await supabase.from('song_queue').insert({
        spotify_track_id: track.id,
        track_name: track.name,
        artist_name: track.artist,
        album_art: track.albumArt,
        duration_ms: track.durationMs,
        is_explicit: false,
        added_by: user.id,
        position: (last?.position ?? 0) + 1,
      })

      if (error) throw error
      toast.success(`"${track.name}" added!`)
      setShowSearch(false); setQuery(''); setResults([])
    } catch { toast.error('Failed to add song.') }
    setAddingId(null)
  }

  function closeSearch() { setShowSearch(false); setQuery(''); setResults([]) }

  return (
    <div className="px-4 pt-6 pb-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-2xl uppercase italic text-white">Song Queue</h1>
        <button
          onClick={loadQueue}
          className="bg-surface border-2 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic rounded-xl active:scale-95"
        >
          ↻
        </button>
      </div>

      {/* Now Playing */}
      <div className={`border-4 border-black p-4 drop-block rounded-3xl flex items-center gap-3 ${nowPlaying ? 'bg-primary-container' : 'bg-surface-container'}`}>
        {nowPlaying ? (
          <>
            {nowPlaying.album_art && (
              <img src={nowPlaying.album_art} alt="" className="w-14 h-14 border-2 border-black rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-label font-bold text-[10px] uppercase tracking-widest opacity-70 text-on-primary-container">Now Playing</p>
              <p className="font-headline font-black text-base italic truncate text-on-primary-container">{nowPlaying.track_name}</p>
              <p className="font-body font-bold text-sm opacity-80 truncate text-on-primary-container">{nowPlaying.artist_name}</p>
            </div>
            <span className="text-xl animate-wiggle flex-shrink-0">♫</span>
          </>
        ) : (
          <p className="font-body font-bold text-on-surface-variant text-sm w-full text-center py-1">
            Nothing playing right now
          </p>
        )}
      </div>

      {/* Queue list */}
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-black text-lg uppercase italic text-white">Up Next ({queue.length})</h2>
      </div>

      {loading ? (
        <div className="py-8"><LoadingSpinner /></div>
      ) : queue.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-5 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant text-sm">Queue is empty — be the first to add!</p>
        </div>
      ) : (
        <div className="bg-surface border-4 border-black rounded-3xl overflow-hidden">
          {queue.map((song, idx) => (
            <div
              key={song.id}
              className={`flex items-center gap-3 px-3 py-3 ${idx < queue.length - 1 ? 'border-b-4 border-black' : ''}`}
            >
              <span className="font-headline font-black text-lg text-outline w-6 text-center flex-shrink-0">{idx + 1}</span>
              {song.album_art && (
                <img src={song.album_art} alt="" className="w-10 h-10 border-2 border-black rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-headline font-black text-sm italic truncate">{song.track_name}</p>
                <p className="font-body text-xs text-on-surface-variant truncate">{song.artist_name}</p>
              </div>
              <span className="font-mono text-xs text-outline flex-shrink-0">{fmtDuration(song.duration_ms)}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowSearch(true)}
        className="relative hover:z-10 w-full bg-primary-container text-on-primary-container border-4 border-black py-4 font-headline font-black text-xl uppercase italic drop-block rounded-2xl hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95"
      >
        + Add a Song
      </button>

      {/* Search drawer — bottom sheet on mobile, centered dialog on desktop */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6" onClick={closeSearch}>
          <div
            className="bg-surface border-t-4 border-black rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto w-full sm:border-4 sm:rounded-3xl sm:max-w-[400px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline font-black text-xl uppercase italic text-black">Search Songs</h2>
              <button onClick={closeSearch} className="w-9 h-9 flex items-center justify-center font-headline font-black text-xl hover:bg-surface-container rounded-xl">✕</button>
            </div>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Song name or artist..."
              autoFocus
              className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary rounded-xl mb-1"
            />
            <p className="font-body font-bold text-[11px] text-on-surface-variant mb-4">Explicit content filtered out automatically.</p>
            {searching && <div className="py-4"><LoadingSpinner size="sm" /></div>}
            <div className="space-y-2">
              {results.map(track => (
                <div key={track.id} className="bg-surface-container border-4 border-black p-3 rounded-2xl flex items-center gap-3">
                  {track.albumArt && (
                    <img src={track.albumArt} alt="" className="w-10 h-10 border-2 border-black rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-headline font-black text-sm italic truncate">{track.name}</p>
                    <p className="font-body text-xs text-on-surface-variant truncate">{track.artist}</p>
                  </div>
                  <button
                    onClick={() => addToQueue(track)}
                    disabled={!!addingId}
                    className="bg-primary-container border-2 border-black px-3 py-2 font-headline font-black text-sm uppercase italic drop-block rounded-xl flex-shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {addingId === track.id ? '…' : '+'}
                  </button>
                </div>
              ))}
              {!searching && query && results.length === 0 && (
                <p className="text-center font-body font-bold text-sm text-on-surface-variant py-4">No results found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

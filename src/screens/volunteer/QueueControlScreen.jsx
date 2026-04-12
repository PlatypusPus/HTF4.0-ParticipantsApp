import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { useSpotifyPlayer } from '../../contexts/SpotifyPlayerContext'
import { startSpotifyAuth } from '../../lib/spotifyAuth'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function fmt(ms) {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Spotify player card ────────────────────────────────────────────────────────

function PlayerCard() {
  const {
    token, setToken,
    isConnected, connecting,
    currentTrack, isPaused, duration,
    playerState,
    togglePlay, seek, setVolume,
    previous, next, disconnect,
  } = useSpotifyPlayer()

  const [position, setPosition] = useState(0)
  const [volume,   setVol]      = useState(80)

  // Track position — extrapolate from playerState timestamp when playing
  useEffect(() => {
    if (!playerState) { setPosition(0); return }
    setPosition(playerState.position)
    if (playerState.paused) return
    const base  = playerState.position
    const start = Date.now()
    const id    = setInterval(() => setPosition(base + Date.now() - start), 500)
    return () => clearInterval(id)
  }, [playerState])

  function handleSeek(e) {
    const ms = Number(e.target.value)
    setPosition(ms)
    seek(ms)
  }

  function handleVolume(e) {
    const v = Number(e.target.value)
    setVol(v)
    setVolume(v / 100)
  }

  // ── Not connected ────────────────────────────────────────────────────────
  if (!token) return (
    <div className="border-4 border-black rounded-3xl bg-surface p-6 flex flex-col items-center gap-3 text-center">
      <div className="text-4xl">♫</div>
      <h2 className="font-headline font-black text-lg uppercase italic text-black">Spotify Playback</h2>
      <p className="font-body font-bold text-sm text-on-surface-variant max-w-xs">
        Connect your <span className="text-on-surface font-black">Spotify Premium</span> account to play songs directly from the queue.
      </p>
      <button
        onClick={startSpotifyAuth}
        className="bg-primary-container text-on-primary-container border-4 border-black px-6 py-3 font-headline font-black text-sm uppercase italic drop-block rounded-2xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
      >
        Connect Spotify →
      </button>
      <p className="font-body text-xs text-on-surface-variant">
        Add <code className="bg-surface-container px-1 rounded">{window.location.origin}/volunteer/spotify-callback</code> to your Spotify app's Redirect URIs.
      </p>
    </div>
  )

  // ── SDK connecting ───────────────────────────────────────────────────────
  if (!isConnected) return (
    <div className="border-4 border-black rounded-3xl bg-surface p-6 flex flex-col items-center gap-3 text-center">
      <LoadingSpinner />
      <p className="font-body font-bold text-sm text-on-surface-variant">
        {connecting ? 'Initialising Spotify player…' : 'Reconnecting…'}
      </p>
      <button onClick={disconnect} className="font-body text-xs text-on-surface-variant underline">
        Disconnect
      </button>
    </div>
  )

  // ── Player ───────────────────────────────────────────────────────────────
  const art = currentTrack?.album?.images?.[0]?.url
  return (
    <div className="border-4 border-black rounded-3xl bg-surface overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="font-headline font-black text-xs uppercase italic text-on-surface-variant tracking-widest">♫ Spotify Player</span>
        <button
          onClick={disconnect}
          className="font-body text-xs text-on-surface-variant hover:text-error transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div className="px-4 pb-4 flex gap-4 items-center">
        {/* Album art */}
        {art ? (
          <img src={art} alt="" className="w-20 h-20 border-4 border-black rounded-2xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 border-4 border-black rounded-2xl bg-surface-container flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">♫</span>
          </div>
        )}

        {/* Info + controls */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {currentTrack ? (
            <div className="min-w-0">
              <p className="font-headline font-black text-base italic truncate text-black leading-tight">
                {currentTrack.name}
              </p>
              <p className="font-body text-xs text-on-surface-variant truncate">
                {currentTrack.artists?.map(a => a.name).join(', ')}
              </p>
            </div>
          ) : (
            <p className="font-body font-bold text-sm text-on-surface-variant">
              Hit ▶ Play on a song below
            </p>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-outline w-8 flex-shrink-0">{fmt(position)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={position}
              onChange={handleSeek}
              className="flex-1 h-1.5 accent-primary-container cursor-pointer"
            />
            <span className="font-mono text-[10px] text-outline w-8 text-right flex-shrink-0">{fmt(duration)}</span>
          </div>

          {/* Transport + volume */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={previous}
                className="w-8 h-8 flex items-center justify-center font-headline font-black text-base hover:bg-surface-container rounded-lg transition-colors active:scale-90"
              >
                ⏮
              </button>
              <button
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center bg-primary-container border-2 border-black font-headline font-black text-lg drop-block rounded-xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                {isPaused ? '▶' : '⏸'}
              </button>
              <button
                onClick={next}
                className="w-8 h-8 flex items-center justify-center font-headline font-black text-base hover:bg-surface-container rounded-lg transition-colors active:scale-90"
              >
                ⏭
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-outline">🔈</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={handleVolume}
                className="w-20 h-1.5 accent-primary-container cursor-pointer"
              />
              <span className="text-xs text-outline">🔊</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (!ms) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function QueueControlScreen() {
  const toast = useToast()
  const { isConnected, playTrack } = useSpotifyPlayer()
  const [queue,   setQueue]   = useState([])
  const [loading, setLoading] = useState(true)

  const loadQueue = useCallback(async () => {
    const { data } = await supabase
      .from('song_queue')
      .select('*, profiles(full_name)')
      .eq('is_played', false)
      .order('position', { ascending: true })
    if (data) setQueue(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadQueue()
    const ch = supabase
      .channel('admin_queue_ctrl')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_queue' }, loadQueue)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadQueue])

  async function handlePlay(song) {
    // Mark in Supabase
    await supabase.from('song_queue').update({ is_playing: false }).neq('id', song.id)
    const { error } = await supabase.from('song_queue').update({ is_playing: true }).eq('id', song.id)
    if (error) { toast.error('Failed to update queue'); return }
    // Play via SDK if connected
    if (isConnected) await playTrack(song.spotify_track_id)
    toast.success(`Playing "${song.track_name}"`)
  }

  async function markPlayed(song) {
    const { error } = await supabase
      .from('song_queue')
      .update({ is_played: true, is_playing: false })
      .eq('id', song.id)
    if (error) toast.error('Failed'); else toast.success('Marked as played')
  }

  async function removeSong(id) {
    const { error } = await supabase.from('song_queue').delete().eq('id', id)
    if (error) toast.error('Failed to remove'); else toast.success('Removed')
  }

  const nowPlaying = queue.find(s => s.is_playing) ?? null
  const upNext     = queue.filter(s => !s.is_playing)

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Queue Control</h1>
        <span className="font-body font-bold text-sm text-on-surface-variant">{queue.length} tracks</span>
      </div>

      {/* Player */}
      <PlayerCard />

      {/* Queue */}
      {queue.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-8 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Now playing card */}
          {nowPlaying && (
            <div className="border-4 border-black p-4 rounded-2xl bg-primary-container">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-headline font-black text-xl text-outline w-6 flex-shrink-0">♫</span>
                {nowPlaying.album_art && (
                  <img src={nowPlaying.album_art} alt="" className="w-12 h-12 border-2 border-black rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="bg-on-primary-container text-primary-container font-headline font-black text-[10px] uppercase italic px-2 py-0.5 rounded-full">♫ Playing</span>
                  <p className="font-headline font-black text-base italic truncate mt-0.5 text-black">{nowPlaying.track_name}</p>
                  <p className="font-body text-sm text-on-surface-variant">{nowPlaying.artist_name}</p>
                  <p className="font-body text-xs text-outline">{nowPlaying.profiles?.full_name ?? 'Unknown'} · {fmtDuration(nowPlaying.duration_ms)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => markPlayed(nowPlaying)} className="flex-1 bg-surface-variant border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95">✓ Done</button>
                <button onClick={() => removeSong(nowPlaying.id)} className="w-10 bg-error-container border-2 border-error text-on-error-container font-headline font-black text-sm drop-block rounded-xl active:scale-95 flex items-center justify-center">✕</button>
              </div>
            </div>
          )}

          {/* Up next */}
          {upNext.map((song, idx) => (
            <div key={song.id} className="border-4 border-black p-4 rounded-2xl bg-surface">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-headline font-black text-xl text-outline w-6 text-center flex-shrink-0">{idx + 1}</span>
                {song.album_art && (
                  <img src={song.album_art} alt="" className="w-12 h-12 border-2 border-black rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-headline font-black text-base italic truncate text-black">{song.track_name}</p>
                  <p className="font-body text-sm text-on-surface-variant">{song.artist_name}</p>
                  <p className="font-body text-xs text-outline">{song.profiles?.full_name ?? 'Unknown'} · {fmtDuration(song.duration_ms)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handlePlay(song)} className="flex-1 bg-primary-container text-on-primary-container border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95">▶ Play</button>
                <button onClick={() => markPlayed(song)} className="flex-1 bg-surface-variant border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95">✓ Done</button>
                <button onClick={() => removeSong(song.id)} className="w-10 bg-error-container border-2 border-error text-on-error-container font-headline font-black text-sm drop-block rounded-xl active:scale-95 flex items-center justify-center">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

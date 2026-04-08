import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function fmtDuration(ms) {
  if (!ms) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function QueueControlScreen() {
  const toast = useToast()
  const [queue, setQueue] = useState([])
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

  async function setNowPlaying(id) {
    await supabase.from('song_queue').update({ is_playing: false }).neq('id', id)
    const { error } = await supabase.from('song_queue').update({ is_playing: true }).eq('id', id)
    if (error) toast.error('Failed to update'); else toast.success('Now playing updated')
  }

  async function markPlayed(id) {
    const { error } = await supabase.from('song_queue').update({ is_played: true, is_playing: false }).eq('id', id)
    if (error) toast.error('Failed'); else toast.success('Marked as played')
  }

  async function removeSong(id) {
    const { error } = await supabase.from('song_queue').delete().eq('id', id)
    if (error) toast.error('Failed to remove'); else toast.success('Removed')
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-3xl uppercase italic">Queue Control</h1>
        <span className="font-body font-bold text-sm text-on-surface-variant">{queue.length} tracks</span>
      </div>

      {queue.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-8 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((song, idx) => (
            <div
              key={song.id}
              className={`border-4 border-black p-4 rounded-2xl ${song.is_playing ? 'bg-primary-container' : 'bg-surface'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="font-headline font-black text-xl text-outline w-6 flex-shrink-0">{idx + 1}</span>
                {song.album_art && (
                  <img src={song.album_art} alt="" className="w-12 h-12 border-2 border-black rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {song.is_playing && (
                      <span className="bg-on-primary-container text-primary-container font-headline font-black text-[10px] uppercase italic px-2 py-0.5 rounded-full flex-shrink-0">
                        ♫ Playing
                      </span>
                    )}
                    <p className="font-headline font-black text-base italic truncate">{song.track_name}</p>
                  </div>
                  <p className="font-body text-sm text-on-surface-variant">{song.artist_name}</p>
                  <p className="font-body text-xs text-outline">
                    {song.profiles?.full_name ?? 'Unknown'} · {fmtDuration(song.duration_ms)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {!song.is_playing && (
                  <button
                    onClick={() => setNowPlaying(song.id)}
                    className="flex-1 bg-primary-container text-on-primary-container border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
                  >
                    ▶ Play
                  </button>
                )}
                <button
                  onClick={() => markPlayed(song.id)}
                  className="flex-1 bg-surface-variant border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => removeSong(song.id)}
                  className="w-10 bg-error-container border-2 border-error text-on-error-container font-headline font-black text-sm drop-block rounded-xl active:scale-95 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

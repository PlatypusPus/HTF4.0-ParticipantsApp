import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function MediaModerationScreen() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('flagged') // 'flagged' | 'all'

  const loadMedia = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('media_items')
      .select('*, profiles(full_name)')
      .order('uploaded_at', { ascending: false })
    if (tab === 'flagged') q = q.eq('is_flagged', true)
    else q = q.limit(60)
    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [tab])

  useEffect(() => { loadMedia() }, [loadMedia])

  async function deleteItem(item) {
    await supabase.storage.from('event-media').remove([item.storage_path])
    await supabase.from('media_items').delete().eq('id', item.id)
    toast.success('Deleted')
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function clearFlag(id) {
    await supabase.from('media_items').update({ is_flagged: false, flagged_by: null }).eq('id', id)
    toast.success('Flag cleared')
    if (tab === 'flagged') setItems(prev => prev.filter(i => i.id !== id))
    else setItems(prev => prev.map(i => i.id === id ? { ...i, is_flagged: false } : i))
  }

  return (
    <div>
      <h1 className="font-headline font-black text-3xl uppercase italic mb-4 text-white">Media Moderation</h1>

      <div className="flex gap-3 mb-6">
        {[
          { key: 'flagged', label: tab === 'flagged' ? `Flagged (${items.length})` : 'Flagged' },
          { key: 'all',     label: 'All Media' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 border-4 border-black font-headline font-black text-sm uppercase italic rounded-2xl transition-all ${
              tab === t.key ? 'bg-primary-container text-on-primary-container drop-block' : 'bg-surface-variant hover:bg-surface-container'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-8 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">
            {tab === 'flagged' ? 'No flagged content 🎉' : 'No media uploaded yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              className={`border-4 ${item.is_flagged ? 'border-error' : 'border-black'} rounded-2xl overflow-hidden bg-surface`}
            >
              <div className="aspect-square bg-surface-container">
                {item.media_type === 'image' ? (
                  <img src={item.public_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-on-surface">
                    <span className="text-4xl text-surface">▶</span>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <p className="font-body font-bold text-xs text-on-surface-variant truncate">
                  {item.profiles?.full_name ?? 'Unknown'}
                </p>
                <p className="font-body text-[10px] text-outline">
                  {new Date(item.uploaded_at).toLocaleDateString()}
                </p>
                {item.is_flagged && (
                  <span className="inline-block bg-error-container text-on-error-container text-[10px] font-body font-bold px-2 py-0.5 rounded-lg border border-error">
                    Flagged
                  </span>
                )}
                <div className="flex gap-2 pt-1">
                  {item.is_flagged && (
                    <button
                      onClick={() => clearFlag(item.id)}
                      className="flex-1 bg-primary-container border-2 border-black text-on-primary-container font-headline font-black text-[10px] uppercase italic py-1.5 rounded-xl active:scale-95"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => deleteItem(item)}
                    className="flex-1 bg-error-container border-2 border-error text-on-error-container font-headline font-black text-[10px] uppercase italic py-1.5 rounded-xl active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { uploadToCloudinary, isCloudinaryConfigured } from '../../lib/cloudinary'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export default function GalleryScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selected, setSelected] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    loadMedia()
    const ch = supabase
      .channel('gallery_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_items' }, loadMedia)
      .subscribe()
    const poll = setInterval(loadMedia, 15000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [])

  async function loadMedia() {
    const { data } = await supabase
      .from('media_items')
      .select('*, profiles(team_name)')
      .eq('is_approved', true)
      .eq('is_flagged', false)
      .order('uploaded_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''

    if (!isCloudinaryConfigured()) {
      toast.error('Uploads not configured — ask an organizer')
      return
    }
    if (file.size > MAX_FILE_SIZE) { toast.error('File too large (max 50 MB)'); return }
    const isImg = file.type.startsWith('image/')
    const isVid = file.type.startsWith('video/')
    if (!isImg && !isVid) { toast.error('Images and videos only'); return }

    setUploading(true); setProgress(0)

    try {
      const { publicUrl, publicId, mediaType } = await uploadToCloudinary(file, {
        onProgress: (p) => setProgress(Math.max(1, Math.min(95, p))),
      })

      const { data: inserted, error: dbErr } = await supabase.from('media_items').insert({
        uploaded_by:  user.id,
        storage_path: publicId,
        public_url:   publicUrl,
        media_type:   mediaType,
        is_approved:  true,
        is_flagged:   false,
      }).select('*, profiles(team_name)').single()
      if (dbErr) throw dbErr

      if (inserted) {
        setItems(prev => (prev.some(i => i.id === inserted.id) ? prev : [inserted, ...prev]))
      }
      await loadMedia()

      setProgress(100)
      toast.success('Photo shared!')
      setTimeout(() => { setUploading(false); setProgress(0) }, 600)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed. Try again.')
      setUploading(false); setProgress(0)
    }
  }

  async function flagItem(id) {
    if (!user) return
    await supabase.from('media_items').update({ is_flagged: true, flagged_by: user.id }).eq('id', id)
    toast.info('Content reported')
    setSelected(null)
  }

  return (
    <div className="px-4 pt-6 pb-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline font-black text-2xl uppercase italic text-white">Gallery</h1>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bg-primary-container text-on-primary-container border-4 border-black px-4 py-2 font-headline font-black text-sm uppercase italic drop-block rounded-2xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-60"
        >
          {uploading ? `${progress}%` : '+ Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="border-4 border-black rounded-2xl overflow-hidden h-3 bg-surface-container">
          <div className="h-full bg-primary-container transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="py-12"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-8 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">No photos yet. Be the first!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="aspect-square bg-surface-container border-4 border-black rounded-xl overflow-hidden hover:border-primary transition-colors active:scale-95"
            >
              {item.media_type === 'image' ? (
                <img src={item.public_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-on-surface">
                  <span className="text-2xl text-surface">▶</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — fixed to viewport */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 sm:p-12"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-surface border-4 border-black rounded-3xl overflow-hidden w-full max-w-sm drop-block"
            onClick={e => e.stopPropagation()}
          >
            {selected.media_type === 'image' ? (
              <img src={selected.public_url} alt="" className="w-full object-contain max-h-[60vh]" />
            ) : (
              <video src={selected.public_url} controls className="w-full max-h-[60vh]" />
            )}
            <div className="p-4 flex items-center justify-between border-t-4 border-black">
              <div>
                <p className="font-body font-bold text-sm">{selected.profiles?.team_name ?? 'Anonymous'}</p>
                <p className="font-body text-xs text-on-surface-variant">
                  {new Date(selected.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => flagItem(selected.id)}
                className="bg-error-container border-2 border-error text-on-error-container px-3 py-1.5 font-headline font-black text-xs uppercase italic rounded-xl active:scale-95"
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

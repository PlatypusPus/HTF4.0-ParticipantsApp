import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const HELP_TYPES = [
  {
    id: 'medical',
    label: 'Medical',
    icon: '⚕',
    desc: 'First aid or health emergency',
    bg: 'bg-error-container',
    border: 'border-error',
    text: 'text-on-error-container',
  },
  {
    id: 'technical',
    label: 'Technical',
    icon: '⚙',
    desc: 'Laptop, equipment or internet',
    bg: 'bg-tertiary-container',
    border: 'border-black',
    text: 'text-on-tertiary-container',
  },
  {
    id: 'general',
    label: 'General',
    icon: '?',
    desc: 'Directions, questions, anything',
    bg: 'bg-surface-variant',
    border: 'border-black',
    text: 'text-on-surface',
  },
]

async function getLocation() {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000 }
    )
  })
}

export default function HelpScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(null)
  const [sent, setSent] = useState(null)

  async function sendHelp(helpType) {
    if (!user || loading) return
    setLoading(helpType)
    const location = await getLocation()
    const { error } = await supabase.from('help_requests').insert({
      user_id: user.id,
      help_type: helpType,
      notes: notes.trim() || null,
      location_lat: location?.lat ?? null,
      location_lng: location?.lng ?? null,
    })
    if (error) toast.error('Failed to send. Find a volunteer directly.')
    else { setSent(helpType); setNotes('') }
    setLoading(null)
  }

  if (sent) {
    return (
      <div className="px-4 py-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <div className="bg-primary-container border-4 border-black p-8 drop-block rounded-3xl text-center w-full">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="font-headline font-black text-2xl uppercase italic mb-2">Help is Coming!</h2>
          <p className="font-body font-bold text-on-primary-container opacity-80 text-sm mb-6">
            A volunteer has been notified. Stay where you are.
          </p>
          <button
            onClick={() => setSent(null)}
            className="bg-surface border-4 border-black px-6 py-3 font-headline font-black text-base uppercase italic drop-block rounded-2xl active:scale-95 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            Send Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-6 flex flex-col gap-4">
      <div>
        <h1 className="font-headline font-black text-2xl uppercase italic">Get Help</h1>
        <p className="font-body font-bold text-sm text-on-surface-variant mt-0.5">
          Tap a category — a nearby volunteer will be alerted immediately.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {HELP_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => sendHelp(type.id)}
            disabled={!!loading}
            className={`relative hover:z-10 w-full ${type.bg} border-4 ${type.border} ${type.text} p-5 drop-block rounded-3xl text-left hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95 disabled:opacity-60 flex items-center gap-4`}
          >
            <span className="text-4xl leading-none flex-shrink-0">{type.icon}</span>
            <div className="flex-1">
              <h2 className="font-headline font-black text-xl uppercase italic leading-tight">{type.label}</h2>
              <p className="font-body font-bold text-sm opacity-80">{type.desc}</p>
            </div>
            {loading === type.id
              ? <LoadingSpinner size="sm" />
              : <span className="text-xl flex-shrink-0 opacity-60">→</span>
            }
          </button>
        ))}
      </div>

      <div>
        <label className="block font-headline font-black uppercase text-sm mb-1 italic tracking-tight">
          Additional Notes <span className="font-body normal-case not-italic font-normal text-on-surface-variant text-xs">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Describe your situation or location..."
          rows={3}
          className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary rounded-xl resize-none"
        />
        <p className="font-body text-xs text-on-surface-variant mt-1">
          GPS location may be attached if you allow it.
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CheckInScreen() {
  const { user, profile, updateProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const qrPayload = JSON.stringify({
    uid:  user?.id ?? '',
    name: profile?.full_name ?? '',
    team: profile?.team_name ?? '',
    code: profile?.team_code ?? '',
  })

  async function handleCheckIn() {
    if (!user || loading) return
    if (profile?.checked_in) { toast.info('Already checked in!'); return }

    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('checkins').select('id').eq('user_id', user.id).maybeSingle()

      if (existing) {
        await updateProfile({ checked_in: true })
        toast.info('You were already checked in!')
        setLoading(false)
        return
      }

      const { error } = await supabase.from('checkins').insert({ user_id: user.id })
      if (error) throw error

      await updateProfile({ checked_in: true, checked_in_at: new Date().toISOString() })
      toast.success('Checked in! Welcome to HTF4 🎉')
    } catch {
      toast.error('Check-in failed. Please try again.')
    }
    setLoading(false)
  }

  const INFO = [
    { label: 'Name', value: profile?.full_name },
    { label: 'Team', value: profile?.team_name },
    { label: 'Code', value: profile?.team_code, mono: true },
  ]

  return (
    <div className="px-4 pt-6 pb-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="bg-surface-variant border-4 border-black w-10 h-10 flex items-center justify-center font-headline font-black text-lg drop-block rounded-xl active:scale-95 flex-shrink-0"
        >
          ←
        </button>
        <div>
          <h1 className="font-headline font-black text-2xl uppercase italic leading-none">Check-in QR</h1>
          <p className="font-body font-bold text-xs text-on-surface-variant">Show this to a volunteer at the entrance</p>
        </div>
      </div>

      {/* QR */}
      <div className="bg-surface border-4 border-black p-5 drop-block rounded-3xl flex flex-col items-center gap-3">
        <div className="bg-primary-container border-4 border-black p-3 rounded-2xl">
          <QRCodeSVG value={qrPayload} size={200} bgColor="#fddc00" fgColor="#383833" level="M" />
        </div>
        <p className="font-body font-bold text-xs text-on-surface-variant text-center">
          Your unique participant ID is encoded in this QR
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

      {/* Action */}
      {profile?.checked_in ? (
        <div className="bg-primary-container border-4 border-black py-5 px-6 rounded-2xl drop-block text-center">
          <p className="font-headline font-black text-2xl uppercase italic text-on-primary-container">✓ You&apos;re In!</p>
          {profile.checked_in_at && (
            <p className="font-body font-bold text-sm text-on-primary-container opacity-70 mt-1">
              Checked in at{' '}
              {new Date(profile.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="w-full bg-primary-container text-on-primary-container border-4 border-black py-4 font-headline font-black text-xl uppercase italic drop-block rounded-2xl hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Check In Now →'}
        </button>
      )}
    </div>
  )
}

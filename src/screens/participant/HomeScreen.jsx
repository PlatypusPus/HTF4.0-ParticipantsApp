import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../../HackToFuture4.0 Assests/htf4Title.png'

const OPTIONS = [
  {
    to: '/checkin',
    title: 'Check-in QR',
    desc: 'Show your QR at the entrance',
    icon: '⬡',
    bg: 'bg-primary-container',
    text: 'text-on-primary-container',
  },
  {
    to: '/queue',
    title: 'Song Queue',
    desc: 'Add songs to the party playlist',
    icon: '♫',
    bg: 'bg-tertiary-container',
    text: 'text-on-tertiary-container',
  },
  {
    to: '/gallery',
    title: 'Gallery',
    desc: 'Share & browse event moments',
    icon: '⬛',
    bg: 'bg-secondary-container',
    text: 'text-on-secondary-container',
  },
  {
    to: '/help',
    title: 'Get Help',
    desc: 'Medical, technical or general',
    icon: '!',
    bg: 'bg-surface-variant',
    text: 'text-on-surface',
  },
]

export default function HomeScreen() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-6 pb-6 flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <img src={logo} alt="HTF4" className="h-9 w-auto" />
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="bg-tertiary text-white border-2 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
            >
              Admin ↗
            </button>
          )}
          <button
            onClick={signOut}
            className="bg-surface-variant border-2 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
          >
            Out
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-surface border-4 border-black p-4 drop-block rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary-container border-4 border-black rounded-xl flex items-center justify-center font-headline font-black text-xl text-on-primary-container flex-shrink-0">
            {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-black text-lg uppercase italic leading-tight truncate">
              {profile?.full_name ?? 'Participant'}
            </p>
            <p className="font-body font-bold text-sm text-on-surface-variant truncate">
              {profile?.team_name ?? 'No team'}
              {profile?.team_code && (
                <span className="font-mono text-primary"> · {profile.team_code}</span>
              )}
            </p>
          </div>
        </div>

        {profile?.checked_in && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-primary-container border-2 border-black px-3 py-1 rounded-xl">
            <span className="font-headline font-black text-xs uppercase italic text-on-primary-container">✓ Checked In</span>
            {profile.checked_in_at && (
              <span className="font-mono text-[10px] text-on-primary-container opacity-70">
                {new Date(profile.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-2 gap-4">
        {OPTIONS.map(opt => (
          <button
            key={opt.to}
            onClick={() => navigate(opt.to)}
            className={`relative hover:z-10 ${opt.bg} ${opt.text} border-4 border-black p-5 drop-block rounded-3xl text-left hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95`}
          >
            <span className="text-3xl block mb-2">{opt.icon}</span>
            <h2 className="font-headline font-black text-base uppercase italic tracking-tight mb-1 leading-tight">
              {opt.title}
            </h2>
            <p className="font-body font-bold text-xs opacity-80 leading-snug">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

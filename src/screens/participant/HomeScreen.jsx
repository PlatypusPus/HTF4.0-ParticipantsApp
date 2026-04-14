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
    to: '/help',
    title: 'Get Help',
    desc: 'Medical, technical or general',
    icon: '!',
    bg: 'bg-surface-variant',
    text: 'text-on-surface',
  },
]

export default function HomeScreen() {
  const { profile, isVolunteer, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="px-4 sm:px-6 pt-6 pb-6 flex flex-col gap-4 sm:gap-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <img src={logo} alt="HTF4" className="h-9 sm:h-12 w-auto" />
        <div className="flex gap-2">
          {isVolunteer && (
            <button
              onClick={() => navigate('/volunteer')}
              className="bg-tertiary text-white border-2 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
            >
              Volunteer ↗
            </button>
          )}
          <button
            onClick={signOut}
            className="bg-surface-variant border-2 border-black px-3 py-1.5 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-surface border-4 border-black p-4 drop-block rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary-container border-4 border-black rounded-xl flex items-center justify-center font-headline font-black text-xl text-on-primary-container flex-shrink-0">
            {profile?.team_code?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-black text-lg uppercase italic leading-tight truncate">
              {profile?.team_name ?? 'Team'}
            </p>
            <p className="font-body font-bold text-sm text-on-surface-variant truncate">
              {profile?.team_code && (
                <span className="font-mono text-primary">{profile.team_code}</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPTIONS.map(opt => (
          <button
            key={opt.to}
            onClick={() => navigate(opt.to)}
            className={`relative hover:z-10 ${opt.bg} ${opt.text} border-4 border-black p-5 drop-block rounded-3xl text-left hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95 flex items-center gap-4 sm:flex-col sm:items-start sm:gap-3 sm:min-h-[160px]`}
          >
            <span className="text-4xl leading-none flex-shrink-0">{opt.icon}</span>
            <div className="min-w-0">
              <h2 className="font-headline font-black text-lg uppercase italic tracking-tight leading-tight">
                {opt.title}
              </h2>
              <p className="font-body font-bold text-xs opacity-80 leading-snug">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

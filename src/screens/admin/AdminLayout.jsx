import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const TABS = [
  { to: '/admin',          label: 'Overview',  icon: '⬡', end: true },
  { to: '/admin/checkins', label: 'Check-ins', icon: '✓' },
  { to: '/admin/queue',    label: 'Queue',     icon: '♫' },
  { to: '/admin/media',    label: 'Media',     icon: '⬛' },
  { to: '/admin/help',     label: 'Help',      icon: '!' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-on-surface border-b-4 border-black z-50">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-13 py-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary-container border-2 border-black px-2 py-0.5 font-headline font-black text-xs uppercase italic rounded-lg text-on-primary-container">
              Admin
            </span>
            <span className="font-headline font-black text-surface text-base uppercase italic">HTF4 Panel</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/home')}
              className="border-2 border-surface-variant text-surface-variant px-3 py-1 font-headline font-black text-xs uppercase italic rounded-xl"
            >
              ← Participant
            </button>
            <button
              onClick={signOut}
              className="bg-error-container border-2 border-error text-on-error-container px-3 py-1 font-headline font-black text-xs uppercase italic rounded-xl"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Sub-nav */}
        <nav className="max-w-4xl mx-auto flex overflow-x-auto scrollbar-none border-t border-white/10">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 font-headline font-black text-xs uppercase italic tracking-wider transition-colors ${
                  isActive
                    ? 'text-primary-container border-b-2 border-primary-container'
                    : 'text-surface-variant hover:text-surface'
                }`
              }
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  )
}

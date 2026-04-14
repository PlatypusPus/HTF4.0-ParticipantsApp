import { Outlet } from 'react-router-dom'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home',  label: 'Home' },
  { to: '/queue', label: 'Queue' },
  { to: '/help',  label: 'Help' },
]

export default function ParticipantLayout() {
  return (
    /*
     * Mobile  : fills viewport (h-dvh), no padding, no border
     * Desktop : centered 430 px "phone frame" with border + shadow,
     *           24 px margin all around (sm:p-6)
     */
    <div className="h-dvh sm:flex sm:justify-center sm:items-center sm:p-6">
      <div className="
        relative w-full max-w-[430px] h-full
        flex flex-col
        sm:border-4 sm:border-black sm:drop-block sm:rounded-3xl
      ">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain sm:rounded-t-3xl">
          <Outlet />
        </div>

        {/* Bottom navigation — static inside the frame, not fixed to viewport */}
        <nav className="bg-surface border-t-4 border-black flex-shrink-0 safe-area-bottom sm:rounded-b-3xl sm:overflow-hidden">
          <div className="grid grid-cols-3">
            {TABS.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex items-center justify-center py-4 transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface hover:bg-surface-container'
                  }`
                }
              >
                <span className="font-headline font-black text-sm uppercase italic tracking-widest">{tab.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

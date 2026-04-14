import { Outlet, NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home',  label: 'Home' },
  { to: '/queue', label: 'Queue' },
  { to: '/help',  label: 'Help' },
]

export default function ParticipantLayout() {
  return (
    /*
     * Mobile  : fills viewport; bottom tab bar.
     * Desktop : top nav bar, fluid width, content centered at max-w-3xl.
     *           No phone-frame emulation.
     */
    <div className="min-h-dvh flex flex-col">
      {/* Desktop top nav (hidden on mobile) */}
      <nav className="hidden sm:block bg-surface border-b-4 border-black sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="font-headline font-black text-xl uppercase italic tracking-widest">HTF 4.0</span>
          <div className="flex gap-2">
            {TABS.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `px-5 py-2 font-headline font-black text-sm uppercase italic tracking-widest border-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container border-black drop-block'
                      : 'border-transparent text-on-surface hover:bg-surface-container'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto min-h-0 overscroll-contain pb-20 sm:pb-8">
        <div className="max-w-3xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav (hidden on desktop) */}
      <nav className="sm:hidden bg-surface border-t-4 border-black flex-shrink-0 safe-area-bottom fixed bottom-0 inset-x-0 z-30">
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
  )
}

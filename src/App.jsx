import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import LoadingSpinner from './components/ui/LoadingSpinner'
import ParticipantLayout from './components/ParticipantLayout'

// Auth
import AuthScreen from './screens/auth/AuthScreen'

// Participant
import HomeScreen from './screens/participant/HomeScreen'
import CheckInScreen from './screens/participant/CheckInScreen'
import SongQueueScreen from './screens/participant/SongQueueScreen'
import GalleryScreen from './screens/participant/GalleryScreen'
import HelpScreen from './screens/participant/HelpScreen'
import VolunteerWelcomeScreen from './screens/volunteer/VolunteerWelcomeScreen'

// Admin
import AdminLayout from './screens/admin/AdminLayout'
import SpotifyCallbackScreen from './screens/admin/SpotifyCallbackScreen'
import AdminDashboard from './screens/admin/AdminDashboard'
import QueueControlScreen from './screens/admin/QueueControlScreen'
import MediaModerationScreen from './screens/admin/MediaModerationScreen'
import HelpRequestsScreen from './screens/admin/HelpRequestsScreen'
import CheckinMonitorScreen from './screens/admin/CheckinMonitorScreen'

// ─── Route guards ────────────────────────────────────────────────────────────

function MissingProfileScreen() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-surface border-4 border-black p-7 rounded-3xl drop-block">
        <h1 className="font-headline font-black text-2xl uppercase italic">Profile Not Found</h1>
        <p className="font-body font-bold text-sm text-on-surface-variant mt-2">
          Your team profile is missing. Ask an organizer to seed your team account, then log in again.
        </p>
        <button
          onClick={signOut}
          className="mt-5 w-full bg-primary-container text-on-primary-container border-4 border-black py-3 font-headline font-black text-base uppercase italic rounded-2xl drop-block active:scale-95"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function Guard({ children, adminOnly = false, volunteerOnly = false, participantOnly = false }) {
  const { user, loading, isAdmin, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  if (!profile) return <MissingProfileScreen />
  if (adminOnly && !isAdmin) return <Navigate to="/home" replace />
  if (participantOnly && profile?.role === 'volunteer') return <Navigate to="/volunteer" replace />
  if (volunteerOnly && profile?.role !== 'volunteer') {
    if (profile?.role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/home" replace />
  }
  return children
}

// ─── Routes ──────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading, profile } = useAuth()

  if (!loading && user && !profile) {
    return <MissingProfileScreen />
  }

  const defaultPath = user
    ? profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'volunteer'
        ? '/volunteer'
        : '/home'
    : '/auth'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={user ? <Navigate to={defaultPath} replace /> : <AuthScreen />} />

      {/* Participant — all share the phone-frame layout via nested routing */}
      <Route element={<Guard participantOnly><ParticipantLayout /></Guard>}>
        <Route path="/home"    element={<HomeScreen />} />
        <Route path="/checkin" element={<CheckInScreen />} />
        <Route path="/queue"   element={<SongQueueScreen />} />
        <Route path="/gallery" element={<GalleryScreen />} />
        <Route path="/help"    element={<HelpScreen />} />
      </Route>

      {/* Volunteer landing */}
      <Route path="/volunteer" element={<Guard volunteerOnly><VolunteerWelcomeScreen /></Guard>} />

      {/* Spotify OAuth callback — standalone, no layout */}
      <Route path="/admin/spotify-callback" element={<Guard adminOnly><SpotifyCallbackScreen /></Guard>} />

      {/* Admin — full-width layout */}
      <Route path="/admin" element={<Guard adminOnly><AdminLayout /></Guard>}>
        <Route index         element={<AdminDashboard />} />
        <Route path="queue"    element={<QueueControlScreen />} />
        <Route path="media"    element={<MediaModerationScreen />} />
        <Route path="help"     element={<HelpRequestsScreen />} />
        <Route path="checkins" element={<CheckinMonitorScreen />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          {/* Full-screen background layers — sit behind all content */}
          <div
            className="fixed inset-0 pointer-events-none z-[-3]"
            style={{
              backgroundImage: "url('/background.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#0e0e0b',
            }}
          />
          <div className="fixed inset-0 backdrop-blur-lg bg-black/30 pointer-events-none z-[-2]" />
          <div className="fixed inset-0 paper-grain pointer-events-none z-0" />
          <div className="fixed inset-0 halftone-bg pointer-events-none z-0" />

          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

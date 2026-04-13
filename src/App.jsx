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

// Volunteer
import VolunteerLayout from './screens/volunteer/VolunteerLayout'
import SpotifyCallbackScreen from './screens/volunteer/SpotifyCallbackScreen'
import VolunteerDashboard from './screens/volunteer/VolunteerDashboard'
import MealScannerScreen from './screens/volunteer/MealScannerScreen'
import NfcWriteScreen from './screens/volunteer/NfcWriteScreen'
import QueueControlScreen from './screens/volunteer/QueueControlScreen'
import MediaModerationScreen from './screens/volunteer/MediaModerationScreen'
import HelpRequestsScreen from './screens/volunteer/HelpRequestsScreen'
import CheckinMonitorScreen from './screens/volunteer/CheckinMonitorScreen'

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

function Guard({ children, volunteerOnly = false, participantOnly = false }) {
  const { user, loading, profile, isVolunteer } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  if (!profile) return <MissingProfileScreen />
  if (participantOnly && isVolunteer) return <Navigate to="/volunteer" replace />
  if (volunteerOnly && !isVolunteer) return <Navigate to="/home" replace />
  return children
}

// ─── Routes ──────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading, profile } = useAuth()

  if (!loading && user && !profile) {
    return <MissingProfileScreen />
  }

  const defaultPath = user
    ? (profile?.role === 'volunteer' || profile?.role === 'admin' ? '/volunteer' : '/home')
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

      {/* Spotify OAuth callback — standalone, no layout */}
      <Route path="/volunteer/spotify-callback" element={<Guard volunteerOnly><SpotifyCallbackScreen /></Guard>} />

      {/* Volunteer — full-width layout (admins also have access via isVolunteer) */}
      <Route path="/volunteer" element={<Guard volunteerOnly><VolunteerLayout /></Guard>}>
        <Route index            element={<VolunteerDashboard />} />
        <Route path="meals"     element={<MealScannerScreen />} />
        <Route path="nfc-write" element={<NfcWriteScreen />} />
        <Route path="queue"     element={<QueueControlScreen />} />
        <Route path="media"     element={<MediaModerationScreen />} />
        <Route path="help"      element={<HelpRequestsScreen />} />
        <Route path="checkins"  element={<CheckinMonitorScreen />} />
      </Route>

      {/* Back-compat: redirect old /admin/* URLs to /volunteer/* */}
      <Route path="/admin/*" element={<Navigate to="/volunteer" replace />} />

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

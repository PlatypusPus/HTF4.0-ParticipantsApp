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

// Admin
import AdminLayout from './screens/admin/AdminLayout'
import AdminDashboard from './screens/admin/AdminDashboard'
import QueueControlScreen from './screens/admin/QueueControlScreen'
import MediaModerationScreen from './screens/admin/MediaModerationScreen'
import HelpRequestsScreen from './screens/admin/HelpRequestsScreen'
import CheckinMonitorScreen from './screens/admin/CheckinMonitorScreen'

// ─── Route guards ────────────────────────────────────────────────────────────

function Guard({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/home" replace />
  return children
}

// ─── Routes ──────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading } = useAuth()

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
      <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <AuthScreen />} />

      {/* Participant — all share the phone-frame layout via nested routing */}
      <Route element={<Guard><ParticipantLayout /></Guard>}>
        <Route path="/home"    element={<HomeScreen />} />
        <Route path="/checkin" element={<CheckInScreen />} />
        <Route path="/queue"   element={<SongQueueScreen />} />
        <Route path="/gallery" element={<GalleryScreen />} />
        <Route path="/help"    element={<HelpScreen />} />
      </Route>

      {/* Admin — full-width layout */}
      <Route path="/admin" element={<Guard adminOnly><AdminLayout /></Guard>}>
        <Route index         element={<AdminDashboard />} />
        <Route path="queue"    element={<QueueControlScreen />} />
        <Route path="media"    element={<MediaModerationScreen />} />
        <Route path="help"     element={<HelpRequestsScreen />} />
        <Route path="checkins" element={<CheckinMonitorScreen />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={user ? '/home' : '/auth'} replace />} />
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

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../../HackToFuture4.0 Assests/htf4Title.png'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AuthScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await signIn(email.trim(), password.trim())

    if (err) {
      setError('Invalid email or team code. Please check and try again.')
      setLoading(false)
    }
    // On success, AuthContext updates → App redirects automatically
  }

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-surface border-4 border-black p-8 md:p-10 drop-block rounded-3xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Hack to Future 4.0" className="h-auto max-w-[240px]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <h1 className="font-headline font-black text-3xl uppercase italic tracking-tight text-center mb-6">
            Participant Login
          </h1>

          {/* Email */}
          <div>
            <label className="block font-headline font-black uppercase text-sm mb-1 italic tracking-tight">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary transition-colors rounded-xl"
            />
          </div>

          {/* Password = Team Code */}
          <div>
            <label className="block font-headline font-black uppercase text-sm mb-1 italic tracking-tight">
              Team Code
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="e.g. A00"
              required
              autoComplete="current-password"
              className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary transition-colors rounded-xl"
            />
            <p className="font-body text-xs text-on-surface-variant mt-1">
              Your password is your team code provided by the organizer.
            </p>
          </div>

          {error && (
            <p className="font-body font-bold text-sm text-on-error-container bg-error-container border-2 border-error px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container border-4 border-black py-4 font-headline font-black text-xl uppercase italic tracking-wider hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all drop-block active:scale-95 disabled:opacity-60 rounded-2xl flex items-center justify-center gap-3 mt-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Enter Event →'}
          </button>
        </form>
      </div>
    </main>
  )
}

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../../HackToFuture4.0 Assests/htf4Title.png'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ProfileSetupScreen() {
  const { profile, updateProfile } = useAuth()
  const [name, setName] = useState(profile?.full_name === 'Participant' ? '' : (profile?.full_name ?? ''))
  const [teamId, setTeamId] = useState(profile?.team_code ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !teamId.trim()) return
    setSaving(true)
    setError('')

    const code = teamId.trim().toUpperCase()
    const { error: err } = await updateProfile({
      full_name: name.trim(),
      team_id: code,
      team_code: code,
      team_name: `Team ${code}`,
    })

    if (err) { setError(err.message); setSaving(false) }
    // On success AuthContext updates profile → App re-renders to /home
  }

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-surface border-4 border-black p-8 md:p-10 drop-block rounded-3xl">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Hack to Future 4.0" className="h-auto max-w-[200px]" />
        </div>

        <h1 className="font-headline font-black text-2xl uppercase italic tracking-tight text-center mb-1">
          Complete Your Profile
        </h1>
        <p className="font-body font-bold text-sm text-on-surface-variant text-center mb-7">
          Just a couple of details before you join the event.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {[
            { label: 'Full Name', value: name,   setter: setName,   placeholder: 'John Doe',    type: 'text' },
            { label: 'Team ID',   value: teamId, setter: setTeamId, placeholder: 'T-042-ALPHA', type: 'text' },
          ].map(({ label, value, setter, placeholder, type }) => (
            <div key={label}>
              <label className="block font-headline font-black uppercase text-sm mb-1 italic tracking-tight">
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                required
                className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary transition-colors rounded-xl"
              />
            </div>
          ))}

          {error && (
            <p className="font-body font-bold text-sm text-on-error-container bg-error-container border-2 border-error px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary-container text-on-primary-container border-4 border-black py-4 font-headline font-black text-xl uppercase italic tracking-wider hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all drop-block active:scale-95 disabled:opacity-60 rounded-2xl flex items-center justify-center gap-3 mt-2"
          >
            {saving ? <LoadingSpinner size="sm" /> : 'Save & Enter Event →'}
          </button>
        </form>
      </div>
    </main>
  )
}

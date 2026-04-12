import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeCode } from '../../lib/spotifyAuth'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function SpotifyCallbackScreen() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const code = params.get('code')
    const err  = params.get('error')

    if (err || !code) {
      setError(err === 'access_denied' ? 'Spotify access was denied.' : 'Authorization failed.')
      return
    }

    exchangeCode(code)
      .then(() => navigate('/volunteer/queue', { replace: true }))
      .catch(e  => setError(e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="bg-error-container border-4 border-error text-on-error-container p-8 rounded-3xl max-w-sm drop-block text-center">
        <p className="font-headline font-black text-xl uppercase italic mb-4">{error}</p>
        <button onClick={() => navigate('/volunteer/queue')} className="font-body font-bold text-sm underline">
          Back to Queue
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <LoadingSpinner size="lg" />
      <p className="font-body font-bold text-sm text-on-surface-variant">Connecting Spotify…</p>
    </div>
  )
}

// Spotify PKCE OAuth + token storage for the Web Playback SDK
// The volunteer must have a Spotify Premium account to use playback.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const SCOPES = 'streaming user-read-email user-read-private'

const K = {
  at:  'sp_at',   // access token
  rt:  'sp_rt',   // refresh token
  exp: 'sp_exp',  // expiry (epoch ms)
  cv:  'sp_cv',   // PKCE code verifier (sessionStorage)
}

export function getRedirectUri() {
  return `${window.location.origin}/volunteer/spotify-callback`
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function startSpotifyAuth() {
  const verifier  = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  sessionStorage.setItem(K.cv, verifier)

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          getRedirectUri(),
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCode(code) {
  const verifier = sessionStorage.getItem(K.cv)
  sessionStorage.removeItem(K.cv)

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:    CLIENT_ID,
      grant_type:   'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  storeTokens(await res.json())
}

export async function doRefreshToken() {
  const rt = localStorage.getItem(K.rt)
  if (!rt) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: rt,
    }),
  })
  if (!res.ok) { clearSpotifyTokens(); return null }
  const data = await res.json()
  storeTokens(data)
  return data.access_token
}

export function getStoredAccessToken() {
  const token = localStorage.getItem(K.at)
  const exp   = Number(localStorage.getItem(K.exp))
  if (!token || Date.now() > exp) return null
  return token
}

export function clearSpotifyTokens() {
  [K.at, K.rt, K.exp].forEach(k => localStorage.removeItem(k))
}

function storeTokens(data) {
  localStorage.setItem(K.at,  data.access_token)
  if (data.refresh_token) localStorage.setItem(K.rt, data.refresh_token)
  localStorage.setItem(K.exp, Date.now() + (data.expires_in - 60) * 1000)
}

// Supabase Edge Function — upload a file to Google Drive using a Service Account
// Deploy: supabase functions deploy upload-to-drive
// Secrets: GDRIVE_SERVICE_ACCOUNT (full JSON key), GDRIVE_FOLDER_ID

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // --- Parse multipart form data ---
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return json({ error: 'No file provided' }, 400)

    const MAX_MB = 50
    if (file.size > MAX_MB * 1024 * 1024)
      return json({ error: `File exceeds ${MAX_MB} MB limit` }, 400)

    const isImg = file.type.startsWith('image/')
    const isVid = file.type.startsWith('video/')
    if (!isImg && !isVid) return json({ error: 'Images and videos only' }, 400)

    // --- Build Google OAuth2 token via Service Account JWT ---
    const saJson = JSON.parse(Deno.env.get('GDRIVE_SERVICE_ACCOUNT') ?? '{}')
    const folderId = Deno.env.get('GDRIVE_FOLDER_ID') ?? ''

    const token = await getServiceAccountToken(saJson)

    // --- Upload to Google Drive (multipart upload) ---
    const boundary = `htf4_${Date.now()}`
    const metadata = JSON.stringify({ name: `${Date.now()}_${file.name}`, parents: [folderId] })
    const fileBytes = new Uint8Array(await file.arrayBuffer())

    const body = buildMultipart(boundary, metadata, file.type, fileBytes)

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      return json({ error: `Drive upload failed: ${err}` }, 502)
    }

    const { id: fileId } = await uploadRes.json()

    // --- Make file publicly readable ---
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })

    // Use the direct-access thumbnail URL (no auth required for public files)
    const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`

    return json({ fileId, publicUrl, mediaType: isImg ? 'image' : 'video' })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function buildMultipart(
  boundary: string,
  metadata: string,
  mimeType: string,
  fileBytes: Uint8Array
): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = [
    enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    fileBytes,
    enc.encode(`\r\n--${boundary}--`),
  ]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}

async function getServiceAccountToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signingInput = `${header}.${payload}`
  const privateKey = await importRsaKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${arrayToBase64Url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const { access_token } = await res.json()
  return access_token
}

function b64url(str: string): string {
  return arrayToBase64Url(new TextEncoder().encode(str))
}

function arrayToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importRsaKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const binaryStr = atob(pemBody)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

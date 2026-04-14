// Shared parser for NFC/QR payloads used across the app.
//
// Two formats in the wild:
//   htf4:team=CODE;name=FULL NAME     ← NfcWriteScreen (per-team-member stickers)
//   htf4:<uuid>                        ← OrgNfcWriteScreen (organizer stickers)
//
// Callers also pass raw UUIDs or the legacy JSON QR ({ uid, code, ... }).

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function parsePayload(raw) {
  if (!raw) return { uuid: null, teamCode: null, name: null }
  const text = String(raw).trim()

  // 1) JSON QR (legacy CheckInScreen format)
  try {
    const obj = JSON.parse(text)
    const uuid = typeof obj?.uid === 'string' ? obj.uid.match(UUID_RE)?.[0] ?? null : null
    const code = typeof obj?.code === 'string' ? obj.code.toUpperCase() : null
    const name = typeof obj?.name === 'string' ? obj.name.trim() : null
    if (uuid || code || name) return { uuid, teamCode: code, name }
  } catch { /* not json */ }

  // 2) htf4:key=value;key=value
  const body = text.replace(/^htf4:/i, '')
  if (body.includes('=')) {
    const obj = {}
    for (const part of body.split(';')) {
      const [k, ...rest] = part.split('=')
      if (k) obj[k.trim().toLowerCase()] = rest.join('=').trim()
    }
    if (obj.team || obj.name) {
      return {
        uuid: null,
        teamCode: obj.team ? obj.team.toUpperCase() : null,
        name: obj.name || null,
      }
    }
  }

  // 3) Bare UUID (or htf4:<uuid>)
  const m = body.match(UUID_RE) ?? text.match(UUID_RE)
  if (m) return { uuid: m[0], teamCode: null, name: null }

  return { uuid: null, teamCode: null, name: null }
}

export function buildMemberPayload(teamCode, name) {
  return `htf4:team=${teamCode};name=${name}`
}

export function normalizeName(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

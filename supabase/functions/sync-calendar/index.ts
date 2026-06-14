// supabase/functions/sync-calendar/index.ts
//
// Syncs DayLog calendar events to Apple Calendar (iCloud) over CalDAV.
//
// Accepts: { action: 'add' | 'delete', event: {...} }
//   - add:    event = the row from `events` table (title, date, time, end_date,
//             notes, reminder_minutes, id, ...)
//   - delete: event = { apple_uid } where apple_uid is the CalDAV resource URL
//             returned from a previous 'add'
//
// Returns: { success: boolean, uid?: string, error?: string }
//
// Apple credentials are read from Edge Function secrets — never from the client:
//   supabase secrets set APPLE_ID=you@icloud.com APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APPLE_ID = Deno.env.get('APPLE_ID')
const APPLE_APP_PASSWORD = Deno.env.get('APPLE_APP_PASSWORD')
const ROOT = 'https://caldav.icloud.com'

function authHeader(): string {
  return 'Basic ' + btoa(`${APPLE_ID}:${APPLE_APP_PASSWORD}`)
}

// fetch with manual redirect handling — iCloud redirects discovery requests to a
// per-account host (pXX-caldav.icloud.com), and the standard fetch redirect
// follower strips Authorization on cross-origin redirects.
async function davFetch(url: string, init: RequestInit): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> || {}), Authorization: authHeader() }
  let res = await fetch(url, { ...init, headers, redirect: 'manual' })
  let hops = 0
  while ([301, 302, 307, 308].includes(res.status) && hops < 5) {
    const loc = res.headers.get('Location')
    if (!loc) break
    url = new URL(loc, url).toString()
    res = await fetch(url, { ...init, headers, redirect: 'manual' })
    hops++
  }
  return res
}

function extractHref(xml: string, tag: string): string | null {
  const re = new RegExp(`<[^>]*${tag}[^>]*>[\\s\\S]*?<[^>]*href[^>]*>([^<]+)</[^>]*href>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

// Walks PROPFIND discovery: principal -> calendar-home-set -> first writable VEVENT calendar.
async function discoverCalendarUrl(): Promise<string> {
  const principalRes = await davFetch(`${ROOT}/`, {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
  })
  const principalXml = await principalRes.text()
  const principalHref = extractHref(principalXml, 'current-user-principal')
  if (!principalHref) throw new Error('CalDAV: could not discover principal')

  const homeRes = await davFetch(new URL(principalHref, principalRes.url).toString(), {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-home-set/></D:prop></D:propfind>`,
  })
  const homeXml = await homeRes.text()
  const homeHref = extractHref(homeXml, 'calendar-home-set')
  if (!homeHref) throw new Error('CalDAV: could not discover calendar home')
  const homeUrl = new URL(homeHref, homeRes.url).toString()

  const listRes = await davFetch(homeUrl, {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:resourcetype/><D:displayname/><C:supported-calendar-component-set/></D:prop></D:propfind>`,
  })
  const listXml = await listRes.text()
  const responses = listXml.match(/<[^:>]*:response[^>]*>[\s\S]*?<\/[^:>]*:response>/gi) || []
  let calHref: string | null = null
  for (const block of responses) {
    if (/resourcetype[^>]*>[\s\S]*?calendar/i.test(block) && /VEVENT/i.test(block)) {
      const m = block.match(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i)
      if (m) { calHref = m[1].trim(); break }
    }
  }
  if (!calHref) throw new Error('CalDAV: no writable calendar found')
  return new URL(calHref, listRes.url).toString()
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function toICSDate(dateStr: string, timeStr?: string | null): string {
  const [y, m, d] = dateStr.split('-')
  if (!timeStr) return `${y}${m}${d}`
  const [h, min] = timeStr.split(':')
  return `${y}${m}${d}T${h}${min}00`
}

function escapeText(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function buildICS(event: Record<string, any>, uid: string): string {
  const isAllDay = !event.time
  const endDate = event.end_date || event.date
  const dtStart = toICSDate(event.date, event.time)
  const dtEnd = isAllDay ? toICSDate(addDays(endDate, 1)) : toICSDate(endDate, event.time)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DayLog//sync-calendar//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    isAllDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
    isAllDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(event.title || 'Untitled')}`,
  ]
  if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
  if (event.reminder_minutes) {
    lines.push('BEGIN:VALARM')
    lines.push(`TRIGGER:-PT${event.reminder_minutes}M`)
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeText(event.title || 'Reminder')}`)
    lines.push('END:VALARM')
  }
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!APPLE_ID || !APPLE_APP_PASSWORD) {
    return json({ success: false, error: 'Apple credentials not configured' })
  }

  try {
    const { action, event } = await req.json()

    if (action === 'add') {
      const calUrl = await discoverCalendarUrl()
      const uid = `${event.id || crypto.randomUUID()}@daylog`
      const ics = buildICS(event, uid)
      const eventUrl = new URL(`${uid}.ics`, calUrl).toString()
      const putRes = await davFetch(eventUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
        body: ics,
      })
      if (!putRes.ok) throw new Error(`CalDAV PUT failed: ${putRes.status}`)
      return json({ success: true, uid: eventUrl })
    }

    if (action === 'delete') {
      const href = event?.apple_uid
      if (!href) return json({ success: true })
      const delRes = await davFetch(href, { method: 'DELETE' })
      if (!delRes.ok && delRes.status !== 404) throw new Error(`CalDAV DELETE failed: ${delRes.status}`)
      return json({ success: true })
    }

    return json({ success: false, error: `Unknown action: ${action}` })
  } catch (e) {
    return json({ success: false, error: String((e as Error)?.message || e) })
  }
})

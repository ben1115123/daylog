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

// iCloud serves WebDAV elements *unprefixed* with a default xmlns
// (`<response xmlns="DAV:">`), not prefixed (`<D:response>`). Every element
// matcher here therefore treats the `ns:` prefix as optional — requiring it is
// what silently broke calendar discovery.
const NS = '(?:[^:>\\s]*:)?'

function elementRe(tag: string, flags = 'i'): RegExp {
  return new RegExp(`<${NS}${tag}[\\s>][\\s\\S]*?</${NS}${tag}>`, flags)
}

function innerOf(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${NS}${tag}[^>]*>([\\s\\S]*?)</${NS}${tag}>`, 'i'))
  return m ? m[1] : null
}

/**
 * Picks the first collection that is a calendar and accepts VEVENTs.
 *
 * Both tests read the *inside* of their own element rather than scanning the
 * whole response block — a block-wide search for "calendar" also hits the
 * caldav namespace URI on unrelated properties, which would let the calendar
 * home itself, or a VTODO-only list, win.
 */
function selectCalendarHref(listXml: string): { href: string | null; blocks: number; considered: unknown[] } {
  const blocks = listXml.match(elementRe('response', 'gi')) || []
  const considered: unknown[] = []
  let href: string | null = null

  for (const block of blocks) {
    const selfHref = block.match(new RegExp(`<${NS}href[^>]*>([^<]+)</${NS}href>`, 'i'))?.[1]?.trim() || null
    const resourcetype = innerOf(block, 'resourcetype') || ''
    const isCalendar = new RegExp(`<${NS}calendar[\\s/>]`, 'i').test(resourcetype)
    // Scheduling collections are calendars too, but they are not for storing events.
    const isSchedulingBox = new RegExp(`<${NS}schedule-(inbox|outbox)`, 'i').test(resourcetype)
    // Absent component set means "no restriction" — treat as VEVENT-capable.
    const comps = innerOf(block, 'supported-calendar-component-set')
    const acceptsEvents = comps === null ? true : /VEVENT/i.test(comps)

    const displayname = innerOf(block, 'displayname')?.trim() || null
    const usable = isCalendar && !isSchedulingBox && acceptsEvents
    considered.push({ href: selfHref, displayname, isCalendar, isSchedulingBox, acceptsEvents, usable })

    if (usable && selfHref && !href) href = selfHref
  }

  return { href, blocks: blocks.length, considered }
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
  const { href: calHref } = selectCalendarHref(listXml)
  if (!calHref) throw new Error('CalDAV: no writable calendar found')
  return new URL(calHref, listRes.url).toString()
}

// Read-only diagnostic. Walks the same PROPFIND chain as discoverCalendarUrl()
// but reports the status and a body excerpt at every hop instead of throwing on
// the first failure, so a credential problem can be told apart from an
// XML-parsing problem. Issues no PUT or DELETE.
async function verifyCalDAV(): Promise<Record<string, unknown>> {
  const steps: Record<string, unknown>[] = []
  const record = async (name: string, res: Response) => {
    const body = await res.text()
    steps.push({
      step: name,
      status: res.status,
      url: res.url,
      wwwAuthenticate: res.headers.get('WWW-Authenticate'),
      bodyExcerpt: body.slice(0, 600),
    })
    return body
  }

  const principalRes = await davFetch(`${ROOT}/`, {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
  })
  const principalXml = await record('principal', principalRes)
  const principalHref = extractHref(principalXml, 'current-user-principal')
  steps.push({ step: 'principal.parsed', href: principalHref })
  if (!principalHref) return { ok: false, failedAt: 'principal', steps }

  const homeRes = await davFetch(new URL(principalHref, principalRes.url).toString(), {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-home-set/></D:prop></D:propfind>`,
  })
  const homeXml = await record('calendar-home-set', homeRes)
  const homeHref = extractHref(homeXml, 'calendar-home-set')
  steps.push({ step: 'calendar-home-set.parsed', href: homeHref })
  if (!homeHref) return { ok: false, failedAt: 'calendar-home-set', steps }

  const listRes = await davFetch(new URL(homeHref, homeRes.url).toString(), {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:resourcetype/><D:displayname/><C:supported-calendar-component-set/></D:prop></D:propfind>`,
  })
  const listXml = await record('calendar-list', listRes)
  const { href: calHref, blocks, considered } = selectCalendarHref(listXml)
  steps.push({ step: 'calendar-list.parsed', responseBlocks: blocks, considered })
  steps.push({ step: 'calendar.selected', href: calHref })
  if (!calHref) return { ok: false, failedAt: 'calendar-select', steps }

  return { ok: true, calendarUrl: new URL(calHref, listRes.url).toString(), steps }
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

    /* Read-only CalDAV diagnostic. Its output includes the iCloud principal
       path and the full calendar list, and the anon key that authorises this
       function ships in the client bundle — so it stays off unless DIAG_TOKEN
       is set as a secret and the caller presents it. */
    if (action === 'verify') {
      const expected = Deno.env.get('DIAG_TOKEN')
      if (!expected || event?.token !== expected) {
        return json({ success: false, error: 'verify is disabled' })
      }
      const result = await verifyCalDAV()
      return json({ success: result.ok === true, ...result })
    }

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

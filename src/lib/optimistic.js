/* ── Reconciliation for optimistically-inserted entries ───────────────
 *
 * The UI shows a provisional row with a temporary id before the Supabase
 * write resolves. This module is the only place that knows how that row is
 * replaced by its real one — and, the part that actually bites, what an UNDO
 * tapped before the write lands should delete.
 *
 * Pure by design: no React, no db, no dates. Everything here is a value in,
 * a new value out, so the undo race is testable without a browser.
 */

let counter = 0

/** A client-side id for a row Supabase has not seen yet. */
export function tempId() {
  return `temp:${Date.now()}:${counter++}`
}

/**
 * True only for ids this module minted. Real ids are Supabase uuids, or —
 * from db.js's offline fallback — numbers; neither is a `temp:` string.
 */
export function isTempId(id) {
  return typeof id === 'string' && id.startsWith('temp:')
}

/** The provisional entry goes to the front, where the newest row belongs. */
export function insertProvisional(list, entry) {
  return [entry, ...list]
}

/**
 * Swap the provisional entry for the real row, in place in the list — the
 * entry must not jump when its id firms up.
 *
 * `pending` is deleted rather than set to undefined: the committed row is
 * spread into React state and cached to localStorage, and a promise-shaped
 * key hanging off a row with no write in flight is a trap for anything
 * downstream that tests `'pending' in entry` or walks Object.keys.
 */
export function commitProvisional(list, id, realRow) {
  return list.map(it => {
    if (it.id !== id) return it
    const { pending, ...rest } = it
    return { ...rest, ...realRow }
  })
}

/** Remove the provisional entry — the write failed, or it was undone. */
export function dropProvisional(list, id) {
  return list.filter(it => it.id !== id)
}

/**
 * The id an UNDO should delete, or null if there is nothing to delete.
 *
 * UNDO can be tapped in the second between the optimistic insert and the
 * write resolving, when the only id we have is a temp one Supabase has never
 * seen. Deleting that would clear the row from the UI and leave the real one
 * orphaned in the database. So: wait for the write, then delete what it
 * actually created.
 *
 * Null is returned, never thrown — this runs inside a tap handler, and an
 * UNDO that throws is worse than one that no-ops. It covers two cases:
 *
 *   1. The write failed, or produced no row. Nothing was created, so nothing
 *      needs deleting. Correct and complete.
 *   2. A temp id arrived with no `pending` attached. That should not happen —
 *      but a provisional entry round-tripped through the localStorage cache
 *      comes back without its promise (JSON drops it), and then we genuinely
 *      cannot know whether a row exists. Null here means "no id to delete",
 *      not "no row exists", so it is warned about rather than passed over.
 */
export async function resolveUndoTarget(entry) {
  if (!entry) return null
  if (!isTempId(entry.id)) return entry.id
  if (!entry.pending) {
    console.warn('[optimistic] undo on a provisional entry with no pending write; a row may be orphaned:', entry.id)
    return null
  }
  try {
    const row = await entry.pending
    return row?.id ?? null
  } catch {
    return null
  }
}

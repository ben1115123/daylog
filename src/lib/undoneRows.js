/* ── Rows an UNDO has removed that the database is still serving ──────
 *
 * The problem this exists for is an ordering one, and it only appears when
 * UNDO is tapped *before* the write resolves — the ~1s window this whole
 * optimistic path was built for.
 *
 * Both continuations wake on the same `pending` promise. The logging flow
 * attached first, so it resumes first: it commits the row, then refetches. That
 * GET goes out while the row is still in the database, because the UNDO's
 * DELETE has not even been issued yet — the UNDO handler is second in the
 * queue. It resumes, drops the row from the list, and issues the DELETE. The
 * GET comes back carrying the row, and the wholesale `setRecent(items)` puts it
 * straight back on screen. Measured on Slow 3G, pre-fix: the row the user had
 * just undone was on screen again from +6.8s to +11.9s after the UNDO tap.
 *
 * So: an id parked here is filtered out of fetch results. The registry is
 * module-level rather than per-component because one entry can appear in more
 * than one list — an event logged from Home shows up in `recent`, in the
 * Upcoming strip and in Calendar's `events` — and each is fed by its own fetch.
 *
 * ── Why fetches are numbered ──
 *
 * The rule that makes this correct is about when a fetch was *issued*, not when
 * it resolved:
 *
 *   A fetch issued before the DELETE settled may be carrying the row and must
 *   not be trusted for it. A fetch issued after the DELETE settled is the
 *   truth — the row is gone if the delete worked, and still there if it did
 *   not.
 *
 * Resolution order cannot stand in for issue order. In the measured trace four
 * request waves were in flight at once and completed out of order; releasing on
 * a timer, or on "the DELETE resolved", or on "our own refetch came back" all
 * leave a window where a slower, older GET lands afterwards and undoes the
 * undo. So every fetch takes a sequence number at issue time via `beginFetch()`
 * and passes it back to `withoutUndone`, and the release records the sequence
 * from which the database is authoritative again. Nothing here depends on
 * elapsed time or completion order.
 *
 * ── Releasing, and a DELETE that fails ──
 *
 * `db.js` swallows delete errors — it flips the app to offline and returns, so
 * the caller cannot tell success from failure. That is why the release is
 * unconditional and the *next* fetch is the arbiter: if the row is still in the
 * database, the first fetch issued after the delete settled returns it and it
 * comes back on screen, which is the truth. Nothing stays hidden on the
 * strength of a delete we only assumed worked.
 */

/* Fetch sequence. Monotonic, per session; the values are only ever compared. */
let seq = 0

/* id -> the lowest fetch sequence allowed to speak for this row.
   `Infinity` while the DELETE is still outstanding: no fetch may.
   Released entries are kept rather than pruned. Pruning would have to prove no
   older fetch is still in flight, which is more bookkeeping than the entry is
   worth: `seq` only grows, so a released entry can never filter anything
   again, and each one is an id string a user had to tap UNDO to create. */
const minSeq = new Map()

/** Take a sequence number for a fetch about to be issued. */
export function beginFetch() {
  return ++seq
}

/** Suppress these ids from every fetch already in flight. Nullish ignored. */
export function markUndone(...ids) {
  for (const id of ids) if (id != null) minSeq.set(id, Infinity)
}

/**
 * Hand authority back to the database from `fetchSeq` onward.
 *
 * Called by the UNDO handler's own refetch — the first fetch issued after the
 * DELETE settled — passing that fetch's own sequence number, so its result
 * counts and every older one still does not.
 */
export function releaseUndone(fetchSeq, ids) {
  for (const id of ids) if (id != null && minSeq.has(id)) minSeq.set(id, fetchSeq)
}

/**
 * A fetched list with the rows this fetch is not entitled to show removed.
 *
 * `fetchSeq` is the number taken when the request went out, which is the whole
 * point — the fetch this guards against was issued before the row was undone
 * and comes back after.
 */
export function withoutUndone(list, fetchSeq) {
  if (minSeq.size === 0 || !Array.isArray(list)) return list
  /* Unmarked rows default to -1 and always pass. A marked row passes only for
     a fetch issued at or after the point the database became authoritative. */
  return list.filter(row => (minSeq.get(row?.id) ?? -1) <= fetchSeq)
}

/** Test seam. Not used by the app. */
export function _resetUndone() {
  minSeq.clear()
  seq = 0
}

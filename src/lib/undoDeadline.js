/* ── A deadline on the optimistic-undo wait ───────────────────────────
 *
 * `resolveUndoTarget` in optimistic.js awaits the in-flight write with no
 * timeout, which is right for a pure module: it has no opinion about how long
 * a user should be kept waiting. This is that opinion, and it lives in the UI
 * layer because only the UI can say what happens when the wait is too long.
 *
 * Without a deadline, a write that never settles — a hung request on a bad
 * connection, exactly the ~1s-tap window this whole mechanism exists for —
 * leaves the UNDO handler parked forever. Whatever the handler was going to do
 * after the await (hide the row, delete the row) never happens, and the user
 * gets no feedback at all.
 *
 * The callers' contract: on `UNDO_TIMED_OUT`, leave the row on screen and say
 * so. A row that is still visible is recoverable — the user can delete it from
 * the list once the write lands. A row hidden from a UI we could not delete
 * from the database is the orphan this task exists to prevent.
 */

import { resolveUndoTarget } from './optimistic.js'

/* Long enough that a genuinely slow write (Slow 3G, ~3-5s) still resolves
   normally; short enough that a hung one does not park the handler forever. */
export const UNDO_DEADLINE_MS = 8000

/** Returned instead of an id when the write has not settled in time. */
export const UNDO_TIMED_OUT = Symbol('undo-timed-out')

/* The one thing every caller must say when it sees `UNDO_TIMED_OUT`. It lives
   here, next to the symbol, because the sentence *is* the contract two
   paragraphs up — the row is still on screen and it is still saving. Kept in
   one place so Home and Calendar cannot drift into describing it differently. */
export const UNDO_STALLED_MSG = 'Still saving — remove it from the list in a moment'

/**
 * `resolveUndoTarget` with a deadline.
 *
 * Resolves to the id to delete, `null` if there is nothing to delete, or
 * `UNDO_TIMED_OUT` if the write has not settled in `UNDO_DEADLINE_MS`.
 */
export async function undoTarget(entry, ms = UNDO_DEADLINE_MS) {
  let timer
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve(UNDO_TIMED_OUT), ms)
  })
  try {
    return await Promise.race([resolveUndoTarget(entry), deadline])
  } finally {
    clearTimeout(timer)
  }
}

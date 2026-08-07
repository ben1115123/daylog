import { describe, it, expect, beforeEach } from 'vitest'
import { beginFetch, markUndone, releaseUndone, withoutUndone, _resetUndone } from './undoneRows.js'

const row = id => ({ id, description: 'x' })

beforeEach(() => _resetUndone())

describe('withoutUndone', () => {
  it('passes everything through when nothing is suppressed', () => {
    const seq = beginFetch()
    const list = [row('a'), row('b')]
    expect(withoutUndone(list, seq)).toBe(list)
  })

  /* The defect this module exists for: the logging flow's refetch goes out
     while the row is still committed, the UNDO marks it a beat later, and the
     response lands carrying a row the user has already undone. */
  it('drops a row marked after the fetch was issued', () => {
    const stale = beginFetch()
    markUndone('temp:1', 'real-id')
    expect(withoutUndone([row('a'), row('real-id')], stale).map(r => r.id)).toEqual(['a'])
  })

  it('shows the row again to the fetch that released it, and to later ones', () => {
    const stale = beginFetch()
    markUndone('real-id')
    const authoritative = beginFetch()
    releaseUndone(authoritative, ['real-id'])
    /* A DELETE that silently failed leaves the row in the database; the fetch
       issued after it settled is the arbiter, and must show it. */
    expect(withoutUndone([row('real-id')], authoritative).map(r => r.id)).toEqual(['real-id'])
    expect(withoutUndone([row('real-id')], beginFetch()).map(r => r.id)).toEqual(['real-id'])
    /* ...but the older one still must not, whenever it happens to land. */
    expect(withoutUndone([row('real-id')], stale)).toEqual([])
  })

  /* Four request waves were in flight at once in the measured trace and
     completed out of order. Suppression keys off issue order, never arrival. */
  it('is decided by issue order, not by which response lands first', () => {
    const older = beginFetch()
    markUndone('real-id')
    const releaseAt = beginFetch()
    releaseUndone(releaseAt, ['real-id'])
    const newer = beginFetch()
    // newer resolves first, then the older stale one
    expect(withoutUndone([row('real-id')], newer).map(r => r.id)).toEqual(['real-id'])
    expect(withoutUndone([row('real-id')], older)).toEqual([])
  })

  it('releases only ids that were marked', () => {
    const stale = beginFetch()
    markUndone('a')
    const seq = beginFetch()
    releaseUndone(seq, ['b'])
    expect(withoutUndone([row('a'), row('b')], stale).map(r => r.id)).toEqual(['b'])
  })

  /* An UNDO on a write that produced no row passes `null` as the real id. */
  it('ignores nullish ids on both sides', () => {
    const stale = beginFetch()
    markUndone(null, undefined, 'temp:1')
    expect(withoutUndone([row('a'), { id: null }, row('temp:1')], stale).map(r => r.id)).toEqual(['a', null])
    expect(() => releaseUndone(beginFetch(), [null, undefined])).not.toThrow()
  })

  it('tolerates a non-array and a holey list', () => {
    const stale = beginFetch()
    markUndone('b')
    expect(withoutUndone(undefined, stale)).toBe(undefined)
    expect(withoutUndone([null, row('b'), row('c')], stale).map(r => r?.id)).toEqual([undefined, 'c'])
  })
})

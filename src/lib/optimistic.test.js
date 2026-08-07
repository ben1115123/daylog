import { describe, it, expect, vi } from 'vitest'
import {
  tempId, isTempId, insertProvisional, commitProvisional, dropProvisional,
  resolveUndoTarget,
} from './optimistic.js'

describe('temp ids', () => {
  it('are recognisable and unique', () => {
    const a = tempId(), b = tempId()
    expect(isTempId(a)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('does not mistake a real uuid for a temp id', () => {
    expect(isTempId('15213098-a9e8-4765-971d-d81cf4cdc781')).toBe(false)
    expect(isTempId(undefined)).toBe(false)
  })

  /* db.addExpense's offline fallback mints `Date.now() + Math.random()` — a
   * number. It is a real (cached) row, so it must not read as provisional. */
  it('does not mistake a numeric offline-fallback id for a temp id', () => {
    expect(isTempId(1786000000000.42)).toBe(false)
  })
})

describe('list reconciliation', () => {
  it('inserts the provisional entry at the front', () => {
    const out = insertProvisional([{ id: 'a' }], { id: 't1' })
    expect(out.map(e => e.id)).toEqual(['t1', 'a'])
  })

  it('does not mutate the list it was given', () => {
    const list = [{ id: 'a' }]
    insertProvisional(list, { id: 't1' })
    dropProvisional(list, 'a')
    commitProvisional(list, 'a', { id: 'real' })
    expect(list.map(e => e.id)).toEqual(['a'])
  })

  it('replaces the provisional entry with the real row, keeping position', () => {
    const list = [{ id: 't1', amount: 10 }, { id: 'a' }]
    const out = commitProvisional(list, 't1', { id: 'real', amount: 10 })
    expect(out.map(e => e.id)).toEqual(['real', 'a'])
    expect(out[0].pending).toBeUndefined()
  })

  /* The committed row gets cached to localStorage and spread into React state.
   * A leftover `pending` key — even holding undefined — is a promise-shaped
   * field on a row that has no write in flight. Remove it, don't blank it. */
  it('removes the pending key entirely rather than blanking it', () => {
    const out = commitProvisional([{ id: 't1', pending: Promise.resolve({}) }], 't1', { id: 'real' })
    expect('pending' in out[0]).toBe(false)
    expect(Object.keys(out[0])).toEqual(['id'])
  })

  it('leaves the list alone when the entry to commit is already gone', () => {
    const list = [{ id: 'a' }]
    expect(commitProvisional(list, 't1', { id: 'real' })).toEqual([{ id: 'a' }])
  })

  it('drops the provisional entry on failure and leaves the rest alone', () => {
    const out = dropProvisional([{ id: 't1' }, { id: 'a' }], 't1')
    expect(out.map(e => e.id)).toEqual(['a'])
  })
})

describe('resolveUndoTarget — UNDO tapped before the write lands', () => {
  it('returns a real id immediately', async () => {
    expect(await resolveUndoTarget({ id: 'real-id' })).toBe('real-id')
  })

  it('waits for the pending write and returns the id it produced', async () => {
    let settle
    const pending = new Promise(res => { settle = res })
    const target = resolveUndoTarget({ id: tempId(), pending })
    settle({ id: 'row-from-supabase' })
    expect(await target).toBe('row-from-supabase')
  })

  it('returns null when the write failed — there is nothing to delete', async () => {
    const pending = Promise.reject(new Error('network'))
    expect(await resolveUndoTarget({ id: tempId(), pending })).toBe(null)
  })

  /* A write that resolves without a row gives us no id to delete either. */
  it('returns null when the write resolved but produced no row', async () => {
    expect(await resolveUndoTarget({ id: tempId(), pending: Promise.resolve(null) })).toBe(null)
    expect(await resolveUndoTarget({ id: tempId(), pending: Promise.resolve({}) })).toBe(null)
  })

  /* The warning is part of this branch's contract, not incidental logging: it
   * is the only signal that a row may have been orphaned. Asserted here so it
   * cannot be dropped silently — and spied so it does not print during a run. */
  it('returns null for a temp id with no pending write, and warns about it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const id = tempId()
      expect(await resolveUndoTarget({ id })).toBe(null)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0].join(' ')).toContain(id)
    } finally {
      warn.mockRestore()
    }
  })

  it('returns null rather than throwing when handed nothing', async () => {
    expect(await resolveUndoTarget(undefined)).toBe(null)
  })
})

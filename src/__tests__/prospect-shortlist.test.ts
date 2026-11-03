import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: Array<[string, unknown[]]> = []
const result = { error: null as null | Error }

function builder() {
  const b: Record<string, unknown> = {}
  for (const m of ['upsert', 'delete', 'not', 'neq', 'select']) {
    b[m] = (...args: unknown[]) => { calls.push([m, args]); return m === 'upsert' || m === 'not' || m === 'neq' ? Promise.resolve(result) : b }
  }
  return b
}
vi.mock('../lib/supabase', () => ({ supabase: { from: () => builder() } }))

import { replaceProspectShortlist } from '../lib/data'

beforeEach(() => { calls.length = 0; result.error = null })

describe('replaceProspectShortlist', () => {
  it('faz upsert dos itens e apaga os que saíram', async () => {
    await replaceProspectShortlist([{ user_login: 'a', data: {} }, { user_login: 'b', data: {} }])
    expect(calls.find(c => c[0] === 'upsert')).toBeTruthy()
    const not = calls.find(c => c[0] === 'not')!
    expect(not[1]).toEqual(['user_login', 'in', '("a","b")'])
  })
  it('lista vazia apaga tudo e não faz upsert', async () => {
    await replaceProspectShortlist([])
    expect(calls.some(c => c[0] === 'upsert')).toBe(false)
    expect(calls.find(c => c[0] === 'neq')![1]).toEqual(['user_login', ''])
  })
  it('propaga erro do banco', async () => {
    result.error = new Error('x')
    await expect(replaceProspectShortlist([{ user_login: 'a', data: {} }])).rejects.toThrow()
  })
})

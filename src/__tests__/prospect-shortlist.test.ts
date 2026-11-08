import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: Array<[string, unknown[]]> = []
const result = { error: null as null | Error }

// Cada chamada encadeada é registrada; o último elo da cadeia devolve o resultado (com ou sem erro).
function builder() {
  const b: Record<string, unknown> = {}
  for (const m of ['upsert', 'delete', 'eq', 'neq']) {
    b[m] = (...args: unknown[]) => { calls.push([m, args]); return m === 'upsert' || m === 'eq' || m === 'neq' ? Promise.resolve(result) : b }
  }
  return b
}
vi.mock('../lib/supabase', () => ({ supabase: { from: () => builder() } }))

import { addProspectRows, deleteProspectRow, clearProspectShortlist } from '../lib/data'

beforeEach(() => { calls.length = 0; result.error = null })

describe('Minha Lista no banco: operações pontuais', () => {
  it('acrescentar grava (upsert) só os itens recebidos e nunca apaga', async () => {
    await addProspectRows([{ user_login: 'a', data: {} }, { user_login: 'b', data: {} }])
    expect(calls.map(c => c[0])).toEqual(['upsert'])
  })

  it('acrescentar lista vazia não faz nada', async () => {
    await addProspectRows([])
    expect(calls).toEqual([])
  })

  it('remover apaga apenas o login pedido', async () => {
    await deleteProspectRow('a')
    expect(calls).toEqual([['delete', []], ['eq', ['user_login', 'a']]])
  })

  it('limpar apaga todos de forma explícita', async () => {
    await clearProspectShortlist()
    expect(calls.map(c => c[0])).toEqual(['delete', 'neq'])
  })

  it('propaga erro do banco em cada operação', async () => {
    result.error = new Error('x')
    await expect(addProspectRows([{ user_login: 'a', data: {} }])).rejects.toThrow()
    await expect(deleteProspectRow('a')).rejects.toThrow()
    await expect(clearProspectShortlist()).rejects.toThrow()
  })
})

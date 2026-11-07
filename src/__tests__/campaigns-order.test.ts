import { describe, it, expect, vi } from 'vitest'

const { calls } = vi.hoisted(() => ({ calls: [] as Array<[string, unknown]> }))
vi.mock('../lib/supabase', () => {
  const q: any = {
    select: () => q,
    order: (col: string, opts: unknown) => { calls.push([col, opts]); return q },
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  }
  return { supabase: { from: () => q } }
})

import { getCampaigns } from '../lib/data'

describe('ordem das campanhas', () => {
  it('mais recentes primeiro pela data de início, com desempate fixo por criação (mais nova primeiro)', async () => {
    await getCampaigns()
    expect(calls).toEqual([['start_date', { ascending: false }], ['created_at', { ascending: false }]])
  })
})

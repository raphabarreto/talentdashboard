import { describe, it, expect, vi, beforeEach } from 'vitest'

// Banco simulado em memória: registra cada operação e permite falhar uma delas.
type Row = Record<string, unknown>
type Table = 'campaigns' | 'campaign_streamers'
const db = vi.hoisted(() => ({
  campaigns: [] as Record<string, unknown>[],
  campaign_streamers: [] as Record<string, unknown>[],
  log: [] as string[],
  failOn: null as string | null, // ex.: 'campaign_streamers.insert'
  nextId: 1,
}))

vi.mock('../lib/supabase', () => {
  const builder = (table: Table) => {
    const state: { op: string; payload?: unknown; filters: Array<(r: Row) => boolean> } = { op: 'select', filters: [] }
    const run = () => {
      const key = `${table}.${state.op}`
      db.log.push(key)
      if (db.failOn === key) return { data: null, error: { message: `falha em ${key}` } }
      const rows = db[table]
      const match = rows.filter(r => state.filters.every(f => f(r)))
      if (state.op === 'insert') {
        const list = (Array.isArray(state.payload) ? state.payload : [state.payload]) as Row[]
        const created = list.map(p => ({ id: `id${db.nextId++}`, ...p }))
        rows.push(...created)
        return { data: created, error: null }
      }
      if (state.op === 'update') { match.forEach(r => Object.assign(r, state.payload)); return { data: match, error: null } }
      if (state.op === 'delete') { db[table] = rows.filter(r => !match.includes(r)); return { data: null, error: null } }
      return { data: match, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: unknown) => { state.op = 'insert'; state.payload = p; return api },
      update: (p: unknown) => { state.op = 'update'; state.payload = p; return api },
      delete: () => { state.op = 'delete'; return api },
      eq: (c: string, v: unknown) => { state.filters.push(r => r[c] === v); return api },
      in: (c: string, v: unknown[]) => { state.filters.push(r => v.includes(r[c])); return api },
      single: () => { const res = run() as { data: Row[] | null; error: unknown }; return Promise.resolve({ data: res.data ? res.data[0] : null, error: res.error }) },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    }
    return api
  }
  return { supabase: { from: (t: Table) => builder(t) } }
})

import { addCampaign, updateCampaign } from '../lib/data'

const base = { company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10, currency: 'USD' as const, payment_date: null }
const sRow = (name: string, st?: 'confirmado') => ({ streamer_name: name, payment: 0, payment_date: null, ...(st ? { contact_status: st } : {}) })
const names = () => db.campaign_streamers.map(r => r.streamer_name)
const statusOf = (n: string) => db.campaign_streamers.find(r => r.streamer_name === n)?.contact_status
const writes = () => db.log.filter(l => l.startsWith('campaign_streamers.') && l !== 'campaign_streamers.select')

beforeEach(() => {
  db.campaigns = [{ id: 'c1', company: 'Acme' }]
  db.campaign_streamers = [
    { id: 's1', campaign_id: 'c1', streamer_name: 'ana', contact_status: 'confirmado' },
    { id: 's2', campaign_id: 'c1', streamer_name: 'bia', contact_status: 'recusado' },
  ]
  db.log = []; db.failOn = null; db.nextId = 1
})

describe('editar campanha: nunca perde participantes', () => {
  it('salvar sem mudar a lista não apaga nem recria ninguém e preserva os status', async () => {
    await updateCampaign('c1', base, [sRow('ana'), sRow('bia')])
    expect(writes()).toEqual([])
    expect(db.campaign_streamers.map(r => r.id)).toEqual(['s1', 's2'])
    expect(statusOf('ana')).toBe('confirmado')
    expect(statusOf('bia')).toBe('recusado')
  })

  it('adicionar e remover: novo entra pendente, quem saiu é removido, o resto fica intacto', async () => {
    await updateCampaign('c1', base, [sRow('ana'), sRow('caio')])
    expect(names().sort()).toEqual(['ana', 'caio'])
    expect(statusOf('caio')).toBe('pendente')
    expect(statusOf('ana')).toBe('confirmado')
  })

  it('falha ao inserir novos: erro é lançado e NADA foi apagado', async () => {
    db.failOn = 'campaign_streamers.insert'
    await expect(updateCampaign('c1', base, [sRow('caio')])).rejects.toMatchObject({ message: expect.stringContaining('insert') })
    expect(names().sort()).toEqual(['ana', 'bia'])
    expect(statusOf('ana')).toBe('confirmado')
  })

  it('falha ao ler a lista atual: erro lançado, nada alterado na lista', async () => {
    db.failOn = 'campaign_streamers.select'
    await expect(updateCampaign('c1', base, [sRow('caio')])).rejects.toBeTruthy()
    expect(names().sort()).toEqual(['ana', 'bia'])
  })

  it('falha ao remover: erro lançado; os novos já entraram e ninguém foi perdido', async () => {
    db.failOn = 'campaign_streamers.delete'
    await expect(updateCampaign('c1', base, [sRow('ana'), sRow('caio')])).rejects.toBeTruthy()
    expect(names().sort()).toEqual(['ana', 'bia', 'caio'])
  })

  it('tentar de novo depois de uma falha conclui sem duplicar ninguém', async () => {
    db.failOn = 'campaign_streamers.delete'
    await expect(updateCampaign('c1', base, [sRow('ana'), sRow('caio')])).rejects.toBeTruthy()
    db.failOn = null
    await updateCampaign('c1', base, [sRow('ana'), sRow('caio')])
    expect(names().sort()).toEqual(['ana', 'caio'])
  })

  it('falha ao atualizar a campanha: lista de participantes nem é tocada', async () => {
    db.failOn = 'campaigns.update'
    await expect(updateCampaign('c1', base, [sRow('zeca')])).rejects.toBeTruthy()
    expect(db.log).not.toContain('campaign_streamers.insert')
    expect(names().sort()).toEqual(['ana', 'bia'])
  })

  it('sem lista (undefined) só atualiza os dados da campanha', async () => {
    await updateCampaign('c1', { company: 'Nova' })
    expect(db.log.some(l => l.startsWith('campaign_streamers'))).toBe(false)
  })

  it('"já confirmados" confirma quem já estava e quem entra', async () => {
    await updateCampaign('c1', base, [sRow('bia', 'confirmado'), sRow('caio', 'confirmado')])
    expect(statusOf('bia')).toBe('confirmado')
    expect(statusOf('caio')).toBe('confirmado')
    expect(names().sort()).toEqual(['bia', 'caio'])
  })
})

describe('criar campanha', () => {
  beforeEach(() => { db.campaigns = []; db.campaign_streamers = [] })

  it('cria a campanha com os streamers', async () => {
    await addCampaign(base, [sRow('ana')])
    expect(db.campaigns).toHaveLength(1)
    expect(db.campaign_streamers).toHaveLength(1)
  })

  it('falha ao gravar streamers: a campanha criada é desfeita (sem campanha vazia/duplicada)', async () => {
    db.failOn = 'campaign_streamers.insert'
    await expect(addCampaign(base, [sRow('ana')])).rejects.toBeTruthy()
    expect(db.campaigns).toHaveLength(0)
  })

  it('se nem o desfazer funciona, o erro avisa claramente que a campanha ficou criada', async () => {
    db.failOn = 'campaign_streamers.insert'
    const orig = db.log.push.bind(db.log)
    db.log.push = (k: string) => { if (k === 'campaigns.delete') db.failOn = 'campaigns.delete'; return orig(k) }
    await expect(addCampaign(base, [sRow('ana')])).rejects.toThrow(/foi criada/)
  })
})

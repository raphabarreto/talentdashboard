import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const m = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }, configurable: true })
  return {
    store: m,
    getProspectShortlist: vi.fn(),
    addProspectRows: vi.fn().mockResolvedValue(undefined),
    deleteProspectRow: vi.fn().mockResolvedValue(undefined),
    clearProspectShortlist: vi.fn().mockResolvedValue(undefined),
    toast: vi.fn(),
  }
})
vi.mock('../lib/data', () => ({ getProspectShortlist: h.getProspectShortlist, addProspectRow: vi.fn(), addProspectRows: h.addProspectRows, deleteProspectRow: h.deleteProspectRow, clearProspectShortlist: h.clearProspectShortlist }))
vi.mock('../utils', () => ({ showToast: h.toast }))

import { shortlist, setShortlist, persistAdded, persistRemoved, loadShortlistFromDb } from '../ui/prospecting/shortlist'

const item = (login: string, added = '2026-01-01T00:00:00.000Z') => ({ user_login: login, user_name: login, viewer_count: 0, game_name: '', email: null, description: '', language: 'pt', added_at: added })
const row = (login: string, added?: string) => ({ user_login: login, data: item(login, added) })
const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks(); h.store.clear(); setShortlist([])
  h.addProspectRows.mockResolvedValue(undefined); h.deleteProspectRow.mockResolvedValue(undefined)
})

describe('Minha Lista: cópia desatualizada no navegador não apaga o banco', () => {
  it('banco indisponível ao abrir + remover um item: só esse item é apagado no banco', async () => {
    setShortlist([item('a'), item('b')]) // cópia local, possivelmente velha
    h.getProspectShortlist.mockRejectedValue(new Error('rede'))
    await loadShortlistFromDb(() => {})
    setShortlist(shortlist.filter(s => s.user_login !== 'a'))
    persistRemoved('a')
    expect(h.deleteProspectRow).toHaveBeenCalledTimes(1)
    expect(h.deleteProspectRow).toHaveBeenCalledWith('a')
    expect(h.clearProspectShortlist).not.toHaveBeenCalled()
  })

  it('acrescentar grava só os novos', () => {
    const novo = item('c', '')
    setShortlist([item('a'), novo])
    persistAdded([novo])
    const sent = h.addProspectRows.mock.calls[0][0]
    expect(sent.map((r: { user_login: string }) => r.user_login)).toEqual(['c'])
    expect(novo.added_at).toBeTruthy()
  })

  it('banco com dados prevalece sobre a cópia do navegador', async () => {
    setShortlist([item('local')])
    h.getProspectShortlist.mockResolvedValue([row('x', '2026-01-01'), row('y', '2026-01-02')])
    const done = vi.fn()
    await loadShortlistFromDb(done)
    expect(shortlist.map(s => s.user_login)).toEqual(['x', 'y'])
    expect(done).toHaveBeenCalled()
    expect(h.clearProspectShortlist).not.toHaveBeenCalled()
  })

  it('banco vazio com lista no navegador: só envia (upsert), sem apagar nada', async () => {
    setShortlist([item('a'), item('b')])
    h.getProspectShortlist.mockResolvedValue([])
    await loadShortlistFromDb(() => {})
    expect(h.addProspectRows).toHaveBeenCalledTimes(1)
    expect(h.deleteProspectRow).not.toHaveBeenCalled()
    expect(h.clearProspectShortlist).not.toHaveBeenCalled()
  })

  it('item adicionado enquanto a lista carrega não se perde quando o banco responde', async () => {
    let resolveDb!: (v: unknown) => void
    h.getProspectShortlist.mockReturnValue(new Promise(r => { resolveDb = r }))
    const loading = loadShortlistFromDb(() => {})
    const novo = item('novo', '2026-02-01')
    shortlist.push(novo); persistAdded([novo])
    resolveDb([row('x', '2026-01-01')])
    await loading
    expect(shortlist.map(s => s.user_login)).toEqual(['x', 'novo'])
  })

  it('item removido enquanto a lista carrega não volta quando o banco responde', async () => {
    let resolveDb!: (v: unknown) => void
    h.getProspectShortlist.mockReturnValue(new Promise(r => { resolveDb = r }))
    setShortlist([item('x')])
    const loading = loadShortlistFromDb(() => {})
    setShortlist([]); persistRemoved('x')
    resolveDb([row('x', '2026-01-01'), row('y', '2026-01-02')])
    await loading
    expect(shortlist.map(s => s.user_login)).toEqual(['y'])
  })

  it('falha ao gravar no banco avisa (tom de erro) e a lista segue no navegador', async () => {
    h.addProspectRows.mockRejectedValue(new Error('rede'))
    const novo = item('c', '')
    setShortlist([novo])
    persistAdded([novo])
    await flush()
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('salva só neste navegador'), 'error')
    expect(JSON.parse(h.store.get('prospectShortlist')!)).toHaveLength(1)
  })
})

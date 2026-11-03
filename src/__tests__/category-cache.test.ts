import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return ls
})

const search = vi.fn()
vi.mock('../lib/twitch', () => ({ searchCategories: (q: string) => search(q), fetchStreamsByGame: vi.fn(), fetchTwitchUser: vi.fn() }))
vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn() }))

import { searchCategoriesCached } from '../ui/prospecting'

const lol = [{ id: '21779', name: 'League of Legends', box_art_url: '' }]

beforeEach(() => { search.mockReset(); store.clear() })

describe('searchCategoriesCached', () => {
  it('buscas simultâneas iguais fazem uma só chamada', async () => {
    search.mockResolvedValue(lol)
    const [a, b] = await Promise.all([searchCategoriesCached('League A'), searchCategoriesCached('league a')])
    expect(a).toEqual(lol); expect(b).toEqual(lol)
    expect(search).toHaveBeenCalledTimes(1)
  })
  it('segunda busca usa o cache sem chamar a API', async () => {
    search.mockResolvedValue(lol)
    await searchCategoriesCached('League B')
    await searchCategoriesCached('League B')
    expect(search).toHaveBeenCalledTimes(1)
  })
  it('grava no localStorage e não grava resultado vazio', async () => {
    search.mockResolvedValueOnce(lol).mockResolvedValueOnce([])
    await searchCategoriesCached('League C')
    await searchCategoriesCached('nada existe')
    const stored = JSON.parse(localStorage.getItem('prospectCategoryCache') || '{}')
    expect(Object.keys(stored)).toEqual(['league c'])
  })
})

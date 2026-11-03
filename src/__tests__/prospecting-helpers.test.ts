import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
})

vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn() }))

import { extractEmail } from '../ui/prospecting/email'
import { formatShortlistForCopy, formatNamesForCampaign } from '../ui/prospecting/shortlist'

const mk = (login: string, name: string, language: string) => ({ user_login: login, user_name: name, viewer_count: 0, game_name: '', email: null, description: '', language })

describe('extractEmail', () => {
  it('encontra o primeiro e-mail no texto', () => {
    expect(extractEmail('contato: ana.silva+tw@mail.com.br ou outro@x.com')).toBe('ana.silva+tw@mail.com.br')
  })
  it('sem e-mail devolve null', () => expect(extractEmail('sem contato aqui')).toBeNull())
})

describe('formatShortlistForCopy', () => {
  it('agrupa por país', () => {
    const out = formatShortlistForCopy([mk('a', 'A', 'pt'), mk('b', 'B', 'es'), mk('c', 'C', 'en')])
    expect(out).toBe('🇧🇷 Brazil\n• A — https://www.twitch.tv/a\n\n🇪🇸 Spain\n• B — https://www.twitch.tv/b\n\n🌐 Others\n• C — https://www.twitch.tv/c')
  })
  it('lista vazia gera texto vazio', () => expect(formatShortlistForCopy([])).toBe(''))
})

describe('formatNamesForCampaign', () => {
  const list = [mk('a', 'Ana', 'pt'), mk('b', 'Bob', 'es'), mk('c', 'Caio', 'pt')]
  it('copia só os marcados, um por linha, na ordem da lista', () => {
    expect(formatNamesForCampaign(list, new Set(['c', 'a']))).toBe('Ana\nCaio')
  })
  it('sem marcados devolve vazio', () => expect(formatNamesForCampaign(list, new Set())).toBe(''))
  it('o texto é aceito pelo cadastro de campanha', async () => {
    const { parseStreamerLines } = await import('../events/campaigns/parse')
    expect(parseStreamerLines(formatNamesForCampaign(list, new Set(['a', 'b'])), false).map(r => r.streamer_name)).toEqual(['Ana', 'Bob'])
  })
})

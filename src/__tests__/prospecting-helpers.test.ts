import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
})

vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn() }))

import { extractEmail } from '../ui/prospecting/email'
import { formatShortlistForCopy } from '../ui/prospecting/shortlist'

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


import { describe, it, expect, vi, beforeEach } from 'vitest'

const { replaceProspectShortlist, confirmAction } = vi.hoisted(() => {
  const m = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }, configurable: true })
  return { replaceProspectShortlist: vi.fn().mockResolvedValue(undefined), confirmAction: vi.fn() }
})

vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn().mockResolvedValue([]), replaceProspectShortlist, addProspectRow: vi.fn() }))
vi.mock('../lib/twitch', () => ({ fetchStreamsByGame: vi.fn(), fetchTwitchUser: vi.fn(), searchCategories: vi.fn() }))
vi.mock('../utils', () => ({ showToast: vi.fn(), confirmAction }))

import { setupProspecting } from '../ui/prospecting'
import { setShortlist, shortlist } from '../ui/prospecting/shortlist'
import { langFlag } from '../ui/prospecting/render'

const item = (login: string) => ({ user_login: login, user_name: login, viewer_count: 0, game_name: 'VALORANT', email: null, description: '', language: 'pt', added_at: '2026-01-01' })

const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(async () => {
  document.body.innerHTML = '<div id="view-prospecting"></div>'
  confirmAction.mockReset()
  setupProspecting()
  await flush() // carga inicial da lista (pode gravar a lista do navegador no banco)
  setShortlist([item('a'), item('b')])
  replaceProspectShortlist.mockClear()
})

describe('Prospecção', () => {
  it('não tem mais o "Só com email"', () => {
    expect(document.getElementById('prospectOnlyEmail')).toBeNull()
  })

  it('"Limpar lista" pede confirmação; cancelando, nada é apagado', async () => {
    confirmAction.mockResolvedValue(false)
    document.getElementById('clearListBtn')!.click()
    await flush()
    expect(confirmAction).toHaveBeenCalledOnce()
    expect(shortlist).toHaveLength(2)
    expect(replaceProspectShortlist).not.toHaveBeenCalled()
  })

  it('"Limpar lista" confirmado apaga a lista', async () => {
    confirmAction.mockResolvedValue(true)
    document.getElementById('clearListBtn')!.click()
    await flush()
    expect(shortlist).toHaveLength(0)
    expect(replaceProspectShortlist).toHaveBeenCalledWith([])
  })

  it('bandeiras usam ícone (não emoji, que vira "BR" no Windows)', () => {
    expect(langFlag('pt')).toContain('fi-br')
    expect(langFlag('es')).toContain('fi-es')
    expect(langFlag('pt-br')).toContain('fi-br')
    expect(langFlag('en')).toContain('>EN<')
    expect(langFlag('')).toContain('>?<')
  })
})

describe('Prospecção: "Adicionar à Minha Lista"', () => {
  it('fica sempre na tela (sem deslocar a página) e só ativa com alguém marcado', async () => {
    const { updateActions } = await import('../ui/prospecting/render')
    const { ps } = await import('../ui/prospecting/state')
    const btn = document.getElementById('addToListBtn') as HTMLButtonElement
    ps.selected.clear()
    updateActions()
    expect(btn.disabled).toBe(true)
    expect(document.getElementById('prospectActions')!.classList.contains('hidden')).toBe(false)
    ps.selected.add('alguem')
    updateActions()
    expect(btn.disabled).toBe(false)
    expect(document.getElementById('prospectSelectedCount')!.textContent).toBe('1')
    ps.selected.clear()
  })
})

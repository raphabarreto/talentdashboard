import { describe, it, expect, vi, beforeEach } from 'vitest'

const { addProspectRow, replaceProspectShortlist } = vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return { addProspectRow: vi.fn(), replaceProspectShortlist: vi.fn() }
})
vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist, addProspectRow }))
vi.mock('../utils', () => ({ showToast: vi.fn() }))

import { prospectFromLookup, addToShortlist, isInShortlist, setShortlist, shortlist } from '../ui/prospecting/shortlist'

const user = { login: 'PaiAlgoz', display_name: 'PaiAlgoz', broadcaster_language: 'pt-br', game_name: 'Just Chatting' }

beforeEach(() => {
  addProspectRow.mockReset().mockResolvedValue(undefined)
  replaceProspectShortlist.mockReset()
  setShortlist([])
})

describe('Consultar na Twitch → Minha Lista', () => {
  it('monta o item com login minúsculo, idioma e categoria', () => {
    const item = prospectFromLookup(user)
    expect(item).toMatchObject({ user_login: 'paialgoz', user_name: 'PaiAlgoz', language: 'pt', game_name: 'Just Chatting', email: null, viewer_count: 0 })
  })

  it('acrescenta só o item novo no banco (nunca regrava/apaga a lista)', async () => {
    setShortlist([{ ...prospectFromLookup({ login: 'outro', display_name: 'Outro' }), added_at: '2026-01-01' }])
    expect(await addToShortlist(prospectFromLookup(user))).toBe('added')
    expect(addProspectRow).toHaveBeenCalledTimes(1)
    expect(addProspectRow.mock.calls[0][0].user_login).toBe('paialgoz')
    expect(replaceProspectShortlist).not.toHaveBeenCalled()
    expect(shortlist.map(s => s.user_login)).toEqual(['outro', 'paialgoz'])
    expect(isInShortlist('PAIALGOZ')).toBe(true)
  })

  it('não duplica quem já está na lista', async () => {
    await addToShortlist(prospectFromLookup(user))
    expect(await addToShortlist(prospectFromLookup(user))).toBe('exists')
    expect(addProspectRow).toHaveBeenCalledTimes(1)
  })

  it('se o banco falhar, não coloca na lista', async () => {
    addProspectRow.mockRejectedValueOnce(new Error('falhou'))
    await expect(addToShortlist(prospectFromLookup(user))).rejects.toThrow('falhou')
    expect(shortlist).toHaveLength(0)
  })
})

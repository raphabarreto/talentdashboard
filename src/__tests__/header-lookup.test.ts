import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  const m = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }, configurable: true })
})

vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn(), addProspectRow: vi.fn() }))
vi.mock('../lib/registration', () => ({ registerStreamer: vi.fn() }))

import { setupLookupModal } from '../events/streamers/lookup'

const ids = ['lookupModal', 'lookupResult', 'lookupError', 'lookupActions', 'closeLookupModalAlt', 'lookupSearchSpinner', 'lookupSearchBtnText', 'lookupShortlistStatus']
let prepare: ReturnType<typeof vi.fn<(name: string) => Promise<never>>>

beforeEach(() => {
  document.body.innerHTML = `
    <input id="headerLookupInput"><input id="other">
    <input id="lookupInput"><button id="lookupSearchBtn"></button>
    ${ids.map(id => `<div id="${id}" class="hidden"></div>`).join('')}`
  prepare = vi.fn<(name: string) => Promise<never>>().mockRejectedValue(new Error('Streamer não encontrado.'))
  setupLookupModal(prepare, { loadData: vi.fn(), renderAll: vi.fn() })
})

const key = (el: EventTarget, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

describe('barra "Consultar streamer na Twitch" no topo', () => {
  it('Enter abre a janela já buscando o nome digitado e limpa a barra', () => {
    const header = document.getElementById('headerLookupInput') as HTMLInputElement
    header.value = '  paialgoz '
    key(header, 'Enter')
    expect(document.getElementById('lookupModal')!.classList.contains('hidden')).toBe(false)
    expect((document.getElementById('lookupInput') as HTMLInputElement).value).toBe('paialgoz')
    expect(prepare).toHaveBeenCalledWith('paialgoz')
    expect(header.value).toBe('')
  })

  it('Enter com a barra vazia não abre nada', () => {
    key(document.getElementById('headerLookupInput')!, 'Enter')
    expect(document.getElementById('lookupModal')!.classList.contains('hidden')).toBe(true)
    expect(prepare).not.toHaveBeenCalled()
  })

  it('"/" leva o cursor para a barra, mas não atrapalha quem digita em outro campo', () => {
    key(document.body, '/')
    expect(document.activeElement?.id).toBe('headerLookupInput')
    const other = document.getElementById('other') as HTMLInputElement
    other.focus()
    key(other, '/')
    expect(document.activeElement?.id).toBe('other')
  })
})

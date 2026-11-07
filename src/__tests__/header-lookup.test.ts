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
    <button id="lookupBar"></button><input id="other">
    <input id="lookupInput"><button id="lookupSearchBtn"></button>
    ${ids.map(id => `<div id="${id}" class="hidden"></div>`).join('')}`
  prepare = vi.fn<(name: string) => Promise<never>>().mockRejectedValue(new Error('Streamer não encontrado.'))
  setupLookupModal(prepare, { loadData: vi.fn(), renderAll: vi.fn() })
})

const key = (el: EventTarget, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
const modalOpen = () => !document.getElementById('lookupModal')!.classList.contains('hidden')

describe('botão "Consultar Streamer"', () => {
  it('abre a janela vazia com o cursor no campo de nome, sem buscar nada', () => {
    ;(document.getElementById('lookupInput') as HTMLInputElement).value = 'antigo'
    document.getElementById('lookupBar')!.click()
    expect(modalOpen()).toBe(true)
    expect((document.getElementById('lookupInput') as HTMLInputElement).value).toBe('')
    expect(document.activeElement?.id).toBe('lookupInput')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('"/" abre a consulta, mas não atrapalha quem digita em outro campo', () => {
    const other = document.getElementById('other') as HTMLInputElement
    other.focus()
    key(other, '/')
    expect(modalOpen()).toBe(false)
    other.blur()
    key(document.body, '/')
    expect(modalOpen()).toBe(true)
    expect(document.activeElement?.id).toBe('lookupInput')
  })
})

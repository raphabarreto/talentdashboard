import { describe, it, expect, beforeEach, vi } from 'vitest'

const confirmAction = vi.fn()
const showToast = vi.fn()
vi.mock('../utils', () => ({ confirmAction: (...a: unknown[]) => confirmAction(...a), showToast: (...a: unknown[]) => showToast(...a) }))

import { setupModals, handleEscape } from '../lib/modals'

const flush = () => new Promise(r => setTimeout(r, 0))
const modal = (id: string) => document.getElementById(id)!

beforeEach(() => {
  confirmAction.mockReset(); showToast.mockReset()
  document.body.innerHTML = `
    <button id="opener">Abrir</button>
    <div id="confirmModal" class="modal hidden"><div></div></div>
    <div id="campaignModal" class="modal hidden"><div><h3>Campanha</h3>
      <input id="company"><button id="saveCampaignBtn">Salvar</button><button id="saveAndAddAnotherBtn">Outra</button></div></div>
    <div id="lookupModal" class="modal hidden"><div><h3>Consultar</h3><input id="lookupInput"><button id="lookupAddBtn">Add</button></div></div>`
  setupModals()
})

const open = async (id: string) => { modal(id).classList.remove('hidden'); await flush() }

describe('Modais: acessibilidade', () => {
  it('ganham role=dialog, aria-modal e aria-labelledby', () => {
    const box = modal('campaignModal').firstElementChild!
    expect(box.getAttribute('role')).toBe('dialog')
    expect(box.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent).toBe('Campanha')
  })

  it('ao abrir, o foco vai para o primeiro campo; ao fechar, volta para o botão de origem', async () => {
    document.getElementById('opener')!.focus()
    await open('lookupModal')
    expect(document.activeElement?.id).toBe('lookupInput')
    modal('lookupModal').classList.add('hidden'); await flush()
    expect(document.activeElement?.id).toBe('opener')
  })

  it('Tab no último elemento volta ao primeiro (foco preso)', async () => {
    await open('lookupModal')
    document.getElementById('lookupAddBtn')!.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('lookupInput')
  })
})

describe('Modais: Esc seguro', () => {
  it('fecha só a janela de cima quando não há nada a perder', async () => {
    await open('lookupModal')
    await handleEscape()
    expect(modal('lookupModal').classList.contains('hidden')).toBe(true)
    expect(confirmAction).not.toHaveBeenCalled()
  })

  it('formulário de Campanha preenchido pede confirmação; cancelando, continua aberto', async () => {
    await open('campaignModal')
    ;(document.getElementById('company') as HTMLInputElement).value = 'OperaGX'
    confirmAction.mockResolvedValue(false)
    await handleEscape()
    expect(confirmAction).toHaveBeenCalledOnce()
    expect(modal('campaignModal').classList.contains('hidden')).toBe(false)
  })

  it('formulário preenchido e confirmado: fecha', async () => {
    await open('campaignModal')
    ;(document.getElementById('company') as HTMLInputElement).value = 'OperaGX'
    confirmAction.mockResolvedValue(true)
    await handleEscape()
    expect(modal('campaignModal').classList.contains('hidden')).toBe(true)
  })

  it('formulário sem alterações fecha direto, sem perguntar', async () => {
    await open('campaignModal')
    await handleEscape()
    expect(confirmAction).not.toHaveBeenCalled()
    expect(modal('campaignModal').classList.contains('hidden')).toBe(true)
  })

  it('não fecha enquanto está gravando (botão de salvar desativado)', async () => {
    await open('campaignModal')
    ;(document.getElementById('saveCampaignBtn') as HTMLButtonElement).disabled = true
    await handleEscape()
    expect(modal('campaignModal').classList.contains('hidden')).toBe(false)
    expect(showToast).toHaveBeenCalled()
  })
})

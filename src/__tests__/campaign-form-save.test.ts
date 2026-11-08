import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  addCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../lib/data', () => ({ addCampaign: h.addCampaign, updateCampaign: h.updateCampaign }))
vi.mock('../lib/logger', () => ({ logError: vi.fn(), setButtonLoading: vi.fn() }))
vi.mock('../utils', async (orig) => ({ ...(await orig<typeof import('../utils')>()), showToast: h.toast, confirmAction: h.confirm }))

import { setupCampaignForm, openEditModal } from '../events/campaigns/form'
import { setCampaigns, setStreamers } from '../state'

const campaign = {
  id: 'c1', company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10,
  currency: 'USD', payment_date: null, created_at: '',
  campaign_streamers: [
    { id: 's1', campaign_id: 'c1', streamer_name: 'ana', payment: 0, payment_date: null, contact_status: 'confirmado' },
    { id: 's2', campaign_id: 'c1', streamer_name: 'bia', payment: 0, payment_date: null, contact_status: 'recusado' },
  ],
} as unknown as Parameters<typeof openEditModal>[0]

const loadData = vi.fn().mockResolvedValue(undefined)
const renderAll = vi.fn()

function mount() {
  document.body.innerHTML = `
    <div id="campaignModal" class="hidden"><h2 id="campaignModalTitle"></h2>
    <form id="campaignForm">
      <input id="companyInput"><input id="startDateInput"><input id="endDateInput">
      <input id="totalReceivedInput"><input id="myCommissionInput">
      <select id="currencyInput"><option value="USD">USD</option><option value="BRL">BRL</option></select>
      <input id="paymentDateInput"><textarea id="campaignStreamersInput"></textarea>
      <div id="streamerSuggestions" class="hidden"></div>
      <input type="checkbox" id="alreadyConfirmedInput"><div id="streamerReview" class="hidden"></div>
      <button type="submit" id="saveCampaignBtn">Salvar</button><button type="submit" id="saveAndAddAnotherBtn">Salvar e Adicionar Outra</button>
    </form><button id="closeCampaignModal"></button></div><button id="openAddCampaignInline"></button>`
}
const field = (id: string) => document.getElementById(id) as HTMLInputElement
const submit = async () => {
  document.getElementById('campaignForm')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
const isOpen = () => !document.getElementById('campaignModal')!.classList.contains('hidden')

beforeEach(() => {
  vi.clearAllMocks()
  mount()
  setCampaigns([campaign]); setStreamers([])
  setupCampaignForm({ loadData, renderAll })
  h.addCampaign.mockResolvedValue(undefined); h.updateCampaign.mockResolvedValue(undefined); h.confirm.mockResolvedValue(true)
})

describe('formulário de campanha: gravação', () => {
  it('editar sem mexer na lista: salva, recarrega os dados e fecha, sem pedir confirmação', async () => {
    openEditModal(campaign)
    await submit()
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.updateCampaign).toHaveBeenCalledTimes(1)
    const [id, , rows] = h.updateCampaign.mock.calls[0]
    expect(id).toBe('c1')
    expect(rows.map((r: { streamer_name: string }) => r.streamer_name)).toEqual(['ana', 'bia'])
    expect(loadData).toHaveBeenCalled()
    expect(isOpen()).toBe(false)
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('atualizada'))
  })

  it('remover alguém da lista pede confirmação; ao recusar, nada é gravado e a janela continua aberta', async () => {
    openEditModal(campaign)
    field('campaignStreamersInput').value = 'ana'
    h.confirm.mockResolvedValue(false)
    await submit()
    expect(h.confirm).toHaveBeenCalledTimes(1)
    expect(h.confirm.mock.calls[0][0]).toContain('bia')
    expect(h.updateCampaign).not.toHaveBeenCalled()
    expect(isOpen()).toBe(true)
  })

  it('remover alguém e confirmar: grava a nova lista', async () => {
    openEditModal(campaign)
    field('campaignStreamersInput').value = 'ana'
    await submit()
    expect(h.updateCampaign).toHaveBeenCalledTimes(1)
    expect(h.updateCampaign.mock.calls[0][2].map((r: { streamer_name: string }) => r.streamer_name)).toEqual(['ana'])
  })

  it('só acrescentar streamers não pede confirmação', async () => {
    openEditModal(campaign)
    field('campaignStreamersInput').value = 'ana\nbia\ncaio'
    await submit()
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.updateCampaign).toHaveBeenCalledTimes(1)
  })

  it('falha ao salvar: mostra erro, NÃO diz que atualizou, NÃO recarrega e mantém a janela aberta com os dados', async () => {
    openEditModal(campaign)
    h.updateCampaign.mockRejectedValue(new Error('rede'))
    await submit()
    expect(h.toast).toHaveBeenCalledWith('Erro ao salvar campanha', 'error')
    expect(h.toast).not.toHaveBeenCalledWith(expect.stringContaining('atualizada'))
    expect(loadData).not.toHaveBeenCalled()
    expect(isOpen()).toBe(true)
    expect(field('campaignStreamersInput').value).toBe('ana\nbia')
  })

  it('nova campanha: grava e fecha; falha mantém a janela aberta', async () => {
    document.getElementById('openAddCampaignInline')!.click()
    field('companyInput').value = 'Nova'; field('startDateInput').value = '2026-02-01'; field('endDateInput').value = '2026-02-28'
    field('campaignStreamersInput').value = 'ana'
    h.addCampaign.mockRejectedValueOnce(new Error('rede'))
    await submit()
    expect(h.toast).toHaveBeenCalledWith('Erro ao salvar campanha', 'error')
    expect(isOpen()).toBe(true)
    await submit()
    expect(h.addCampaign).toHaveBeenCalledTimes(2)
    expect(isOpen()).toBe(false)
  })

  it('validação: datas inválidas bloqueiam o salvamento', async () => {
    document.getElementById('openAddCampaignInline')!.click()
    field('companyInput').value = 'Nova'; field('startDateInput').value = '2026-03-10'; field('endDateInput').value = '2026-03-01'
    await submit()
    expect(h.addCampaign).not.toHaveBeenCalled()
    expect(h.toast).toHaveBeenCalledWith(expect.any(String), 'error')
  })

  it('valores e moeda informados são gravados como digitados (sem conversão automática)', async () => {
    document.getElementById('openAddCampaignInline')!.click()
    field('companyInput').value = 'Nova'; field('startDateInput').value = '2026-02-01'; field('endDateInput').value = '2026-02-28'
    field('totalReceivedInput').value = '1.234,56'; field('myCommissionInput').value = '300,50'
    field('currencyInput').value = 'USD'
    await submit()
    expect(h.addCampaign.mock.calls[0][0]).toMatchObject({ total_received: 1234.56, my_commission: 300.5, currency: 'USD' })
  })
})

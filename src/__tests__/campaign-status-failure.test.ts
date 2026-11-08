import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  updateContactStatus: vi.fn(),
  getStreamers: vi.fn(),
  registerStreamer: vi.fn(),
  prepareStreamerData: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../lib/data', () => ({ updateContactStatus: h.updateContactStatus, getStreamers: h.getStreamers }))
vi.mock('../lib/registration', () => ({ prepareStreamerData: h.prepareStreamerData, registerStreamer: h.registerStreamer }))
vi.mock('../lib/logger', () => ({ logError: vi.fn() }))
vi.mock('../ui/campaigns', () => ({ renderCampaigns: vi.fn(), formatPeriod: () => 'periodo' }))
vi.mock('../utils', async (orig) => ({ ...(await orig<typeof import('../utils')>()), showToast: h.toast }))

import { openDetailsModal, setupDetailsModal } from '../events/campaigns/details'
import { setCampaigns, setStreamers, streamers } from '../state'

const ids = ['detailsTitle', 'detailsPeriod', 'detailsCampaignValue', 'detailsCommission', 'detailsPaymentDate', 'detailsParticipants', 'detailsStreamers']
const campaign = () => ({
  id: 'c1', company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10,
  currency: 'USD', payment_date: null, created_at: '',
  campaign_streamers: [{ id: '1', campaign_id: 'c1', streamer_name: 'ana', payment: 0, payment_date: null, contact_status: 'contatado' }],
}) as unknown as Parameters<typeof openDetailsModal>[0]

const renderAll = vi.fn()
let c: ReturnType<typeof campaign>
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const clickNext = (next: string) => (document.querySelector(`#detailsStreamers [data-id="1"] [data-next="${next}"]`) as HTMLElement).click()
const status = () => c.campaign_streamers![0].contact_status

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = `<div id="campaignDetailsModal" class="hidden">
    ${ids.map(id => `<div id="${id}"></div>`).join('')}
    <div id="detailsFilters"><input id="detailsSearch" value=""></div><p id="detailsEmptyState" class="hidden"></p>
    <button id="closeDetailsModal"></button><button id="closeDetailsX"></button></div>`
  c = campaign(); setCampaigns([c]); setStreamers([])
  setupDetailsModal({ renderAll })
  openDetailsModal(c)
  h.updateContactStatus.mockResolvedValue(undefined)
  h.getStreamers.mockResolvedValue([{ id: 'n', name: 'ana' }])
  h.prepareStreamerData.mockResolvedValue({})
  h.registerStreamer.mockResolvedValue({ lastLiveSaved: true })
})

describe('troca de status do participante', () => {
  it('sucesso: grava e mostra o novo status', async () => {
    clickNext('confirmado'); await flush()
    expect(h.updateContactStatus).toHaveBeenCalledWith('1', 'confirmado')
    expect(status()).toBe('confirmado')
    expect(h.toast).toHaveBeenCalledWith('Status atualizado!')
  })

  it('falha ao gravar: a tela volta ao status que está no banco e avisa o erro', async () => {
    h.updateContactStatus.mockRejectedValue(new Error('rede'))
    clickNext('confirmado'); await flush()
    expect(status()).toBe('contatado')
    expect(h.toast).toHaveBeenCalledWith('Erro ao salvar status', 'error')
    expect(h.toast).not.toHaveBeenCalledWith('Status atualizado!')
    expect(h.registerStreamer).not.toHaveBeenCalled()
    // o botão para confirmar continua disponível (o status exibido é o real)
    expect(document.querySelector('#detailsStreamers [data-id="1"] [data-next="confirmado"]')).not.toBeNull()
  })

  it('confirmar um streamer novo o cadastra e atualiza as outras abas (renderAll)', async () => {
    clickNext('confirmado'); await flush()
    expect(h.registerStreamer).toHaveBeenCalledTimes(1)
    expect(streamers.map(s => s.name)).toEqual(['ana'])
    expect(renderAll).toHaveBeenCalled()
  })

  it('falha no cadastro automático: o status confirmado continua salvo e o usuário é avisado', async () => {
    h.registerStreamer.mockRejectedValue(new Error('twitch'))
    clickNext('confirmado'); await flush()
    expect(status()).toBe('confirmado')
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('não foi possível cadastrar'), 'error')
    expect(renderAll).not.toHaveBeenCalled()
  })
})

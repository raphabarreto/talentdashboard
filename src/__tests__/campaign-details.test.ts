import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/data', () => ({ updateContactStatus: vi.fn(), getStreamers: vi.fn() }))
vi.mock('../lib/registration', () => ({ prepareStreamerData: vi.fn(), registerStreamer: vi.fn() }))
vi.mock('../ui/campaigns', () => ({ renderCampaigns: vi.fn() }))

import { openDetailsModal } from '../events/campaigns/details'

const ids = ['detailsTitle', 'detailsCompany', 'detailsPeriod', 'detailsCampaignValue', 'detailsCommission', 'detailsPaymentDate', 'detailsProgressText', 'detailsStatusChips', 'detailsStreamers']

function mountDom() {
  document.body.innerHTML = `
    ${ids.map(id => `<div id="${id}"></div>`).join('')}
    <div id="detailsProgressBar"></div>
    <input id="detailsSearch" value="">
    <p id="detailsEmptyState" class="hidden"></p>
    <div id="campaignDetailsModal" class="hidden"></div>`
}

const st = (id: string, name: string, contact_status?: string) => ({ id, campaign_id: 'c1', streamer_name: name, payment: 0, payment_date: null, contact_status })
const campaign = (streamers: ReturnType<typeof st>[]) => ({
  id: 'c1', company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10,
  currency: 'USD', payment_date: null, created_at: '', campaign_streamers: streamers,
} as unknown as Parameters<typeof openDetailsModal>[0])

beforeEach(mountDom)

const chipText = () => [...document.querySelectorAll('#detailsStatusChips .status-filter-btn')].map(b => `${b.getAttribute('data-filter')}:${b.textContent?.trim()}`)
const rows = () => [...document.querySelectorAll('#detailsStreamers [data-id]')].map(r => r.textContent!.replace(/\s+/g, ' ').trim())

describe('detalhes da campanha', () => {
  const c = campaign([st('1', 'ana'), st('2', 'bob', 'contatado'), st('3', 'caio', 'confirmado'), st('4', 'dani', 'recusado'), st('5', 'eva', 'pendente')])

  it('mostra todas as etapas com a contagem, mesmo as vazias, e o total', () => {
    openDetailsModal(c)
    expect(chipText()).toEqual([
      'all:5 no total', 'pendente:2 pendentes', 'contatado:1 contatados', 'confirmado:1 confirmados', 'nao_respondeu:0 não respondeu', 'recusado:1 recusados',
    ])
    expect(document.querySelector('[data-filter="nao_respondeu"]')!.className).toContain('opacity-50')
    expect(document.getElementById('detailsProgressText')!.textContent).toBe('3 de 5 já contatados')
  })

  it('abre filtrando os pendentes e mantém as ações de cada etapa', () => {
    openDetailsModal(c)
    expect(rows()).toHaveLength(2)
    const nextOf = (name: string) => [...document.querySelectorAll('#detailsStreamers [data-id]')]
      .find(r => r.textContent!.includes(name))!.querySelectorAll('.quick-status-btn')
    expect([...nextOf('ana')].map(b => b.getAttribute('data-next'))).toEqual(['contatado', 'recusado'])
  })

  it('sem pendentes abre em "no total"; cada linha tem a bolinha de status e a ação de desfazer', () => {
    openDetailsModal(campaign([st('1', 'ana', 'confirmado'), st('2', 'bob', 'recusado')]))
    expect(rows()).toHaveLength(2)
    expect(document.querySelectorAll('#detailsStreamers .rounded-full').length).toBe(2)
    expect(document.querySelector('[data-id="1"] .quick-status-btn')!.getAttribute('data-next')).toBe('pendente')
  })

  it('streamer contatado oferece confirmar, não respondeu e recusar', () => {
    openDetailsModal(campaign([st('1', 'ana', 'contatado')]))
    // abre em "no total" porque não há pendentes
    const next = [...document.querySelectorAll('[data-id="1"] .quick-status-btn')].map(b => b.getAttribute('data-next'))
    expect(next).toEqual(['confirmado', 'nao_respondeu', 'recusado'])
  })
})

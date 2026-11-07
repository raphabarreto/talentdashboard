import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/data', () => ({ updateContactStatus: vi.fn(), getStreamers: vi.fn() }))
vi.mock('../lib/registration', () => ({ prepareStreamerData: vi.fn(), registerStreamer: vi.fn() }))
vi.mock('../ui/campaigns', () => ({ renderCampaigns: vi.fn(), formatPeriod: (a: string, b: string) => `${a}|${b}` }))

import { openDetailsModal, FILTERS_MIN_STREAMERS } from '../events/campaigns/details'

const ids = ['detailsTitle', 'detailsPeriod', 'detailsCampaignValue', 'detailsCommission', 'detailsPaymentDate', 'detailsParticipants', 'detailsStreamers']

function mountDom() {
  document.body.innerHTML = `
    ${ids.map(id => `<div id="${id}"></div>`).join('')}
    <div id="detailsFilters" class="hidden"><input id="detailsSearch" value=""></div>
    <p id="detailsEmptyState" class="hidden"></p>
    <div id="campaignDetailsModal" class="hidden"></div>`
}

const st = (id: string, name: string, contact_status?: string) => ({ id, campaign_id: 'c1', streamer_name: name, payment: 0, payment_date: null, contact_status })
const campaign = (streamers: ReturnType<typeof st>[]) => ({
  id: 'c1', company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10,
  currency: 'USD', payment_date: null, created_at: '', campaign_streamers: streamers,
} as unknown as Parameters<typeof openDetailsModal>[0])
const many = (n: number, status?: string) => Array.from({ length: n }, (_, i) => st(String(i + 1), `s${i + 1}`, status))

beforeEach(mountDom)

const rows = () => [...document.querySelectorAll('#detailsStreamers [data-id]')]
const filtersHidden = () => document.getElementById('detailsFilters')!.classList.contains('hidden')
const nextOf = (id: string) => [...document.querySelectorAll(`#detailsStreamers [data-id="${id}"] .quick-status-btn`)].map(b => b.getAttribute('data-next'))

describe('detalhes da campanha: resumo e cabeçalho', () => {
  it('título, período e os três valores do resumo', () => {
    openDetailsModal(campaign([st('1', 'ana')]))
    expect(document.getElementById('detailsTitle')!.textContent).toBe('Acme')
    expect(document.getElementById('detailsPeriod')!.textContent).toBe('2026-01-01|2026-01-31')
    expect(document.getElementById('detailsCampaignValue')!.textContent).toBe('US$ 100,00')
    expect(document.getElementById('detailsPaymentDate')!.textContent).toBe('Pendente')
  })

  it('não existe mais barra nem texto de progresso', () => {
    openDetailsModal(campaign(many(3, 'contatado')))
    expect(document.getElementById('detailsProgressBar')).toBeNull()
    expect(document.getElementById('detailsProgressText')).toBeNull()
  })

  it('contador só com o número, ao lado do título; escondido com 1 streamer só', () => {
    openDetailsModal(campaign(many(1)))
    expect(document.getElementById('detailsParticipants')!.classList.contains('hidden')).toBe(true)
    expect(filtersHidden()).toBe(true)
    openDetailsModal(campaign(many(2)))
    expect(document.getElementById('detailsParticipants')!.classList.contains('hidden')).toBe(false)
    expect(document.getElementById('detailsParticipants')!.textContent).toBe('2')
  })
})

describe('detalhes da campanha: poucos streamers (janela enxuta)', () => {
  it('sem busca/filtros e com todos os streamers na lista, mesmo com pendentes', () => {
    openDetailsModal(campaign([st('1', 'ana'), st('2', 'bob', 'contatado'), st('3', 'caio', 'confirmado')]))
    expect(filtersHidden()).toBe(true)
    expect(rows()).toHaveLength(3)
  })

  it('cada streamer é um cartão com avatar da inicial, nome, status por escrito com ícone; ações por etapa', () => {
    openDetailsModal(campaign([st('1', 'ana'), st('2', 'bob', 'contatado'), st('3', 'caio', 'confirmado'), st('4', 'dani', 'nao_respondeu')]))
    const text = (id: string) => document.querySelector(`#detailsStreamers [data-id="${id}"]`)!.textContent!.replace(/\s+/g, ' ').trim()
    expect(text('1')).toContain('ana')
    expect(text('1')).toContain('Pendente')
    expect(text('4')).toContain('Não respondeu')
    expect(rows()).toHaveLength(4)
    expect(document.querySelectorAll('#detailsStreamers .rounded-full').length).toBe(4) // avatar redondo em cada cartão
    expect(document.querySelector('#detailsStreamers [data-id="1"] .rounded-full')!.textContent).toBe('A')
    expect(nextOf('1')).toEqual(['contatado', 'recusado'])
    const mark = document.querySelector('#detailsStreamers [data-id="1"] [data-next="contatado"]') as HTMLElement
    expect(mark.textContent!.trim()).toBe('Marcar contato') // ação, não rótulo de status
    expect(mark.querySelector('i')).toBeNull() // sem ícone de avião
    expect(mark.className).not.toContain('amber')
    expect(nextOf('2')).toEqual(['confirmado', 'nao_respondeu', 'recusado'])
    expect(nextOf('3')).toEqual(['pendente']) // reverter status
    expect(document.querySelector('[data-id="3"] .quick-status-btn')!.getAttribute('title')).toBe('Reverter status')
  })
})

describe('detalhes da campanha: muitos streamers (busca e grupos, sem filtros horizontais)', () => {
  const c = campaign([...many(FILTERS_MIN_STREAMERS - 3), st('a', 'x', 'contatado'), st('b', 'y', 'confirmado'), st('c', 'z', 'recusado')])

  it('a busca aparece e não existe mais a barra de filtros por status', () => {
    openDetailsModal(c)
    expect(filtersHidden()).toBe(false)
    expect(document.getElementById('detailsStatusChips')).toBeNull()
    expect(document.querySelector('.status-filter-btn')).toBeNull()
  })

  it('abre sempre agrupado (tudo recolhido), mesmo com pendentes', () => {
    openDetailsModal(c)
    expect(document.querySelectorAll('#detailsStreamers .group-toggle').length).toBeGreaterThan(0)
    expect(rows()).toHaveLength(0)
  })

  it('30 streamers: lista vertical de uma coluna (grupos recolhidos)', () => {
    openDetailsModal(campaign(many(30, 'contatado')))
    expect(document.querySelector('[data-group="contatado"]')!.textContent).toContain('30')
    expect(document.getElementById('detailsParticipants')!.textContent).toBe('30')
    expect(document.getElementById('detailsStreamers')!.className).not.toContain('grid')
  })
})

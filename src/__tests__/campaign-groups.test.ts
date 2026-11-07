import { describe, it, expect, vi, beforeEach } from 'vitest'

const { updateContactStatus } = vi.hoisted(() => ({ updateContactStatus: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/data', () => ({ updateContactStatus, getStreamers: vi.fn() }))
vi.mock('../lib/registration', () => ({ prepareStreamerData: vi.fn(), registerStreamer: vi.fn() }))
vi.mock('../ui/campaigns', () => ({ renderCampaigns: vi.fn(), formatPeriod: () => 'periodo' }))
vi.mock('../utils', async (orig) => ({ ...(await orig<typeof import('../utils')>()), showToast: vi.fn() }))

import { openDetailsModal, setupDetailsModal } from '../events/campaigns/details'
import { setCampaigns } from '../state'

const ids = ['detailsTitle', 'detailsPeriod', 'detailsCampaignValue', 'detailsCommission', 'detailsPaymentDate', 'detailsParticipants', 'detailsStreamers']

type Streamer = { id: string; campaign_id: string; streamer_name: string; payment: number; payment_date: null; contact_status?: string }
const st = (id: string, name: string, contact_status?: string): Streamer => ({ id, campaign_id: 'c1', streamer_name: name, payment: 0, payment_date: null, contact_status })
const mk = (streamers: Streamer[]) => ({
  id: 'c1', company: 'Acme', start_date: '2026-01-01', end_date: '2026-01-31', total_received: 100, my_commission: 10,
  currency: 'USD', payment_date: null, created_at: '', campaign_streamers: streamers,
}) as unknown as Parameters<typeof openDetailsModal>[0]

// 6 streamers em 4 status (sem pendentes).
const base = () => [st('1', 'ana', 'contatado'), st('2', 'bia', 'contatado'), st('3', 'caio', 'confirmado'), st('4', 'dani', 'confirmado'), st('5', 'edu', 'nao_respondeu'), st('6', 'fabi', 'recusado')]

let wired = false
function mount() {
  document.body.innerHTML = `<div id="campaignDetailsModal" class="hidden">
    ${ids.map(id => `<div id="${id}"></div>`).join('')}
    <div id="detailsFilters"><input id="detailsSearch" value=""></div>
    <p id="detailsEmptyState" class="hidden"></p>
    <button id="closeDetailsModal"></button><button id="closeDetailsX"></button></div>`
  wired = false
}
function open(streamers: Streamer[]) {
  const c = mk(streamers)
  setCampaigns([c])
  if (!wired) { setupDetailsModal(); wired = true }
  openDetailsModal(c)
}
beforeEach(() => { mount(); updateContactStatus.mockClear() })

const group = (k: string) => document.querySelector(`[data-group="${k}"]`) as HTMLElement | null
const groupKeys = () => [...document.querySelectorAll('.group-toggle')].map(g => (g as HTMLElement).dataset.group)
const label = (k: string) => group(k)!.textContent!.replace(/\s+/g, '')
const rows = () => [...document.querySelectorAll('#detailsStreamers [data-id]')]
const search = (v: string) => { const i = document.getElementById('detailsSearch') as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })) }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('grupos por status (campanhas com 6+ streamers)', () => {
  it('ordem: Contatados, Pendentes, Sem resposta, Confirmados, Recusados; só nome e quantidade', () => {
    open([...base(), st('7', 'gil')]) // com um pendente, existem os cinco grupos
    expect(groupKeys()).toEqual(['contatado', 'pendente', 'nao_respondeu', 'confirmado', 'recusado'])
    expect(label('contatado')).toBe('Contatados2')
    expect(label('pendente')).toBe('Pendentes1')
    expect(label('nao_respondeu')).toBe('Semresposta1')
  })

  it('dentro dos grupos o status não se repete no cartão; a lista direta mantém o status abaixo do nome', () => {
    open(base())
    group('contatado')!.click()
    const card = document.querySelector('#detailsStreamers [data-id="1"]')!
    expect(card.textContent).toContain('ana')
    expect(card.textContent).not.toContain('Contatado\u00a0') // sem a linha de status
    expect(card.querySelectorAll('.block').length).toBe(1) // só o nome
    expect(card.querySelector('.rounded-full')!.textContent).toBe('A') // avatar preservado
    expect(card.querySelectorAll('.quick-status-btn').length).toBeGreaterThan(0) // ações visíveis
    open([st('1', 'ana', 'contatado'), st('2', 'bia', 'confirmado')])
    expect(document.querySelectorAll('#detailsStreamers [data-id="1"] .block').length).toBe(2) // nome + status
  })

  it('cabeçalho do grupo: bolinha e nome à esquerda; contador e seta em colunas fixas à direita', () => {
    open(base())
    const g = group('contatado')!
    expect(g.className).toContain('grid-cols-[auto_minmax(0,1fr)_auto_1rem]')
    expect(g.children).toHaveLength(4) // bolinha, nome, contador, seta
    expect(g.children[2].textContent).toBe('2')
    expect(g.children[3].className).toContain('fa-chevron-down')
  })

  it('não existe barra de filtros por status', () => {
    open(base())
    expect(document.querySelector('.status-filter-btn')).toBeNull()
  })

  it('grupos vazios não aparecem (ex.: 18 confirmados → só "Confirmados 18")', () => {
    open(Array.from({ length: 18 }, (_, i) => st(String(i + 1), `s${i + 1}`, 'confirmado')))
    expect(groupKeys()).toEqual(['confirmado'])
    expect(label('confirmado')).toBe('Confirmados18')
  })

  it('todos os grupos começam recolhidos; clicar abre e recolhe individualmente', () => {
    open(base())
    expect(rows()).toHaveLength(0)
    expect([...document.querySelectorAll('.group-toggle')].every(g => g.getAttribute('aria-expanded') === 'false')).toBe(true)
    group('contatado')!.click()
    expect(rows()).toHaveLength(2)
    expect(group('contatado')!.getAttribute('aria-expanded')).toBe('true')
    expect(group('confirmado')!.getAttribute('aria-expanded')).toBe('false')
    group('confirmado')!.click()
    expect(rows()).toHaveLength(4)
    group('contatado')!.click()
    expect(rows()).toHaveLength(2)
  })

  it('mudar status com o grupo aberto atualiza contagens e a posição do streamer', async () => {
    open(base())
    group('contatado')!.click()
    ;(document.querySelector('#detailsStreamers [data-id="1"] [data-next="confirmado"]') as HTMLElement).click()
    await flush()
    expect(updateContactStatus).toHaveBeenCalledWith('1', 'confirmado')
    expect(label('contatado')).toBe('Contatados1')
    expect(label('confirmado')).toBe('Confirmados3')
    expect(rows().map(r => (r as HTMLElement).dataset.id)).toEqual(['2']) // ana foi para o grupo (fechado) dos confirmados
  })

  it('quando um grupo fica com zero ele some; quando surge um novo, ele aparece', async () => {
    open(base())
    expect(groupKeys()).toEqual(['contatado', 'nao_respondeu', 'confirmado', 'recusado'])
    group('nao_respondeu')!.click()
    ;(document.querySelector('#detailsStreamers [data-id="5"] [data-next="pendente"]') as HTMLElement).click()
    await flush()
    expect(groupKeys()).toEqual(['contatado', 'pendente', 'confirmado', 'recusado']) // "sem resposta" zerou e sumiu
  })

  it('busca: só os grupos com resultado, já abertos; ao limpar, volta tudo recolhido', () => {
    open(base())
    search('ana')
    expect(groupKeys()).toEqual(['contatado'])
    expect(group('contatado')!.getAttribute('aria-expanded')).toBe('true')
    expect(rows()).toHaveLength(1)
    search('')
    expect(groupKeys()).toHaveLength(4)
    expect(rows()).toHaveLength(0)
  })

  it('abrir o modal ou os grupos nunca altera status (Recusado fica como está)', () => {
    open(base())
    group('recusado')!.click()
    search('fabi')
    expect(updateContactStatus).not.toHaveBeenCalled()
    expect(rows().map(r => (r as HTMLElement).dataset.id)).toEqual(['6'])
    expect(label('recusado')).toBe('Recusados1') // continua no grupo Recusados
    expect(document.querySelector('#detailsStreamers [data-id="6"] [data-next="pendente"]')).not.toBeNull() // com a ação de reverter
  })

  it('poucos streamers (janela enxuta): lista direta, sem grupos', () => {
    open([st('1', 'ana', 'contatado'), st('2', 'bia', 'confirmado')])
    expect(document.querySelectorAll('.group-toggle')).toHaveLength(0)
    expect(rows()).toHaveLength(2)
  })

  it('45 streamers: contagens corretas por grupo, grupos vazios ocultos', () => {
    const many = Array.from({ length: 45 }, (_, i) => st(String(i + 1), `s${i + 1}`, i < 20 ? 'contatado' : i < 40 ? 'confirmado' : 'recusado'))
    open(many)
    expect(label('contatado')).toBe('Contatados20')
    expect(label('confirmado')).toBe('Confirmados20')
    expect(label('recusado')).toBe('Recusados5')
    expect(group('pendente')).toBeNull()
    expect(group('nao_respondeu')).toBeNull()
  })
})

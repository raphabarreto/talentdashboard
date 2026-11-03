import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setCampaigns } from '../state'
import { populateCampaignFilters } from '../ui/campaigns'
import type { Campaign } from '../types/index'

const camp = (id: string, start: string) => ({ id, company: 'X', start_date: start, end_date: start, total_received: 0, my_commission: 0, currency: 'USD', payment_date: null, created_at: '', campaign_streamers: [] }) as unknown as Campaign

const labels = (id: string) => [...document.querySelectorAll(`#${id} option`)].map(o => o.textContent)

beforeEach(() => {
  document.body.innerHTML = '<select id="month-filter"></select><select id="year-filter"></select>'
})

describe('filtros de mês e ano das campanhas', () => {
  it('meses em ordem cronológica (e não em ordem de texto)', () => {
    // Mês atual fixo para o teste ser estável: dezembro de 2026
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 11, 15))
    setCampaigns([camp('1', '2026-11-05'), camp('2', '2026-04-10'), camp('3', '2026-01-20'), camp('4', '2026-06-01'), camp('5', '2026-10-03'), camp('6', '2026-03-09')])
    populateCampaignFilters()
    vi.useRealTimers()
    expect(labels('month-filter')).toEqual(['Todos os Meses', 'Janeiro', 'Março', 'Abril', 'Junho', 'Outubro', 'Novembro', 'Dezembro'])
  })

  it('anos em ordem crescente', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 15))
    setCampaigns([camp('1', '2026-02-01'), camp('2', '2024-02-01'), camp('3', '2025-02-01')])
    populateCampaignFilters()
    vi.useRealTimers()
    expect(labels('year-filter')).toEqual(['Todos os Anos', '2024', '2025', '2026'])
  })

  it('preserva o mês e o ano selecionados ao recarregar a lista', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 15))
    setCampaigns([camp('1', '2026-11-05'), camp('2', '2025-04-10')])
    populateCampaignFilters()
    ;(document.getElementById('month-filter') as HTMLSelectElement).value = '10'
    ;(document.getElementById('year-filter') as HTMLSelectElement).value = '2025'
    populateCampaignFilters()
    vi.useRealTimers()
    expect((document.getElementById('month-filter') as HTMLSelectElement).value).toBe('10')
    expect((document.getElementById('year-filter') as HTMLSelectElement).value).toBe('2025')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { setStreamers, setCampaigns } from '../state'
import { renderOverview } from '../ui/overview'
import { renderTable } from '../ui/table'
import { renderCampaigns } from '../ui/campaigns'
import type { Streamer, Campaign } from '../types/index'

// Nomes maliciosos: nada disso pode virar elemento da página.
const EVIL = ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg onload=alert(1)>']

const streamer = (id: string, name: string) => ({ id, name, country: 'br', avg_viewers: 1, peak_viewers: 1, hours_watched: 1, hours_streamed: 1, last_live_at: null, created_at: '' }) as Streamer

beforeEach(() => {
  document.body.innerHTML = `
    <div id="overview-grid"></div>
    <div><div class="overflow-x-auto"><table><tbody id="table-body"></tbody></table></div></div>
    <select id="month-filter"></select><select id="year-filter"></select>
    <table><tbody id="campaigns-body"></tbody></table>
    <div id="generatePdfBtn"></div><div id="exportCsvBtn"></div><div id="removeSelectedBtn"></div><span id="selectedCount"></span><span id="selectedCountCsv"></span><span id="selectedCountRemove"></span><div id="monthly-total"></div><div id="monthly-total-label"></div>`
})

const injected = (root: string) => document.querySelectorAll(`${root} img[src="x"], ${root} script, ${root} svg, ${root} [onerror], ${root} [onload]`).length

describe('nomes maliciosos não viram código na tela', () => {
  it('cards da Visão Geral', () => {
    setStreamers(EVIL.map((n, i) => streamer(String(i), n)))
    renderOverview()
    expect(injected('#overview-grid')).toBe(0)
    expect(document.getElementById('overview-grid')!.textContent).toContain('<script>alert(1)</script>')
  })

  it('tabela de streamers', () => {
    setStreamers(EVIL.map((n, i) => streamer(String(i), n)))
    renderTable()
    expect(injected('#table-body')).toBe(0)
  })

  it('tabela de campanhas (empresa maliciosa)', () => {
    setCampaigns(EVIL.map((c, i) => ({ id: String(i), company: c, start_date: '2026-01-01', end_date: '2026-01-31', total_received: 0, my_commission: 0, currency: 'USD', payment_date: null, created_at: '', campaign_streamers: [] }) as unknown as Campaign))
    renderCampaigns()
    expect(injected('#campaigns-body')).toBe(0)
  })
})

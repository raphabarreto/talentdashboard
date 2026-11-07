import { describe, it, expect, beforeEach, vi } from 'vitest'

const { camps } = vi.hoisted(() => ({ camps: [] as any[] }))
vi.mock('../state', () => ({ get campaigns() { return camps } }))

import { renderCampaigns, formatPeriod, formatPaymentShort, toggleCampaignMenu, closeCampaignMenus } from '../ui/campaigns'

describe('formatPeriod', () => {
  it('datas iguais: só uma data', () => expect(formatPeriod('2026-08-30', '2026-08-30')).toBe('30/08/2026'))
  it('mesmo ano: início sem ano', () => expect(formatPeriod('2026-08-01', '2026-08-31')).toBe('01/08 – 31/08/2026'))
  it('anos diferentes: anos completos', () => expect(formatPeriod('2025-12-28', '2026-01-05')).toBe('28/12/2025 – 05/01/2026'))
  it('sem data final: só a inicial', () => expect(formatPeriod('2026-08-01', '')).toBe('01/08/2026'))
  it('sem ano (tabela): data única, intervalo e intervalo entre meses', () => {
    expect(formatPeriod('2026-06-30', '2026-06-30', false)).toBe('30/06')
    expect(formatPeriod('2026-06-01', '2026-06-30', false)).toBe('01/06 – 30/06')
    expect(formatPeriod('2026-06-20', '2026-07-04', false)).toBe('20/06 – 04/07')
  })
  it('sem ano, mas atravessando anos: mantém os anos para não ficar ambíguo', () => {
    expect(formatPeriod('2025-12-28', '2026-01-05', false)).toBe('28/12/2025 – 05/01/2026')
  })
  it('pagamento sem ano, exceto em outro ano que o da campanha', () => {
    expect(formatPaymentShort('2026-08-10', '2026-08-01')).toBe('10/08')
    expect(formatPaymentShort('2027-01-10', '2026-12-01')).toBe('10/01/2027')
  })
})

function camp(over: any = {}) {
  return { id: 'c1', company: 'RioRise', start_date: '2026-08-01', end_date: '2026-08-31', total_received: 100, my_commission: 500, currency: 'USD', payment_date: null, campaign_streamers: [], ...over }
}

beforeEach(() => {
  camps.length = 0
  document.body.innerHTML = '<select id="month-filter"></select><select id="year-filter"></select><span id="monthly-total"></span><span id="monthly-total-label"></span><table><tbody id="campaigns-body"></tbody></table>'
})
function render() {
  renderCampaigns()
  ;(document.getElementById('month-filter') as HTMLSelectElement).value = 'all'
  ;(document.getElementById('year-filter') as HTMLSelectElement).value = 'all'
  renderCampaigns()
}

describe('tabela de campanhas (5 colunas)', () => {
  it('Empresa mostra só o nome, e o Período vem numa coluna só', () => {
    camps.push(camp())
    render()
    const tds = document.querySelectorAll('#campaigns-body tr td')
    expect(tds.length).toBe(5)
    expect(tds[0].textContent!.trim()).toBe('RioRise')
    expect(tds[1].textContent).toContain('01/08 – 31/08')
    expect(tds[1].textContent).not.toContain('2026') // o ano já está no filtro
  })

  it('pagamento aparece abaixo do valor só quando existe a data', () => {
    camps.push(camp({ id: 'a', payment_date: '2026-10-15' }), camp({ id: 'b' }))
    render()
    const rows = document.querySelectorAll('#campaigns-body tr')
    expect(rows[0].querySelectorAll('td')[2].textContent).toContain('Pagamento: 15/10')
    expect(rows[1].querySelectorAll('td')[2].textContent).not.toContain('Pagamento')
  })

  it('"Não lançado" continua quando não há valor recebido', () => {
    camps.push(camp({ total_received: 0 }))
    render()
    expect(document.querySelectorAll('#campaigns-body td')[2].textContent).toContain('Não lançado')
  })

  it('ações: Gerenciar (detalhes), editar e excluir dentro do menu, com nomes acessíveis', () => {
    camps.push(camp())
    render()
    const manage = document.querySelector('.details-campaign-btn') as HTMLElement
    expect(manage.textContent).toContain('Gerenciar')
    expect(manage.dataset.id).toBe('c1')
    expect(manage.getAttribute('aria-label')).toContain('RioRise')
    expect(document.querySelector('.edit-campaign-btn')).not.toBeNull()
    const del = document.querySelector('.dropdown-menu .delete-campaign-btn') as HTMLElement
    expect(del.textContent).toContain('Excluir campanha')
    expect(del.dataset.id).toBe('c1')
  })

  it('menu de três pontos abre, marca aria-expanded e fecha', () => {
    camps.push(camp())
    render()
    const btn = document.querySelector('.campaign-menu-btn') as HTMLElement
    const menu = btn.nextElementSibling as HTMLElement
    expect(menu.classList.contains('hidden')).toBe(true)
    toggleCampaignMenu(btn)
    expect(menu.classList.contains('hidden')).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    closeCampaignMenus()
    expect(menu.classList.contains('hidden')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})

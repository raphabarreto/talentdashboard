import { escapeHtml as esc } from '../lib/escape'
import { campaigns } from '../state'
import { fmtDate, fmtCurrency, monthNames } from '../utils'

// Período numa coluna só. Com ano (padrão): data única quando início = fim; "01/08 – 31/08/2026" no mesmo ano;
// anos completos se diferirem. Sem ano (tabela, onde o filtro já mostra o ano): "30/06" ou "01/06 – 30/06";
// só mantém os anos quando o período atravessa anos diferentes, para não ficar ambíguo.
export function formatPeriod(start: string, end: string, withYear = true): string {
  const day = (iso: string) => fmtDate(iso).slice(0, 5)
  if (!start) return end ? (withYear ? fmtDate(end) : day(end)) : '—'
  if (!end || end === start) return withYear ? fmtDate(start) : day(start)
  const sameYear = start.split('-')[0] === end.split('-')[0]
  if (!sameYear) return `${fmtDate(start)} – ${fmtDate(end)}`
  return withYear ? `${day(start)} – ${fmtDate(end)}` : `${day(start)} – ${day(end)}`
}

// Data de pagamento na tabela: sem ano, exceto se cair em outro ano que o da campanha.
export function formatPaymentShort(payment: string, campaignStart: string): string {
  const sameYear = (payment || '').split('-')[0] === (campaignStart || '').split('-')[0]
  return sameYear ? fmtDate(payment).slice(0, 5) : fmtDate(payment)
}

// Menu de três pontos de uma campanha: abre ancorado ao botão (fixo, para não ser cortado pela rolagem da tabela).
export function toggleCampaignMenu(btn: HTMLElement) {
  const menu = btn.nextElementSibling as HTMLElement | null
  if (!menu) return
  const wasOpen = !menu.classList.contains('hidden')
  closeCampaignMenus()
  if (wasOpen) return
  menu.classList.remove('hidden')
  const rect = btn.getBoundingClientRect()
  const left = Math.max(8, rect.right - menu.offsetWidth)
  const below = rect.bottom + 4
  const top = below + menu.offsetHeight > window.innerHeight ? Math.max(8, rect.top - menu.offsetHeight - 4) : below
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
  btn.setAttribute('aria-expanded', 'true')
  ;(menu.querySelector('[role="menuitem"]') as HTMLElement | null)?.focus()
}

export function closeCampaignMenus(returnFocus = false) {
  document.querySelectorAll<HTMLElement>('.campaign-menu-btn[aria-expanded="true"]').forEach(b => {
    b.setAttribute('aria-expanded', 'false')
    ;(b.nextElementSibling as HTMLElement | null)?.classList.add('hidden')
    if (returnFocus) b.focus()
  })
}

export function renderCampaigns() {
  const tbody = document.getElementById('campaigns-body')!
  populateCampaignFilters()
  const monthVal = (document.getElementById('month-filter') as HTMLSelectElement).value
  const yearVal = (document.getElementById('year-filter') as HTMLSelectElement).value
  tbody.innerHTML = ''

  const filtered = campaigns.filter(c => {
    if (!c.start_date) return false
    const [y, m] = c.start_date.split('-')
    const monthMatch = monthVal === 'all' || String(parseInt(m) - 1) === monthVal
    const yearMatch = yearVal === 'all' || y === yearVal
    return monthMatch && yearMatch
  })

  let grandTotal = 0
  filtered.forEach(c => {
    const totalReceived = c.total_received || 0
    const myCommission = c.my_commission || 0
    const isLaunched = totalReceived > 0
    if (isLaunched) grandTotal += myCommission
    const total = c.campaign_streamers?.length || 0
    const confirmed = c.campaign_streamers?.filter(s => s.contact_status === 'confirmado').length || 0
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4">${esc(c.company)}</td>
      <td class="p-4 whitespace-nowrap">${formatPeriod(c.start_date, c.end_date, false)}</td>
      <td class="p-4 font-semibold">
        ${!isLaunched ? '<span class="inline-flex items-center justify-center whitespace-nowrap px-3 py-1 rounded text-sm font-semibold bg-amber-500/20 text-amber-400">Não lançado</span>' : fmtCurrency(myCommission)}
        ${c.payment_date ? `<span class="block text-xs font-normal text-slate-500 mt-0.5">Pagamento: ${formatPaymentShort(c.payment_date, c.start_date)}</span>` : ''}
      </td>
      <td class="p-4">${total > 0 ? `<span class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1 rounded text-sm font-semibold bg-emerald-500/20 text-emerald-400">${confirmed} confirmado${confirmed !== 1 ? 's' : ''}</span>` : '—'}</td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <button class="details-campaign-btn h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 hover:text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" data-id="${c.id}" title="Gerenciar streamers da campanha" aria-label="Gerenciar streamers da campanha ${esc(c.company)}"><i class="fas fa-users text-xs" aria-hidden="true"></i>Gerenciar</button>
          <button class="edit-campaign-btn w-8 h-8 inline-flex items-center justify-center rounded-md text-amber-500 hover:text-amber-400 hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" data-id="${c.id}" title="Editar" aria-label="Editar campanha ${esc(c.company)}"><i class="fas fa-pen" aria-hidden="true"></i></button>
          <div>
            <button class="campaign-menu-btn w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-haspopup="menu" aria-expanded="false" title="Mais ações" aria-label="Mais ações da campanha ${esc(c.company)}"><i class="fas fa-ellipsis-v" aria-hidden="true"></i></button>
            <div class="dropdown-menu hidden fixed w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-30" role="menu">
              <button role="menuitem" class="delete-campaign-btn w-full text-left px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-slate-600 transition-colors flex items-center gap-2 focus:outline-none focus-visible:bg-slate-600" data-id="${c.id}"><i class="fas fa-trash" aria-hidden="true"></i>Excluir campanha</button>
            </div>
          </div>
        </div>
      </td>
    `
    tbody.appendChild(row)
  })

  document.getElementById('monthly-total')!.textContent = fmtCurrency(grandTotal)
  document.getElementById('monthly-total-label')!.textContent = buildTotalLabel(monthVal, yearVal)
}

function buildTotalLabel(monthVal: string, yearVal: string): string {
  if (monthVal === 'all' && yearVal === 'all') return 'Meu Valor Total (Geral)'
  if (monthVal === 'all') return `Meu Valor Total — ${yearVal}`
  const monthLabel = monthNames[parseInt(monthVal)]
  if (yearVal === 'all') return `Meu Valor Total — ${monthLabel}`
  return `Meu Valor Total — ${monthLabel}/${yearVal}`
}

let filtersInitialized = false

export function populateCampaignFilters() {
  const months = new Set<number>()
  const years = new Set<number>()
  const now = new Date()
  months.add(now.getMonth())
  years.add(now.getFullYear())

  campaigns.forEach(c => {
    if (c.start_date) {
      const [y, m] = c.start_date.split('-').map(Number)
      months.add(m - 1)
      years.add(y)
    }
  })

  const mFilter = document.getElementById('month-filter') as HTMLSelectElement
  const yFilter = document.getElementById('year-filter') as HTMLSelectElement
  const mVal = mFilter.value, yVal = yFilter.value

  mFilter.innerHTML = '<option value="all">Todos os Meses</option>'
  ;[...months].sort((a, b) => a - b).forEach(m => { mFilter.innerHTML += `<option value="${m}">${monthNames[m]}</option>` })

  yFilter.innerHTML = '<option value="all">Todos os Anos</option>'
  ;[...years].sort((a, b) => a - b).forEach(y => { yFilter.innerHTML += `<option value="${y}">${y}</option>` })

  if (!filtersInitialized) {
    filtersInitialized = true
    mFilter.value = String(now.getMonth())
    yFilter.value = String(now.getFullYear())
  } else {
    mFilter.value = mVal
    yFilter.value = yVal
  }
}

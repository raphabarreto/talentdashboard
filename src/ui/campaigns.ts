import { campaigns } from '../state'
import { fmtDate, fmtCurrency, monthNames } from '../utils'

export function renderCampaigns() {
  const tbody = document.getElementById('campaigns-body')!
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
    grandTotal += c.my_commission || 0
    const total = c.campaign_streamers?.length || 0
    const confirmed = c.campaign_streamers?.filter(s => s.contact_status === 'confirmado').length || 0
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4">${c.company}</td>
      <td class="p-4">${fmtDate(c.start_date)}</td>
      <td class="p-4">${fmtDate(c.end_date)}</td>
      <td class="p-4 font-semibold">${fmtCurrency(c.my_commission || 0)}</td>
      <td class="p-4">${total > 0 ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-500/20 text-emerald-400">${confirmed} confirmado${confirmed !== 1 ? 's' : ''}</span>` : '—'}</td>
      <td class="p-4 flex gap-3">
        <button class="text-amber-500 hover:text-amber-400 edit-campaign-btn" data-id="${c.id}" title="Editar"><i class="fas fa-pen"></i></button>
        <button class="text-indigo-500 hover:text-indigo-400 details-campaign-btn" data-id="${c.id}" title="Detalhes"><i class="fas fa-eye"></i></button>
        <button class="text-slate-400 hover:text-red-400 transition-colors delete-campaign-btn" data-id="${c.id}" title="Remover"><i class="fas fa-trash"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })

  document.getElementById('monthly-total')!.textContent = fmtCurrency(grandTotal)
  populateCampaignFilters()
}

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
  ;[...months].sort().forEach(m => { mFilter.innerHTML += `<option value="${m}">${monthNames[m]}</option>` })

  yFilter.innerHTML = '<option value="all">Todos os Anos</option>'
  ;[...years].sort().forEach(y => { yFilter.innerHTML += `<option value="${y}">${y}</option>` })

  mFilter.value = mVal || String(now.getMonth())
  yFilter.value = yVal || String(now.getFullYear())
}

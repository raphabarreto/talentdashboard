import { escapeHtml as esc } from '../lib/escape'
import { tablePage, setTablePage, selectedStreamers, PAGE_SIZE, currentSort } from '../state'
import { fmt } from '../utils'
import { getFilteredStreamers } from './filters'

export function renderTable() {
  const tbody = document.getElementById('table-body')!
  const data = getFilteredStreamers('table')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (tablePage > totalPages) setTablePage(Math.max(1, totalPages))
  const paged = data.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
  
  // Usar DocumentFragment para evitar múltiplos reflows
  const fragment = document.createDocumentFragment()

  paged.forEach(s => {
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4"><input type="checkbox" class="streamer-checkbox w-4 h-4 rounded" data-id="${s.id}" aria-label="Selecionar ${esc(s.name)}" ${selectedStreamers.has(s.id) ? 'checked' : ''}></td>
      <td class="p-4 font-medium">
        <div class="flex items-center gap-2 min-w-0">
          ${s.is_live ? '<span class="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>' : ''}
          <span class="text-white truncate">${esc(s.name)}</span>
        </div>
      </td>
      <td class="p-4">${fmt(s.avg_viewers)}</td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <a href="https://twitch.tv/${esc(s.name.toLowerCase())}" target="_blank" class="table-link-twitch inline-flex items-center justify-center w-9 h-9 -my-1 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors" title="Abrir Twitch" aria-label="Abrir Twitch de ${esc(s.name)}"><i class="fab fa-twitch" aria-hidden="true"></i></a>
          <a href="https://sullygnome.com/channel/${esc(s.name.toLowerCase())}/30" target="_blank" class="table-link-sully inline-flex items-center justify-center w-9 h-9 -my-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors" title="Abrir SullyGnome" aria-label="Abrir SullyGnome de ${esc(s.name)}"><i class="fas fa-chart-simple" aria-hidden="true"></i></a>
        </div>
      </td>
      <td class="p-4 text-center"><button class="text-slate-400 hover:text-red-400 transition-colors delete-btn" data-id="${s.id}" title="Remover" aria-label="Remover ${esc(s.name)}"><i class="fas fa-trash" aria-hidden="true"></i></button></td>
    `
    fragment.appendChild(row)
  })

  tbody.innerHTML = ''
  tbody.appendChild(fragment)

  const tableContainer = tbody.closest('.overflow-x-auto')!.parentElement!
  const existingPag = tableContainer.querySelector('.table-pagination')
  if (existingPag) existingPag.remove()
  if (totalPages > 1) {
    const pag = document.createElement('div')
    pag.className = 'table-pagination flex items-center justify-center gap-4 mt-6'
    pag.innerHTML = `
      <button class="prev-table py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${tablePage === 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-sm text-slate-400">Página <span class="text-white font-semibold">${tablePage}</span> de ${totalPages} <span class="text-slate-500">· ${data.length} streamer${data.length !== 1 ? 's' : ''}</span></span>
      <button class="next-table py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${tablePage === totalPages ? 'disabled' : ''}>Próxima →</button>
    `
    tableContainer.appendChild(pag)
    pag.querySelector('.prev-table')?.addEventListener('click', () => { setTablePage(tablePage - 1); renderTable() })
    pag.querySelector('.next-table')?.addEventListener('click', () => { setTablePage(tablePage + 1); renderTable() })
  }

  updateSelectionButtons()
  updateSortIndicators()
}

export function updateSelectionButtons() {
  const count = selectedStreamers.size
  document.getElementById('generatePdfBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('exportCsvBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('removeSelectedBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('selectedCount')!.textContent = String(count)
  document.getElementById('selectedCountCsv')!.textContent = String(count)
  document.getElementById('selectedCountRemove')!.textContent = String(count)
}

// Seta ▲/▼ no título da coluna ordenada (e aria-sort para leitores de tela).
export function updateSortIndicators() {
  document.querySelectorAll<HTMLElement>('th[data-sort]').forEach(th => {
    const active = th.dataset.sort === currentSort.key
    const indicator = th.querySelector('.sort-indicator')
    if (indicator) indicator.textContent = active ? (currentSort.order === 'asc' ? '▲' : '▼') : ''
    th.setAttribute('aria-sort', active ? (currentSort.order === 'asc' ? 'ascending' : 'descending') : 'none')
  })
}

import { tablePage, setTablePage, selectedStreamers, PAGE_SIZE } from '../state'
import { fmt } from '../utils'
import { getFilteredStreamers } from './filters'

export function renderTable() {
  const tbody = document.getElementById('table-body')!
  const data = getFilteredStreamers('table')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (tablePage > totalPages) setTablePage(Math.max(1, totalPages))
  const paged = data.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
  tbody.innerHTML = ''

  paged.forEach(s => {
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4"><input type="checkbox" class="streamer-checkbox w-4 h-4 rounded" data-id="${s.id}" ${selectedStreamers.has(s.id) ? 'checked' : ''}></td>
      <td class="p-4 font-medium">
        <div class="flex items-center justify-between gap-2">
          <button class="history-btn text-left hover:text-indigo-400 transition-colors" data-id="${s.id}" data-name="${s.name}">${s.name}</button>
          ${s.is_live ? '<span class="px-1.5 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase leading-none">• AO VIVO</span>' : ''}
        </div>
      </td>
      <td class="p-4">${fmt(s.avg_viewers)}</td>
      <td class="p-4"><a href="https://twitch.tv/${s.name.toLowerCase()}" target="_blank" class="text-indigo-400 hover:underline">twitch.tv/${s.name.toLowerCase()}</a></td>
      <td class="p-4"><a href="https://sullygnome.com/channel/${s.name.toLowerCase()}/30" target="_blank" class="text-indigo-400 hover:underline">Ver no SullyGnome</a></td>
      <td class="p-4"><button class="text-slate-400 hover:text-red-400 transition-colors delete-btn" data-id="${s.id}" title="Remover"><i class="fas fa-trash"></i></button></td>
    `
    tbody.appendChild(row)
  })

  const tableContainer = tbody.closest('.overflow-x-auto')!.parentElement!
  const existingPag = tableContainer.querySelector('.table-pagination')
  if (existingPag) existingPag.remove()
  if (totalPages > 1) {
    const pag = document.createElement('div')
    pag.className = 'table-pagination flex items-center justify-center gap-4 mt-6'
    pag.innerHTML = `
      <button class="prev-table py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${tablePage === 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-sm text-slate-400">${tablePage} / ${totalPages}</span>
      <button class="next-table py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${tablePage === totalPages ? 'disabled' : ''}>Próxima →</button>
    `
    tableContainer.appendChild(pag)
    pag.querySelector('.prev-table')?.addEventListener('click', () => { setTablePage(tablePage - 1); renderTable() })
    pag.querySelector('.next-table')?.addEventListener('click', () => { setTablePage(tablePage + 1); renderTable() })
  }

  updateSelectionButtons()
}

export function updateSelectionButtons() {
  const count = selectedStreamers.size
  document.getElementById('generatePdfBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('setCategoryBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('removeSelectedBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('selectedCount')!.textContent = String(count)
  document.getElementById('selectedCountCategory')!.textContent = String(count)
  document.getElementById('selectedCountRemove')!.textContent = String(count)
}

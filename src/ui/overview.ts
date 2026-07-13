import { overviewPage, setOverviewPage, PAGE_SIZE } from '../state'
import { fmt, countryNames } from '../utils'
import { getFilteredStreamers } from './filters'

export function renderOverview() {
  const grid = document.getElementById('overview-grid')!
  const data = getFilteredStreamers('overview')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (overviewPage > totalPages) setOverviewPage(Math.max(1, totalPages))
  const paged = data.slice((overviewPage - 1) * PAGE_SIZE, overviewPage * PAGE_SIZE)
  
  grid.innerHTML = ''

  if (data.length === 0) {
    grid.innerHTML = '<p class="text-slate-400 text-sm col-span-full text-center py-8">Nenhum streamer encontrado.</p>'
    return
  }

  // Usar DocumentFragment para evitar múltiplos reflows
  const fragment = document.createDocumentFragment()

  paged.forEach(s => {
    const flagHtml = s.country ? `<span class="fi fi-${s.country} w-5 h-5 rounded-full shadow-md"></span> ${countryNames[s.country] || s.country}` : '-'
    const card = document.createElement('div')
    card.className = 'bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors relative'
    card.innerHTML = `
      <div class="absolute top-4 right-4">
        <button class="text-slate-500 hover:text-slate-300 transition-colors p-2 hover:bg-slate-700/50 rounded" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="dropdown-menu hidden absolute right-0 mt-2 w-40 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-10">
          <button class="delete-btn w-full text-left px-4 py-2 hover:bg-slate-600 text-red-400 hover:text-red-300 transition-colors rounded-lg flex items-center gap-2" data-id="${s.id}">
            <i class="fas fa-trash"></i> Remover
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3 mb-4 pr-12">
        <div class="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-xl flex-shrink-0">${s.name.charAt(0).toUpperCase()}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <a href="https://twitch.tv/${s.name.toLowerCase()}" target="_blank" class="text-xl font-bold text-white hover:text-indigo-400 transition-colors truncate">${s.name}</a>
            ${s.is_live ? '<span class="flex items-center justify-center w-2 h-2 bg-red-600 rounded-full animate-pulse flex-shrink-0" title="AO VIVO"></span>' : ''}
          </div>
        </div>
      </div>
      <div class="space-y-2 text-sm">
        <p class="flex justify-between"><span class="text-slate-400">País:</span><span class="font-semibold text-indigo-400 flex items-center gap-2">${flagHtml}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Média de Viewers:</span><span class="font-semibold text-indigo-400">${fmt(s.avg_viewers)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Pico de Viewers:</span><span class="font-semibold">${fmt(s.peak_viewers)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Horas Assistidas:</span><span class="font-semibold">${fmt(s.hours_watched)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Horas Transmitidas:</span><span class="font-semibold">${fmt(s.hours_streamed)}</span></p>
      </div>
    `
    fragment.appendChild(card)
  })

  grid.appendChild(fragment)

  const existingPag = grid.parentElement!.querySelector('.pagination')
  if (existingPag) existingPag.remove()
  if (totalPages > 1) {
    const pag = document.createElement('div')
    pag.className = 'pagination flex items-center justify-center gap-4 mt-6'
    pag.innerHTML = `
      <button class="prev-overview py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${overviewPage === 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-sm text-slate-400">${overviewPage} / ${totalPages}</span>
      <button class="next-overview py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${overviewPage === totalPages ? 'disabled' : ''}>Próxima →</button>
    `
    grid.parentElement!.appendChild(pag)
    pag.querySelector('.prev-overview')?.addEventListener('click', () => { setOverviewPage(overviewPage - 1); renderOverview() })
    pag.querySelector('.next-overview')?.addEventListener('click', () => { setOverviewPage(overviewPage + 1); renderOverview() })
  }
}

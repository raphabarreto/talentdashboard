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

  paged.forEach(s => {
    const flagHtml = s.country ? `<span class="fi fi-${s.country} w-5 h-5 rounded-full shadow-md"></span> ${countryNames[s.country] || s.country}` : '-'
    const card = document.createElement('div')
    card.className = 'bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors'
    card.innerHTML = `
      <div class="flex items-center mb-4">
        <div class="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-xl mr-4">${s.name.charAt(0).toUpperCase()}</div>
        <div class="flex-1">
          <a href="https://twitch.tv/${s.name.toLowerCase()}" target="_blank" class="text-xl font-bold text-white hover:text-indigo-400 transition-colors">${s.name}</a>
          ${s.is_live ? '<span class="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded uppercase animate-pulse">• AO VIVO</span>' : ''}
        </div>
      </div>
      <div class="space-y-2 text-sm">
        <p class="flex justify-between"><span class="text-slate-400">País:</span><span class="font-semibold text-indigo-400 flex items-center gap-2">${flagHtml}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Média de Viewers:</span><span class="font-semibold text-indigo-400">${fmt(s.avg_viewers)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Pico de Viewers:</span><span class="font-semibold">${fmt(s.peak_viewers)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Horas Assistidas:</span><span class="font-semibold">${fmt(s.hours_watched)}</span></p>
        <p class="flex justify-between"><span class="text-slate-400">Horas Transmitidas:</span><span class="font-semibold">${fmt(s.hours_streamed)}</span></p>
      </div>
      <div class="mt-4 flex justify-between">
        <button class="text-emerald-500 hover:text-emerald-400 cursor-pointer history-btn" data-id="${s.id}" data-name="${s.name}" title="Histórico"><i class="fas fa-chart-line"></i></button>
        <button class="text-slate-400 hover:text-red-400 transition-colors cursor-pointer delete-btn" data-id="${s.id}" title="Remover"><i class="fas fa-trash"></i></button>
      </div>
    `
    grid.appendChild(card)
  })

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

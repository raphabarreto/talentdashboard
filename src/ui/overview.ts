import { escapeHtml as esc } from '../lib/escape'
import { overviewPage, setOverviewPage, PAGE_SIZE, selectedStreamers } from '../state'
import { fmt, countryNames } from '../utils'
import { getFilteredStreamers } from './filters'

// Streamers da página atual da Visão Geral (respeitando busca e filtro).
export function getOverviewPageStreamers(data = getFilteredStreamers('overview')) {
  return data.slice((overviewPage - 1) * PAGE_SIZE, overviewPage * PAGE_SIZE)
}

// Modo de seleção: por padrão os cards ficam limpos; "Selecionar" liga as caixas e a barra de ações.
let selectionMode = false
export const isSelectionMode = () => selectionMode
export function setSelectionMode(on: boolean) {
  selectionMode = on
  if (!on) selectedStreamers.clear() // sair do modo limpa a seleção
  const btn = document.getElementById('overviewSelectModeBtn')
  btn?.setAttribute('aria-pressed', String(on))
  const label = btn?.querySelector('span'); if (label) label.textContent = on ? 'Sair da seleção' : 'Selecionar'
  renderOverview()
}

// Barra de ações (só no modo de seleção) e destaque dos cards marcados, sem refazer a grade.
export function updateOverviewSelection() {
  const count = selectedStreamers.size
  document.getElementById('overviewSelectionBar')?.classList.toggle('hidden', !selectionMode)
  const remove = document.getElementById('overviewRemoveSelectedBtn') as HTMLButtonElement | null
  if (remove) remove.disabled = count === 0
  const set = (id: string) => { const el = document.getElementById(id); if (el) el.textContent = String(count) }
  set('overviewSelectedCount'); set('overviewRemoveCount')
  document.querySelectorAll<HTMLElement>('#overview-grid [data-card-id]').forEach(card => {
    const on = selectedStreamers.has(card.dataset.cardId!)
    card.classList.toggle('card-selected', selectionMode && on)
    const box = card.querySelector<HTMLInputElement>('.card-checkbox')
    if (box) box.checked = on
  })
}

export function renderOverview() {
  const grid = document.getElementById('overview-grid')!
  const data = getFilteredStreamers('overview')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (overviewPage > totalPages) setOverviewPage(Math.max(1, totalPages))
  const paged = getOverviewPageStreamers(data)

  grid.innerHTML = ''

  if (data.length === 0) {
    grid.innerHTML = '<p class="text-slate-400 text-sm col-span-full text-center py-8">Nenhum streamer encontrado.</p>'
    updateOverviewSelection()
    return
  }

  // Usar DocumentFragment para evitar múltiplos reflows
  const fragment = document.createDocumentFragment()

  paged.forEach(s => {
    const flagHtml = s.country ? `<span class="fi fi-${esc(s.country)} w-3.5 h-3.5 rounded-full shadow-md"></span> ${esc(countryNames[s.country] || s.country)}` : '-'
    const card = document.createElement('div')
    card.className = 'bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors relative'
    card.dataset.cardId = s.id
    card.innerHTML = `
      <div class="absolute top-4 right-4">
        <button class="card-menu-btn text-slate-500 hover:text-slate-300 transition-colors p-2 hover:bg-slate-700/50 rounded">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="dropdown-menu hidden absolute right-0 mt-2 w-40 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-10">
          <button class="delete-btn w-full text-left px-4 py-2 hover:bg-slate-600 text-red-400 hover:text-red-300 transition-colors rounded-lg flex items-center gap-2" data-id="${s.id}">
            <i class="fas fa-trash"></i> Remover
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3 mb-4 pr-12">
        ${selectionMode ? `<input type="checkbox" class="card-checkbox flex-shrink-0" data-id="${s.id}" aria-label="Selecionar ${esc(s.name)}" ${selectedStreamers.has(s.id) ? 'checked' : ''}>` : ''}
        <div class="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-xl flex-shrink-0">${esc(s.name.charAt(0).toUpperCase())}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <a href="https://twitch.tv/${esc(s.name.toLowerCase())}" target="_blank" class="text-xl font-bold text-white hover:text-indigo-400 transition-colors truncate">${esc(s.name)}</a>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 flex items-center gap-1">${flagHtml}</span>
            ${s.is_live ? '<span class="live-badge flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tracking-wide flex-shrink-0"><span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>AO VIVO</span>' : ''}
          </div>
        </div>
      </div>
      <div class="bg-slate-900/60 rounded-lg px-4 py-3 mb-3 flex items-center justify-between">
        <span class="text-xs text-slate-400">Média de Viewers</span>
        <span class="text-2xl font-extrabold text-indigo-400">${fmt(s.avg_viewers)}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="flex flex-col justify-end"><p class="text-xs leading-tight text-slate-400">Pico</p><p class="text-sm font-semibold text-white">${fmt(s.peak_viewers)}</p></div>
        <div class="flex flex-col justify-end"><p class="text-xs leading-tight text-slate-400">Horas assistidas</p><p class="text-sm font-semibold text-white">${fmt(s.hours_watched)}</p></div>
        <div class="flex flex-col justify-end"><p class="text-xs leading-tight text-slate-400">Horas em live</p><p class="text-sm font-semibold text-white">${fmt(s.hours_streamed)}</p></div>
      </div>
    `
    // Sem onclick inline (bloqueado por CSP sem 'unsafe-inline').
    card.querySelector('.card-menu-btn')?.addEventListener('click', (e) => {
      const menu = (e.currentTarget as HTMLElement).nextElementSibling
      document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(d => { if (d !== menu) d.classList.add('hidden') })
      menu?.classList.toggle('hidden')
    })
    // No modo de seleção, clicar no card (fora de links, menu e caixa) também marca/desmarca.
    card.addEventListener('click', (e) => {
      if (!selectionMode || (e.target as HTMLElement).closest('a, button, input, .dropdown-menu')) return
      selectedStreamers.has(s.id) ? selectedStreamers.delete(s.id) : selectedStreamers.add(s.id)
      updateOverviewSelection()
    })
    fragment.appendChild(card)
  })

  grid.appendChild(fragment)
  updateOverviewSelection()

  const existingPag = grid.parentElement!.querySelector('.pagination')
  if (existingPag) existingPag.remove()
  if (totalPages > 1) {
    const pag = document.createElement('div')
    pag.className = 'pagination flex items-center justify-center gap-4 mt-6'
    pag.innerHTML = `
      <button class="prev-overview py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${overviewPage === 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-sm text-slate-400">Página <span class="text-white font-semibold">${overviewPage}</span> de ${totalPages} <span class="text-slate-500">· ${data.length} streamer${data.length !== 1 ? 's' : ''}</span></span>
      <button class="next-overview py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${overviewPage === totalPages ? 'disabled' : ''}>Próxima →</button>
    `
    grid.parentElement!.appendChild(pag)
    pag.querySelector('.prev-overview')?.addEventListener('click', () => { setOverviewPage(overviewPage - 1); renderOverview() })
    pag.querySelector('.next-overview')?.addEventListener('click', () => { setOverviewPage(overviewPage + 1); renderOverview() })
  }
}

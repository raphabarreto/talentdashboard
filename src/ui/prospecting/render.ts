import { escapeHtml as esc } from '../../lib/escape'
import { PROSPECT_PAGE_SIZE } from '../../constants'
import { shortlist } from './shortlist'
import { ps } from './state'
import type { ProspectStream } from './types'

export function getVisibleResults(): ProspectStream[] {
  const onlyEmail = (document.getElementById('prospectOnlyEmail') as HTMLInputElement)?.checked
  return onlyEmail ? ps.results.filter(r => r.email) : ps.results
}

export function renderResults() {
  const body = document.getElementById('prospectBody')!
  const wrapper = document.getElementById('prospectResults')!
  wrapper.classList.remove('hidden')
  const visible = getVisibleResults()
  const withEmail = ps.results.filter(r => r.email).length
  document.getElementById('prospectCounter')!.textContent = `${ps.results.length} encontrados • ${withEmail} com email`
  const totalPages = Math.ceil(visible.length / PROSPECT_PAGE_SIZE)
  if (ps.page > totalPages) ps.page = Math.max(1, totalPages)
  const paged = visible.slice((ps.page - 1) * PROSPECT_PAGE_SIZE, ps.page * PROSPECT_PAGE_SIZE)

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Nenhum streamer encontrado.</td></tr>'
    renderPagination(0)
    return
  }

  body.innerHTML = paged.map(r => {
    const inList = shortlist.some(s => s.user_login === r.user_login)
    return `
    <tr class="hover:bg-slate-700/30 transition-colors ${inList ? 'opacity-50' : ''}">
      <td class="p-4"><input type="checkbox" class="prospect-check w-4 h-4 rounded" data-login="${esc(r.user_login)}" ${ps.selected.has(r.user_login) ? 'checked' : ''} ${inList ? 'disabled' : ''}></td>
      <td class="p-4">
        <a href="https://twitch.tv/${esc(r.user_login)}" target="_blank" class="text-white hover:text-indigo-400 font-semibold text-base">${esc(r.user_name)}</a>${inList ? ' <span class="text-xs text-slate-500">✓ na lista</span>' : ''}
      </td>
      <td class="p-4 text-sm text-slate-400">${esc(r.game_name) || '-'}</td>
      <td class="p-4 text-center">
        <span class="text-sm font-medium text-slate-300">${r.viewer_count.toLocaleString()}</span>
      </td>
      <td class="p-4">
        <span class="text-sm ${r.email ? 'text-emerald-400' : 'text-slate-500'}">${esc(r.email) || '-'}</span>
      </td>
    </tr>
  `}).join('')

  renderPagination(totalPages)
  updateActions()
}

function renderPagination(totalPages: number) {
  const pag = document.getElementById('prospectPagination')!
  if (totalPages <= 1) { pag.innerHTML = ''; return }
  pag.innerHTML = `
    <button class="prospect-prev py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm" ${ps.page === 1 ? 'disabled' : ''}>← Anterior</button>
    <span class="text-sm text-slate-400">Página <span class="text-white font-semibold">${ps.page}</span> de ${totalPages}</span>
    <button class="prospect-next py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm" ${ps.page === totalPages ? 'disabled' : ''}>Próxima →</button>
  `
  pag.querySelector('.prospect-prev')?.addEventListener('click', () => { ps.page--; renderResults() })
  pag.querySelector('.prospect-next')?.addEventListener('click', () => { ps.page++; renderResults() })
}

export function updateActions() {
  const actions = document.getElementById('prospectActions')!
  const count = ps.selected.size
  actions.classList.toggle('hidden', count === 0)
  document.getElementById('prospectSelectedCount')!.textContent = String(count)
}

export function renderShortlist() {
  const section = document.getElementById('shortlistSection')!
  const body = document.getElementById('shortlistBody')!
  section.classList.remove('hidden') // Always visible
  document.getElementById('shortlistCount')!.textContent = String(shortlist.length)

  body.innerHTML = shortlist.map(r => `
    <tr class="hover:bg-slate-700/30 transition-colors">
      <td class="p-3">
        <a href="https://www.twitch.tv/${esc(r.user_login)}/about" target="_blank" rel="noopener" class="text-white hover:text-indigo-400 font-semibold" title="Abrir a página Sobre do canal">${esc(r.user_name)}</a>
      </td>
      <td class="p-3 text-sm text-slate-400">${r.language === 'pt' ? '🇧🇷' : r.language === 'es' ? '🇪🇸' : '🌐'} ${esc(r.game_name)}</td>
      <td class="p-3 text-sm ${r.email ? 'text-emerald-400' : 'text-slate-500'}">${esc(r.email) || '-'}</td>
      <td class="p-3">
        <button class="shortlist-remove text-slate-400 hover:text-red-400 transition-colors cursor-pointer" data-login="${esc(r.user_login)}" title="Remover"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('')

}

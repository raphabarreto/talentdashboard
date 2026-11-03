import { fetchStreamsByGame, fetchTwitchUser } from '../../lib/twitch'
import { escapeHtml as esc } from '../../lib/escape'
import { showToast } from '../../utils'
import { streamers } from '../../state'
import { prospectingHtml, getElements, type Els } from './layout'
import { searchCategoriesCached, isCategoryCached } from './categories'
import { shortlist, setShortlist, saveShortlist, loadShortlistFromDb, formatShortlistForCopy } from './shortlist'
import { extractEmail } from './email'
import { ps } from './state'
import { getVisibleResults, renderResults, renderShortlist, updateActions } from './render'

export { searchCategoriesCached } from './categories'

// Campo de categoria com autocompletar.
function setupCategoryInput(els: Els) {
  let debounce: ReturnType<typeof setTimeout>

  els.input.addEventListener('input', () => {
    ps.gameId = ''
    clearTimeout(debounce)
    debounce = setTimeout(async () => {
      const q = els.input.value.trim()
      if (q.length < 2) { els.suggestions.classList.add('hidden'); return }
      if (!isCategoryCached(q)) {
        els.suggestions.innerHTML = '<div class="px-3 py-2 text-sm text-slate-400">Buscando categorias...</div>'
        els.suggestions.classList.remove('hidden')
      }
      try {
        const cats = await searchCategoriesCached(q)
        if (els.input.value.trim() !== q) return // resposta antiga: o texto já mudou
        if (!cats.length) { els.suggestions.classList.add('hidden'); return }
        els.suggestions.innerHTML = cats.map(c => `<div class="px-3 py-2 hover:bg-slate-700 cursor-pointer text-sm text-white" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${esc(c.name)}</div>`).join('')
        els.suggestions.classList.remove('hidden')
      } catch { els.suggestions.classList.add('hidden') }
    }, 200)
  })

  els.suggestions.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-id]') as HTMLElement
    if (!el) return
    ps.gameId = el.dataset.id!
    els.input.value = el.dataset.name!
    els.suggestions.classList.add('hidden')
  })

  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#prospectCategoryInput')) els.suggestions.classList.add('hidden')
  })
}

// Botão Buscar e filtros da busca.
function setupSearch(els: Els) {
  els.searchBtn.addEventListener('click', async () => {
    const q = els.input.value.trim()

    // Se digitou algo, busca a categoria
    if (q && !ps.gameId) {
      const cats = await searchCategoriesCached(q)
      if (!cats.length) { showToast('Categoria não encontrada', 'error'); return }
      const exact = cats.find(c => c.name.toLowerCase() === q.toLowerCase()) || cats[0]
      ps.gameId = exact.id
      els.input.value = exact.name
      els.suggestions.classList.add('hidden')
    }

    // Se não digitou nada, busca top streams globais (gameId fica vazio)
    els.searchBtn.disabled = true
    els.searchBtn.textContent = 'Buscando...'
    try {
      const language = els.language.value
      const minViewers = parseInt(els.minViewers.value) || 0
      const streams = await fetchStreamsByGame(ps.gameId, 100, language)
      ps.results = streams.map(s => ({
        user_login: s.user_login,
        user_name: s.user_name,
        viewer_count: s.viewer_count,
        game_name: s.game_name,
        description: s.user_info?.description || '',
        email: extractEmail(s.user_info?.description || ''),
        language: s.language || language
      })).filter(s => s.viewer_count >= minViewers && !streamers.some(st => st.name.toLowerCase() === s.user_name.toLowerCase()))
      ps.selected.clear()
      ps.page = 1
      renderResults()
    } catch { showToast('Erro ao buscar streams', 'error') }
    finally { els.searchBtn.disabled = false; els.searchBtn.textContent = 'Buscar' }
  })

  els.onlyEmail.addEventListener('change', () => { ps.page = 1; renderResults() })
}

// Tabela de resultados: seleção e adicionar à lista.
function setupResultsTable(els: Els) {
  els.selectAll.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    const visible = getVisibleResults()
    if (checked) visible.forEach(r => ps.selected.add(r.user_login))
    else ps.selected.clear()
    renderResults()
  })

  els.addToListBtn.addEventListener('click', () => {
    const toAdd = ps.results.filter(r => ps.selected.has(r.user_login) && !shortlist.some(s => s.user_login === r.user_login))
    shortlist.push(...toAdd)
    saveShortlist()
    ps.selected.clear()
    renderResults()
    renderShortlist()
    showToast(`${toAdd.length} adicionados à lista!`)
  })

  els.prospectBody.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    if (target.classList.contains('prospect-check')) {
      if (target.checked) ps.selected.add(target.dataset.login!)
      else ps.selected.delete(target.dataset.login!)
      updateActions()
    }
  })
}

// Minha Lista: copiar, limpar, adicionar manualmente e remover.
function setupShortlistActions(els: Els) {
  els.copyListBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(formatShortlistForCopy(shortlist))
    showToast(`Lista copiada! (${shortlist.length} streamers)`)
  })

  els.clearListBtn.addEventListener('click', () => {
    setShortlist([])
    saveShortlist()
    renderShortlist()
    showToast('Lista limpa!')
  })

  async function addManualStreamer() {
    const login = els.manualAddInput.value.trim().replace(/.*twitch\.tv\//, '').replace(/\/$/, '').toLowerCase()
    if (!login) return
    if (shortlist.some(s => s.user_login === login)) { showToast('Já está na lista!'); return }
    els.manualAddInput.value = ''
    try {
      const u = await fetchTwitchUser(login)
      if (!u) { showToast('Streamer não encontrado'); return }
      shortlist.push({ user_login: u.login, user_name: u.display_name, viewer_count: 0, game_name: u.game_name || '', email: extractEmail(u.description || ''), description: u.description || '', language: u.broadcaster_language || '' })
      saveShortlist()
      renderShortlist()
      if (ps.results.length) renderResults()
      showToast(`${u.display_name} adicionado!`)
    } catch { showToast('Erro ao buscar streamer') }
  }

  els.manualAddBtn.addEventListener('click', addManualStreamer)
  els.manualAddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addManualStreamer() })

  els.shortlistBody.addEventListener('click', (e) => {
    const removeBtn = (e.target as HTMLElement).closest('.shortlist-remove') as HTMLElement
    if (removeBtn) {
      setShortlist(shortlist.filter(s => s.user_login !== removeBtn.dataset.login))
      saveShortlist()
      renderShortlist()
      if (ps.results.length) renderResults()
    }
  })
}

export function setupProspecting() {
  document.getElementById('view-prospecting')!.innerHTML = prospectingHtml()
  const els = getElements()
  setupCategoryInput(els)
  setupSearch(els)
  setupResultsTable(els)
  setupShortlistActions(els)
  renderShortlist() // Always show
  loadShortlistFromDb(renderShortlist)
}

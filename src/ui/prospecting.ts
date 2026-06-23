import { searchCategories, fetchStreamsByGame } from '../lib/twitch'
import { showToast } from '../utils'

interface ProspectStream {
  user_login: string
  user_name: string
  viewer_count: number
  game_name: string
  email: string | null
  description: string
}

let results: ProspectStream[] = []
let selected = new Set<string>()
let page = 1
const PAGE_SIZE = 10

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g

const DEFAULT_TEMPLATE = `Fala {streamer}, tudo bem?

Sou o Raphael Barreto, responsável pelas campanhas na Lugs Hub.

Acompanho seu conteúdo e selecionei seu canal para uma possível parceria com o {empresa}.

Pelo perfil da sua comunidade e seu estilo de live, acho que a ação encaixa muito bem.

A proposta tem uma parte fixa garantida, além de um bônus por performance

Se tiver interesse, me dá um salve por aqui, pelo Discord (raphalugs) ou WhatsApp 11976732064, que te passo todos os detalhes.

Abraço!`

function extractEmail(description: string): string | null {
  const matches = description.match(EMAIL_REGEX)
  return matches?.[0] || null
}

function getTemplate(): string {
  const el = document.getElementById('emailTemplate') as HTMLTextAreaElement
  return el?.value || DEFAULT_TEMPLATE
}

function getCompany(): string {
  return (document.getElementById('prospectCompany') as HTMLInputElement)?.value.trim() || ''
}

export function setupProspecting() {
  const container = document.getElementById('view-prospecting')!
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap gap-4 items-end">
        <div class="relative">
          <label class="text-sm font-semibold text-white block mb-1">Categoria</label>
          <input id="prospectCategoryInput" type="text" placeholder="Buscar categoria..." class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[260px]">
          <div id="prospectCategorySuggestions" class="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg hidden max-h-48 overflow-y-auto"></div>
        </div>
        <div>
          <label class="text-sm font-semibold text-white block mb-1">Idioma</label>
          <select id="prospectLanguage" class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[140px]">
            <option value="pt">Português</option>
            <option value="es">Espanhol</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div>
          <label class="text-sm font-semibold text-white block mb-1">Empresa</label>
          <input id="prospectCompany" type="text" placeholder="Nome da empresa..." class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[200px]">
        </div>
        <button id="prospectSearchBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer">Buscar</button>
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" id="prospectOnlyEmail" class="w-4 h-4 rounded" checked> Só com email</label>
      </div>

      <div id="prospectActions" class="flex gap-3 hidden">
        <button id="copyListBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-copy"></i> Copiar Lista (<span id="prospectSelectedCount">0</span>)</button>
        <button id="copyEmailsBtn" class="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-envelope"></i> Copiar Emails (<span id="prospectEmailCount">0</span>)</button>
      </div>

      <div id="prospectResults" class="hidden">
        <div class="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
          <table class="w-full text-left">
            <thead class="border-b border-slate-700 text-sm text-slate-400">
              <tr>
                <th class="p-4 w-10"><input type="checkbox" id="prospectSelectAll" class="w-4 h-4 rounded"></th>
                <th class="p-4 w-[35%]">Streamer</th>
                <th class="p-4 w-[80px] text-center">Viewers</th>
                <th class="p-4 w-[35%]">Email</th>
                <th class="p-4 w-[80px]">Ações</th>
              </tr>
            </thead>
            <tbody id="prospectBody" class="divide-y divide-slate-700"></tbody>
          </table>
        </div>
        <div id="prospectPagination" class="flex items-center justify-center gap-4 mt-4"></div>
      </div>

      <details>
        <summary class="text-sm text-slate-400 cursor-pointer hover:text-white">Template de Email</summary>
        <textarea id="emailTemplate" rows="10" class="mt-2 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">${DEFAULT_TEMPLATE}</textarea>
        <p class="text-xs text-slate-500 mt-1">Variáveis: {streamer}, {empresa}</p>
      </details>
    </div>
  `

  let selectedGameId = ''

  const input = document.getElementById('prospectCategoryInput') as HTMLInputElement
  const suggestions = document.getElementById('prospectCategorySuggestions')!
  let debounce: ReturnType<typeof setTimeout>

  input.addEventListener('input', () => {
    selectedGameId = ''
    clearTimeout(debounce)
    debounce = setTimeout(async () => {
      const q = input.value.trim()
      if (q.length < 2) { suggestions.classList.add('hidden'); return }
      try {
        const cats = await searchCategories(q)
        if (!cats.length) { suggestions.classList.add('hidden'); return }
        suggestions.innerHTML = cats.map(c => `<div class="px-3 py-2 hover:bg-slate-700 cursor-pointer text-sm text-white" data-id="${c.id}" data-name="${c.name}">${c.name}</div>`).join('')
        suggestions.classList.remove('hidden')
      } catch { suggestions.classList.add('hidden') }
    }, 300)
  })

  suggestions.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-id]') as HTMLElement
    if (!el) return
    selectedGameId = el.dataset.id!
    input.value = el.dataset.name!
    suggestions.classList.add('hidden')
  })

  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#prospectCategoryInput')) suggestions.classList.add('hidden')
  })

  document.getElementById('prospectSearchBtn')!.addEventListener('click', async () => {
    if (!selectedGameId) {
      const q = input.value.trim()
      if (!q) { showToast('Digite uma categoria', 'error'); return }
      const cats = await searchCategories(q)
      if (!cats.length) { showToast('Categoria não encontrada', 'error'); return }
      const exact = cats.find(c => c.name.toLowerCase() === q.toLowerCase()) || cats[0]
      selectedGameId = exact.id
      input.value = exact.name
      suggestions.classList.add('hidden')
    }
    const btn = document.getElementById('prospectSearchBtn') as HTMLButtonElement
    btn.disabled = true; btn.textContent = 'Buscando...'
    try {
      const language = (document.getElementById('prospectLanguage') as HTMLSelectElement).value
      const streams = await fetchStreamsByGame(selectedGameId, 100, language)
      results = streams.map(s => ({
        user_login: s.user_login,
        user_name: s.user_name,
        viewer_count: s.viewer_count,
        game_name: s.game_name,
        description: s.user_info?.description || '',
        email: extractEmail(s.user_info?.description || '')
      }))
      selected.clear()
      page = 1
      renderResults()
    } catch { showToast('Erro ao buscar streams', 'error') }
    finally { btn.disabled = false; btn.textContent = 'Buscar' }
  })

  document.getElementById('prospectOnlyEmail')!.addEventListener('change', () => { page = 1; renderResults() })

  document.getElementById('prospectSelectAll')!.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    const visible = getVisibleResults()
    if (checked) visible.forEach(r => selected.add(r.user_login))
    else selected.clear()
    renderResults()
  })

  document.getElementById('copyListBtn')!.addEventListener('click', () => {
    const list = results.filter(r => selected.has(r.user_login))
      .map(r => `• ${r.user_name} — https://www.twitch.tv/${r.user_login}`)
      .join('\n')
    navigator.clipboard.writeText(list)
    showToast(`Lista copiada! (${selected.size} streamers)`)
  })

  document.getElementById('copyEmailsBtn')!.addEventListener('click', () => {
    const emails = results.filter(r => selected.has(r.user_login) && r.email).map(r => r.email!)
    navigator.clipboard.writeText(emails.join(', '))
    showToast(`${emails.length} emails copiados!`)
  })

  document.getElementById('prospectBody')!.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('.prospect-mail-link') as HTMLElement
    if (link) {
      e.preventDefault()
      const login = link.dataset.login!
      const email = link.dataset.email!
      const r = results.find(s => s.user_login === login)
      if (!r) return
      const company = getCompany()
      if (!company) { showToast('Preencha o campo Empresa', 'error'); return }
      const body = getTemplate().replace(/{streamer}/g, r.user_name).replace(/{empresa}/g, company)
      const subject = `Proposta de colaboração ${r.user_name} x ${company}`
      window.open(`https://mail.google.com/mail/?view=cm&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    }
  })

  document.getElementById('prospectBody')!.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    if (target.classList.contains('prospect-check')) {
      if (target.checked) selected.add(target.dataset.login!)
      else selected.delete(target.dataset.login!)
      updateActions()
    }
  })
}

function getVisibleResults(): ProspectStream[] {
  const onlyEmail = (document.getElementById('prospectOnlyEmail') as HTMLInputElement)?.checked
  return onlyEmail ? results.filter(r => r.email) : results
}

function renderResults() {
  const body = document.getElementById('prospectBody')!
  const wrapper = document.getElementById('prospectResults')!
  wrapper.classList.remove('hidden')
  const visible = getVisibleResults()
  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  if (page > totalPages) page = Math.max(1, totalPages)
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Nenhum streamer encontrado.</td></tr>'
    renderPagination(0)
    return
  }

  body.innerHTML = paged.map(r => `
    <tr class="hover:bg-slate-700/30 transition-colors">
      <td class="p-4"><input type="checkbox" class="prospect-check w-4 h-4 rounded" data-login="${r.user_login}" ${selected.has(r.user_login) ? 'checked' : ''}></td>
      <td class="p-4">
        <a href="https://twitch.tv/${r.user_login}" target="_blank" class="text-white hover:text-indigo-400 font-semibold text-base">${r.user_name}</a>
      </td>
      <td class="p-4 text-center">
        <span class="text-sm font-medium text-slate-300">${r.viewer_count.toLocaleString()}</span>
      </td>
      <td class="p-4">
        <span class="text-sm ${r.email ? 'text-emerald-400' : 'text-slate-500'}">${r.email || '-'}</span>
      </td>
      <td class="p-4">
        ${r.email ? `<a href="#" class="prospect-mail-link text-indigo-400 hover:text-indigo-300 font-semibold text-sm" data-login="${r.user_login}" data-email="${r.email}"><i class="fas fa-paper-plane mr-1"></i>Enviar</a>` : ''}
      </td>
    </tr>
  `).join('')

  renderPagination(totalPages)
  updateActions()
}

function renderPagination(totalPages: number) {
  const pag = document.getElementById('prospectPagination')!
  if (totalPages <= 1) { pag.innerHTML = ''; return }
  pag.innerHTML = `
    <button class="prospect-prev py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
    <span class="text-sm text-slate-400">${page} / ${totalPages}</span>
    <button class="prospect-next py-2 px-4 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm" ${page === totalPages ? 'disabled' : ''}>Próxima →</button>
  `
  pag.querySelector('.prospect-prev')?.addEventListener('click', () => { page--; renderResults() })
  pag.querySelector('.prospect-next')?.addEventListener('click', () => { page++; renderResults() })
}

function updateActions() {
  const actions = document.getElementById('prospectActions')!
  const count = selected.size
  const emailCount = results.filter(r => selected.has(r.user_login) && r.email).length
  actions.classList.toggle('hidden', count === 0)
  document.getElementById('prospectSelectedCount')!.textContent = String(count)
  document.getElementById('prospectEmailCount')!.textContent = String(emailCount)
}

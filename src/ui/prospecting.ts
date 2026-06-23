import { searchCategories, fetchStreamsByGame } from '../lib/twitch'
import { showToast } from '../utils'
import { streamers } from '../state'

interface ProspectStream {
  user_login: string
  user_name: string
  viewer_count: number
  game_name: string
  email: string | null
  description: string
  language: string
}

let results: ProspectStream[] = []
let selected = new Set<string>()
let shortlist: ProspectStream[] = JSON.parse(localStorage.getItem('prospectShortlist') || '[]')
let page = 1
const PAGE_SIZE = 10

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g

function saveShortlist() {
  localStorage.setItem('prospectShortlist', JSON.stringify(shortlist))
}

const DEFAULT_TEMPLATE_PT = `Fala {streamer}, tudo bem?

Sou o Raphael Barreto, responsável pelas campanhas na Lugs Hub.

Acompanho seu conteúdo e selecionei seu canal para uma possível parceria com o {empresa} neste mês.

Pelo perfil da sua comunidade e seu estilo de live, acho que a ação encaixa muito bem.

A proposta tem uma parte fixa garantida, além de um bônus por performance.

Se tiver interesse, me dá um salve por aqui, pelo Discord (raphalugs) ou WhatsApp 11976732064, que te passo todos os detalhes.

Abraço!`

const DEFAULT_TEMPLATE_ES = `Buenas, {streamer}

Soy Raphael Barreto, responsable de campañas en Lugs Hub.

Sigo tu contenido y he seleccionado tu canal para una posible colaboración con {empresa} durante este mes.

Por el perfil de tu comunidad y tu estilo de directos, creo que la acción encaja muy bien con lo que buscamos.

La propuesta incluye una parte fija garantizada más incentivos por resultados.

Si te interesa, avísame por aquí o por Discord (raphalugs) y te paso todos los detalles.

¡Un saludo!`

function extractEmail(description: string): string | null {
  const matches = description.match(EMAIL_REGEX)
  return matches?.[0] || null
}

function getTemplate(lang: string): string {
  if (lang === 'es') {
    const el = document.getElementById('emailTemplateEs') as HTMLTextAreaElement
    return el?.value || DEFAULT_TEMPLATE_ES
  }
  const el = document.getElementById('emailTemplatePt') as HTMLTextAreaElement
  return el?.value || DEFAULT_TEMPLATE_PT
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
          <input id="prospectCompany" type="text" placeholder="Nome da empresa..." value="${localStorage.getItem('prospectCompany') || ''}" class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[200px]">
        </div>
        <div>
          <label class="text-sm font-semibold text-white block mb-1">Viewers mín.</label>
          <input id="prospectMinViewers" type="number" value="50" class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[100px]">
        </div>
        <button id="prospectSearchBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer">Buscar</button>
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" id="prospectOnlyEmail" class="w-4 h-4 rounded" checked> Só com email</label>
      </div>

      <div id="prospectActions" class="flex gap-3 hidden">
        <button id="addToListBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-plus"></i> Adicionar à Lista (<span id="prospectSelectedCount">0</span>)</button>
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

      <div id="shortlistSection" class="hidden">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-white font-semibold text-base"><i class="fas fa-list mr-2"></i>Minha Lista (<span id="shortlistCount">0</span>)</h3>
          <div class="flex gap-3">
            <button id="copyListBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-copy mr-1"></i>Copiar Lista</button>
            <button id="copyEmailsBtn" class="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-envelope mr-1"></i>Copiar Emails</button>
            <button id="clearListBtn" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-trash mr-1"></i>Limpar</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
          <table class="w-full text-left">
            <thead class="border-b border-slate-700 text-sm text-slate-400">
              <tr>
                <th class="p-3">Streamer</th>
                <th class="p-3">Categoria</th>
                <th class="p-3">Email</th>
                <th class="p-3">Ações</th>
              </tr>
            </thead>
            <tbody id="shortlistBody" class="divide-y divide-slate-700"></tbody>
          </table>
        </div>
      </div>

      <details>
        <summary class="text-sm text-slate-400 cursor-pointer hover:text-white">Templates de Email</summary>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <label class="text-xs font-semibold text-slate-300 block mb-1">🇧🇷 Português</label>
            <textarea id="emailTemplatePt" rows="8" class="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">${DEFAULT_TEMPLATE_PT}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-300 block mb-1">🇪🇸 Español</label>
            <textarea id="emailTemplateEs" rows="8" class="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">${DEFAULT_TEMPLATE_ES}</textarea>
          </div>
        </div>
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
      const minViewers = parseInt((document.getElementById('prospectMinViewers') as HTMLInputElement).value) || 0
      const streams = await fetchStreamsByGame(selectedGameId, 100, language)
      results = streams.map(s => ({
        user_login: s.user_login,
        user_name: s.user_name,
        viewer_count: s.viewer_count,
        game_name: s.game_name,
        description: s.user_info?.description || '',
        email: extractEmail(s.user_info?.description || ''),
        language
      })).filter(s => s.viewer_count >= minViewers && !streamers.some(st => st.name.toLowerCase() === s.user_name.toLowerCase()))
      selected.clear()
      page = 1
      renderResults()
    } catch { showToast('Erro ao buscar streams', 'error') }
    finally { btn.disabled = false; btn.textContent = 'Buscar' }
  })

  document.getElementById('prospectOnlyEmail')!.addEventListener('change', () => { page = 1; renderResults() })
  document.getElementById('prospectCompany')!.addEventListener('input', (e) => { localStorage.setItem('prospectCompany', (e.target as HTMLInputElement).value) })

  document.getElementById('prospectSelectAll')!.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    const visible = getVisibleResults()
    if (checked) visible.forEach(r => selected.add(r.user_login))
    else selected.clear()
    renderResults()
  })

  document.getElementById('addToListBtn')!.addEventListener('click', () => {
    const toAdd = results.filter(r => selected.has(r.user_login) && !shortlist.some(s => s.user_login === r.user_login))
    shortlist.push(...toAdd)
    saveShortlist()
    selected.clear()
    renderResults()
    renderShortlist()
    showToast(`${toAdd.length} adicionados à lista!`)
  })

  document.getElementById('copyListBtn')!.addEventListener('click', () => {
    const br = shortlist.filter(r => r.language === 'pt')
    const es = shortlist.filter(r => r.language === 'es')
    const other = shortlist.filter(r => r.language !== 'pt' && r.language !== 'es')
    let list = ''
    if (br.length) list += `🇧🇷 Brazil\n${br.map(r => `• ${r.user_name} — https://www.twitch.tv/${r.user_login}`).join('\n')}\n\n`
    if (es.length) list += `🇪🇸 Spain\n${es.map(r => `• ${r.user_name} — https://www.twitch.tv/${r.user_login}`).join('\n')}\n\n`
    if (other.length) list += `🌐 Others\n${other.map(r => `• ${r.user_name} — https://www.twitch.tv/${r.user_login}`).join('\n')}\n`
    navigator.clipboard.writeText(list.trim())
    showToast(`Lista copiada! (${shortlist.length} streamers)`)
  })

  document.getElementById('copyEmailsBtn')!.addEventListener('click', () => {
    const emails = shortlist.filter(r => r.email).map(r => r.email!)
    navigator.clipboard.writeText(emails.join(', '))
    showToast(`${emails.length} emails copiados!`)
  })

  document.getElementById('clearListBtn')!.addEventListener('click', () => {
    shortlist = []
    saveShortlist()
    renderShortlist()
    showToast('Lista limpa!')
  })

  document.getElementById('shortlistBody')!.addEventListener('click', (e) => {
    const removeBtn = (e.target as HTMLElement).closest('.shortlist-remove') as HTMLElement
    if (removeBtn) {
      shortlist = shortlist.filter(s => s.user_login !== removeBtn.dataset.login)
      saveShortlist()
      renderShortlist()
    }
    const link = (e.target as HTMLElement).closest('.shortlist-mail-link') as HTMLElement
    if (link) {
      e.preventDefault()
      const r = shortlist.find(s => s.user_login === link.dataset.login)
      if (!r || !r.email) return
      const company = getCompany()
      if (!company) { showToast('Preencha o campo Empresa', 'error'); return }
      const body = getTemplate(r.language).replace(/{streamer}/g, r.user_name).replace(/{empresa}/g, company)
      const subject = r.language === 'es' ? `Propuesta de Colaboración ${r.user_name} x ${company}` : `Proposta de colaboração ${r.user_name} x ${company}`
      window.open(`https://mail.google.com/mail/?view=cm&to=${r.email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    }
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
      const body = getTemplate(r.language).replace(/{streamer}/g, r.user_name).replace(/{empresa}/g, company)
      const subject = r.language === 'es' ? `Propuesta de Colaboración ${r.user_name} x ${company}` : `Proposta de colaboração ${r.user_name} x ${company}`
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

  if (shortlist.length) renderShortlist()
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

  body.innerHTML = paged.map(r => {
    const inList = shortlist.some(s => s.user_login === r.user_login)
    return `
    <tr class="hover:bg-slate-700/30 transition-colors ${inList ? 'opacity-50' : ''}">
      <td class="p-4"><input type="checkbox" class="prospect-check w-4 h-4 rounded" data-login="${r.user_login}" ${selected.has(r.user_login) ? 'checked' : ''} ${inList ? 'disabled' : ''}></td>
      <td class="p-4">
        <a href="https://twitch.tv/${r.user_login}" target="_blank" class="text-white hover:text-indigo-400 font-semibold text-base">${r.user_name}</a>${inList ? ' <span class="text-xs text-slate-500">✓ na lista</span>' : ''}
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
  `}).join('')

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
  actions.classList.toggle('hidden', count === 0)
  document.getElementById('prospectSelectedCount')!.textContent = String(count)
}

function renderShortlist() {
  const section = document.getElementById('shortlistSection')!
  const body = document.getElementById('shortlistBody')!
  section.classList.toggle('hidden', shortlist.length === 0)
  document.getElementById('shortlistCount')!.textContent = String(shortlist.length)

  body.innerHTML = shortlist.map(r => `
    <tr class="hover:bg-slate-700/30 transition-colors">
      <td class="p-3">
        <a href="https://twitch.tv/${r.user_login}" target="_blank" class="text-white hover:text-indigo-400 font-semibold">${r.user_name}</a>
      </td>
      <td class="p-3 text-sm text-slate-400">${r.language === 'pt' ? '🇧🇷' : r.language === 'es' ? '🇪🇸' : '🌐'} ${r.game_name}</td>
      <td class="p-3 text-sm ${r.email ? 'text-emerald-400' : 'text-slate-500'}">${r.email || '-'}</td>
      <td class="p-3 flex gap-3">
        ${r.email ? `<a href="#" class="shortlist-mail-link text-indigo-400 hover:text-indigo-300 font-semibold text-sm" data-login="${r.user_login}"><i class="fas fa-paper-plane"></i></a>` : ''}
        <button class="shortlist-remove text-red-400 hover:text-red-300 cursor-pointer text-sm" data-login="${r.user_login}"><i class="fas fa-times"></i></button>
      </td>
    </tr>
  `).join('')
}

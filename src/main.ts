import { getSession, signOut, onAuthChange } from './lib/auth'
import { supabase } from './lib/supabase'
import { getStreamers, addStreamer, deleteStreamer, getStreamerHistory, getCampaigns, addCampaign, updateCampaign, deleteCampaign } from './lib/data'
import { fetchTwitchUser } from './lib/twitch'
import type { Streamer, Campaign } from './types'
import './style.css'

// --- Estado ---
let streamers: Streamer[] = []
let campaigns: Campaign[] = []
let currentSort = { key: 'avg_viewers', order: 'desc' as 'asc' | 'desc' }
const selectedStreamers = new Set<string>()
const PAGE_SIZE = 12
let overviewPage = 1
let tablePage = 1
let editingCampaignId: string | null = null

// --- Auth ---
async function init() {
  const session = await getSession()
  if (!session) { window.location.href = '/login.html'; return }
  await loadData()
  setupNav()
  setupAutocomplete('streamerCategoryInput', 'streamerCategorySuggestions')
  setupAutocomplete('categoryInput', 'categorySuggestions')
  renderAll()
  document.getElementById('loading-overlay')?.classList.add('hidden')
}
onAuthChange((loggedIn) => { if (!loggedIn) window.location.href = '/login.html' })

async function loadData() {
  ;[streamers, campaigns] = await Promise.all([getStreamers(), getCampaigns()])
}

// --- Helpers ---
function getExistingCategories(): string[] {
  return [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()
}

function setupAutocomplete(inputId: string, suggestionsId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement
  const suggestions = document.getElementById(suggestionsId)!

  input.addEventListener('focus', () => showSuggestions(input, suggestions))
  input.addEventListener('input', () => showSuggestions(input, suggestions))
  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target as Node) && e.target !== input) suggestions.classList.add('hidden')
  })
}

function showSuggestions(input: HTMLInputElement, container: HTMLElement) {
  const cats = getExistingCategories()
  const val = input.value.toLowerCase()
  const filtered = val ? cats.filter(c => c.toLowerCase().includes(val)) : cats
  if (!filtered.length) { container.classList.add('hidden'); return }
  container.innerHTML = filtered.map(c => `<div class="px-4 py-2 hover:bg-slate-600 cursor-pointer text-white text-sm">${c}</div>`).join('')
  container.classList.remove('hidden')
  container.querySelectorAll('div').forEach(el => {
    el.addEventListener('click', () => { input.value = el.textContent!; container.classList.add('hidden') })
  })
}

const langToCountry: Record<string, string> = {
  pt: 'br', en: 'us', es: 'es', fr: 'fr', de: 'de', it: 'it', ja: 'jp', ko: 'kr', ru: 'ru', zh: 'cn', pl: 'pl', nl: 'nl', sv: 'se'
}
const countryNames: Record<string, string> = {
  us: 'Estados Unidos', br: 'Brasil', ca: 'Canadá', de: 'Alemanha', fr: 'França', gb: 'Reino Unido', es: 'Espanha', jp: 'Japão',
  kr: 'Coreia do Sul', mx: 'México', ar: 'Argentina', it: 'Itália', au: 'Austrália', in: 'Índia', ru: 'Rússia', cn: 'China',
  se: 'Suécia', pl: 'Polônia', nl: 'Holanda', pt: 'Portugal'
}
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const fmt = (n: number) => n.toLocaleString('pt-BR')
const fmtCurrency = (n: number) => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const toast = document.getElementById('toast')!
  const toastMsg = document.getElementById('toast-message')!
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`
  toastMsg.textContent = msg
  toast.classList.remove('translate-y-[200%]')
  toast.classList.add('translate-y-0')
  setTimeout(() => { toast.classList.remove('translate-y-0'); toast.classList.add('translate-y-[200%]') }, 3000)
}

// --- Navigation ---
function setupNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const viewId = (link as HTMLElement).dataset.view!
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${viewId}`))
      document.querySelectorAll('.nav-link').forEach(l => {
        const isActive = (l as HTMLElement).dataset.view === viewId
        l.classList.toggle('border-indigo-500', isActive)
        l.classList.toggle('text-indigo-400', isActive)
        l.classList.toggle('border-transparent', !isActive)
        l.classList.toggle('text-slate-400', !isActive)
      })
    })
  })
  document.querySelector('.nav-link')?.dispatchEvent(new Event('click'))
}

// --- Filters ---
function getFilteredStreamers(prefix: string) {
  const search = (document.getElementById(`search-${prefix}`) as HTMLInputElement)?.value.toLowerCase() || ''
  const country = (document.getElementById(prefix === 'overview' ? 'country-filter' : 'country-filter-table') as HTMLSelectElement)?.value || 'all'
  const status = (document.getElementById(`status-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'
  const category = (document.getElementById(`category-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'

  return streamers
    .filter(s => !search || s.name.toLowerCase().includes(search))
    .filter(s => country === 'all' || s.country === country)
    .filter(s => status === 'all' || (status === 'active' ? s.is_active : !s.is_active))
    .filter(s => category === 'all' || s.main_category?.toLowerCase() === category)
    .sort((a, b) => {
      const aVal = a[currentSort.key as keyof Streamer] as number
      const bVal = b[currentSort.key as keyof Streamer] as number
      return currentSort.order === 'desc' ? bVal - aVal : aVal - bVal
    })
}

function populateFilters() {
  const countries = [...new Set(streamers.map(s => s.country).filter(Boolean))].sort()
  const categories = [...new Set(streamers.map(s => s.main_category?.toLowerCase()).filter(Boolean))].sort()

  ;['country-filter', 'country-filter-table'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement
    const val = el.value
    el.innerHTML = '<option value="all">Todos os Países</option>'
    countries.forEach(c => { el.innerHTML += `<option value="${c}">${countryNames[c] || c.toUpperCase()}</option>` })
    el.value = val || 'all'
  })
  ;['category-filter-overview', 'category-filter-table'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement
    if (!el) return
    const val = el.value
    el.innerHTML = '<option value="all">Todas Categorias</option>'
    categories.forEach(c => { el.innerHTML += `<option value="${c}">${c.replace(/\b\w/g, l => l.toUpperCase())}</option>` })
    el.value = val || 'all'
  })
}


// --- Render Overview ---
function renderOverview() {
  const grid = document.getElementById('overview-grid')!
  const data = getFilteredStreamers('overview')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (overviewPage > totalPages) overviewPage = Math.max(1, totalPages)
  const paged = data.slice((overviewPage - 1) * PAGE_SIZE, overviewPage * PAGE_SIZE)
  grid.innerHTML = ''

  if (data.length === 0) {
    grid.innerHTML = '<p class="text-slate-400 text-sm col-span-full text-center py-8">Nenhum streamer encontrado.</p>'
    return
  }

  paged.forEach(s => {
    const flagHtml = s.country ? `<span class="fi fi-${s.country} w-5 h-5 rounded-full shadow-md"></span> ${countryNames[s.country] || s.country}` : '-'
    const card = document.createElement('div')
    card.className = 'bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:scale-105 transition-transform'
    card.innerHTML = `
      <div class="flex items-center mb-4">
        <div class="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-xl mr-4">${s.name.charAt(0).toUpperCase()}</div>
        <div class="flex-1">
          <a href="https://twitch.tv/${s.name.toLowerCase()}" target="_blank" class="text-xl font-bold text-white hover:text-indigo-400 transition-colors">${s.name}</a>
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
        <button class="text-xs text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer history-btn" data-id="${s.id}" data-name="${s.name}">Histórico</button>
        <button class="text-xs text-red-500 hover:text-red-400 font-semibold cursor-pointer delete-btn" data-id="${s.id}">Remover</button>
      </div>
    `
    grid.appendChild(card)
  })

  // Paginação
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
    pag.querySelector('.prev-overview')?.addEventListener('click', () => { overviewPage--; renderOverview() })
    pag.querySelector('.next-overview')?.addEventListener('click', () => { overviewPage++; renderOverview() })
  }
}

// --- Render Table ---
function renderTable() {
  const tbody = document.getElementById('table-body')!
  const data = getFilteredStreamers('table')
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  if (tablePage > totalPages) tablePage = Math.max(1, totalPages)
  const paged = data.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
  tbody.innerHTML = ''

  paged.forEach(s => {
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4"><input type="checkbox" class="streamer-checkbox w-4 h-4 rounded" data-id="${s.id}" ${selectedStreamers.has(s.id) ? 'checked' : ''}></td>
      <td class="p-4 font-medium"><button class="history-btn text-left hover:text-indigo-400 transition-colors" data-id="${s.id}" data-name="${s.name}">${s.name}</button></td>
      <td class="p-4">${fmt(s.avg_viewers)}</td>
      <td class="p-4"><a href="https://twitch.tv/${s.name.toLowerCase()}" target="_blank" class="text-indigo-400 hover:underline">twitch.tv/${s.name.toLowerCase()}</a></td>
      <td class="p-4"><a href="https://sullygnome.com/channel/${s.name.toLowerCase()}/30" target="_blank" class="text-indigo-400 hover:underline">Ver no SullyGnome</a></td>
      <td class="p-4"><button class="text-sm text-red-500 hover:text-red-400 font-semibold delete-btn" data-id="${s.id}">Remover</button></td>
    `
    tbody.appendChild(row)
  })

  // Paginação da tabela
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
    pag.querySelector('.prev-table')?.addEventListener('click', () => { tablePage--; renderTable() })
    pag.querySelector('.next-table')?.addEventListener('click', () => { tablePage++; renderTable() })
  }

  updateSelectionButtons()
}


// --- Render Campaigns ---
function renderCampaigns() {
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
    const total = c.campaign_streamers?.reduce((sum, s) => sum + Number(s.payment || 0), 0) || 0
    grandTotal += total
    const row = document.createElement('tr')
    row.className = 'hover:bg-slate-700/50 transition-colors'
    row.innerHTML = `
      <td class="p-4">${c.company}</td>
      <td class="p-4">${fmtDate(c.start_date)}</td>
      <td class="p-4">${fmtDate(c.end_date)}</td>
      <td class="p-4 font-semibold">${fmtCurrency(total)}</td>
      <td class="p-4 flex gap-3">
        <button class="text-amber-500 hover:text-amber-400 text-sm font-semibold edit-campaign-btn" data-id="${c.id}">Editar</button>
        <button class="text-indigo-500 hover:text-indigo-400 text-sm font-semibold details-campaign-btn" data-id="${c.id}">Detalhes</button>
        <button class="text-red-500 hover:text-red-400 text-sm font-semibold delete-campaign-btn" data-id="${c.id}">Remover</button>
      </td>
    `
    tbody.appendChild(row)
  })

  document.getElementById('monthly-total')!.textContent = fmtCurrency(grandTotal)
  populateCampaignFilters()
}

function populateCampaignFilters() {
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

// --- History Modal ---
async function showHistory(id: string, name: string) {
  const modal = document.getElementById('historyModal')!
  const title = document.getElementById('historyTitle')!
  const content = document.getElementById('historyContent')!
  title.textContent = `Histórico - ${name}`
  content.innerHTML = '<p class="text-slate-400">Carregando...</p>'
  modal.classList.remove('hidden')

  const docs = await getStreamerHistory(id)
  if (!docs.length) {
    content.innerHTML = '<p class="text-slate-400">Nenhum histórico disponível. O cron vai começar a popular automaticamente.</p>'
    return
  }

  const maxAvg = Math.max(...docs.map(h => h.avg_viewers || 0))
  let html = '<div class="space-y-2 mb-6">'
  ;[...docs].reverse().forEach(h => {
    const pct = maxAvg > 0 ? ((h.avg_viewers || 0) / maxAvg * 100) : 0
    const [y, m] = h.month.split('-')
    const short = monthNames[parseInt(m) - 1]?.slice(0, 3) || h.month
    html += `<div class="flex items-center gap-2 text-xs">
      <span class="w-16 text-slate-400">${short} ${y}</span>
      <div class="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden"><div class="bg-indigo-500 h-full rounded-full" style="width:${pct}%"></div></div>
      <span class="w-14 text-right text-slate-300">${fmt(h.avg_viewers)}</span>
    </div>`
  })
  html += '</div>'

  html += `<table class="w-full text-sm text-left"><thead class="border-b border-slate-600 text-slate-400"><tr><th class="p-3">Mês</th><th class="p-3">Média</th><th class="p-3">Pico</th><th class="p-3">Hrs Assistidas</th><th class="p-3">Hrs Streamadas</th></tr></thead><tbody class="divide-y divide-slate-700">`
  docs.forEach(h => {
    const [y, m] = h.month.split('-')
    html += `<tr class="hover:bg-slate-700/50"><td class="p-3">${monthNames[parseInt(m) - 1]} ${y}</td><td class="p-3">${fmt(h.avg_viewers)}</td><td class="p-3">${fmt(h.peak_viewers)}</td><td class="p-3">${fmt(h.hours_watched)}</td><td class="p-3">${fmt(h.hours_streamed)}</td></tr>`
  })
  html += '</tbody></table>'
  content.innerHTML = html
}

// --- Selection ---
function updateSelectionButtons() {
  const count = selectedStreamers.size
  document.getElementById('generatePdfBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('setCategoryBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('removeSelectedBtn')!.classList.toggle('hidden', count === 0)
  document.getElementById('selectedCount')!.textContent = String(count)
  document.getElementById('selectedCountCategory')!.textContent = String(count)
  document.getElementById('selectedCountRemove')!.textContent = String(count)
}


// --- Confirm Modal ---
function confirmAction(text: string, btnText = 'Remover'): Promise<boolean> {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal')!
    document.getElementById('confirmText')!.textContent = text
    document.getElementById('confirmYes')!.textContent = btnText
    modal.classList.remove('hidden')
    const yes = document.getElementById('confirmYes')!
    const no = document.getElementById('confirmNo')!
    const cleanup = () => { modal.classList.add('hidden'); yes.replaceWith(yes.cloneNode(true)); no.replaceWith(no.cloneNode(true)) }
    document.getElementById('confirmYes')!.addEventListener('click', () => { cleanup(); resolve(true) }, { once: true })
    document.getElementById('confirmNo')!.addEventListener('click', () => { cleanup(); resolve(false) }, { once: true })
  })
}

// --- Render All ---
function renderAll() {
  populateFilters()
  renderOverview()
  renderTable()
  renderCampaigns()
}

// --- Event Listeners ---
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement

  if (target.classList.contains('delete-btn')) {
    const id = target.dataset.id!
    if (!await confirmAction('Você tem certeza que deseja remover este streamer?')) return
    await deleteStreamer(id)
    await loadData(); renderAll()
    showToast('Streamer removido!')
  }

  if (target.classList.contains('history-btn')) {
    const id = target.dataset.id!
    const name = target.dataset.name!
    await showHistory(id, name)
  }

  if (target.classList.contains('edit-campaign-btn')) {
    const id = target.dataset.id!
    const c = campaigns.find(cp => cp.id === id)
    if (!c) return
    editingCampaignId = id
    document.getElementById('campaignModalTitle')!.textContent = 'Editar Campanha'
    document.getElementById('saveCampaignBtn')!.textContent = 'Atualizar'
    ;(document.getElementById('companyInput') as HTMLInputElement).value = c.company
    ;(document.getElementById('startDateInput') as HTMLInputElement).value = c.start_date
    ;(document.getElementById('endDateInput') as HTMLInputElement).value = c.end_date
    ;(document.getElementById('globalPaymentDate') as HTMLInputElement).value = c.campaign_streamers?.[0]?.payment_date || ''
    ;(document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value = c.campaign_streamers?.map(s => `${s.streamer_name}:${s.payment || 0}`).join('\n') || ''
    document.getElementById('campaignModal')!.classList.remove('hidden')
  }

  if (target.classList.contains('details-campaign-btn')) {
    const id = target.dataset.id!
    const c = campaigns.find(cp => cp.id === id)
    if (!c) return
    document.getElementById('detailsTitle')!.textContent = c.company
    document.getElementById('detailsCompany')!.textContent = c.company
    document.getElementById('detailsPeriod')!.textContent = `${fmtDate(c.start_date)} a ${fmtDate(c.end_date)}`
    const total = c.campaign_streamers?.reduce((sum, s) => sum + Number(s.payment || 0), 0) || 0
    document.getElementById('detailsTotal')!.textContent = fmtCurrency(total)
    const payDate = c.campaign_streamers?.find(s => s.payment_date)?.payment_date
    document.getElementById('detailsPaymentDate')!.textContent = payDate ? fmtDate(payDate) : '-'
    const tbody = document.getElementById('detailsStreamers')!
    tbody.innerHTML = ''
    c.campaign_streamers?.forEach(s => {
      tbody.innerHTML += `<tr class="hover:bg-slate-700/50"><td class="p-2">${s.streamer_name}</td><td class="p-2">${fmtCurrency(Number(s.payment || 0))}</td></tr>`
    })
    document.getElementById('campaignDetailsModal')!.classList.remove('hidden')
  }

  if (target.classList.contains('delete-campaign-btn')) {
    const id = target.dataset.id!
    if (!await confirmAction('Você tem certeza que deseja remover esta campanha?')) return
    await deleteCampaign(id)
    await loadData(); renderAll()
    showToast('Campanha removida!')
  }
})

// Checkbox handling
document.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement
  if (target.classList.contains('streamer-checkbox')) {
    target.checked ? selectedStreamers.add(target.dataset.id!) : selectedStreamers.delete(target.dataset.id!)
    updateSelectionButtons()
  }
})

document.getElementById('selectAll')?.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) { getFilteredStreamers('table').forEach(s => selectedStreamers.add(s.id)) }
  else { selectedStreamers.clear() }
  renderTable()
})

// Filter listeners
;['search-overview', 'country-filter', 'status-filter-overview', 'category-filter-overview'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => { overviewPage = 1; renderOverview() })
  document.getElementById(id)?.addEventListener('change', () => { overviewPage = 1; renderOverview() })
})
;['search-table', 'country-filter-table', 'status-filter-table', 'category-filter-table'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => { tablePage = 1; renderTable() })
  document.getElementById(id)?.addEventListener('change', () => { tablePage = 1; renderTable() })
})
;['month-filter', 'year-filter'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderCampaigns)
})

// Sort headers
document.querySelectorAll('[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = (th as HTMLElement).dataset.sort!
    if (currentSort.key === key) currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc'
    else { currentSort.key = key; currentSort.order = 'desc' }
    renderTable()
  })
})

// Add Streamer
document.getElementById('openAddStreamer')?.addEventListener('click', () => document.getElementById('addStreamerModal')!.classList.remove('hidden'))
document.getElementById('closeAddStreamer')?.addEventListener('click', () => document.getElementById('addStreamerModal')!.classList.add('hidden'))
document.getElementById('addStreamerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = document.getElementById('streamerNameInput') as HTMLInputElement
  const btn = e.target as HTMLFormElement
  const submitBtn = btn.querySelector('button[type="submit"]') as HTMLButtonElement
  const name = input.value.trim()
  if (!name) return
  submitBtn.disabled = true
  submitBtn.textContent = 'Buscando...'
  try {
    const user = await fetchTwitchUser(name)
    if (!user) throw new Error('Streamer não encontrado.')
    if (streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())) throw new Error('Já cadastrado.')
    const lang = user.broadcaster_language?.split('-')[0]
    const category = (document.getElementById('streamerCategoryInput') as HTMLInputElement).value.trim()
    await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: 0, peak_viewers: 0, hours_watched: 0, hours_streamed: 0, is_active: true, main_category: category })
    await loadData(); renderAll()
    input.value = ''
    ;(document.getElementById('streamerCategoryInput') as HTMLInputElement).value = ''
    document.getElementById('addStreamerModal')!.classList.add('hidden')
    showToast('Streamer adicionado!')
  } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', 'error') }
  finally { submitBtn.disabled = false; submitBtn.textContent = 'Buscar e Salvar' }
})

// Add Multiple
document.getElementById('addMultipleBtn')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.remove('hidden'))
document.getElementById('closeMultipleModal')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.add('hidden'))
document.getElementById('saveMultipleBtn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('multipleNamesInput') as HTMLTextAreaElement
  const names = textarea.value.split('\n').map(n => n.trim()).filter(n => n)
  if (!names.length) return
  const progress = document.getElementById('multipleProgress')!
  progress.classList.remove('hidden')
  let added = 0
  for (let i = 0; i < names.length; i++) {
    progress.textContent = `Buscando ${i + 1}/${names.length}: ${names[i]}...`
    try {
      const user = await fetchTwitchUser(names[i])
      if (!user) continue
      if (streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())) continue
      const lang = user.broadcaster_language?.split('-')[0]
      await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: 0, peak_viewers: 0, hours_watched: 0, hours_streamed: 0, is_active: true, main_category: '' })
      added++
    } catch { /* skip */ }
  }
  progress.classList.add('hidden')
  document.getElementById('addMultipleModal')!.classList.add('hidden')
  await loadData(); renderAll()
  showToast(`${added}/${names.length} streamers adicionados!`)
})

// Refresh All
document.getElementById('refreshAllBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refreshAllBtn')!
  btn.textContent = 'Atualizando...'

  // Buscar quem esteve live nos últimos 30 dias via snapshots
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: liveSnapshots } = await supabase
    .from('stream_snapshots')
    .select('streamer_id')
    .eq('is_live', true)
    .gte('captured_at', thirtyDaysAgo)

  const activeIds = new Set((liveSnapshots || []).map(s => s.streamer_id))

  // Batch: ativos e inativos em 2 queries
  const activeList = streamers.filter(s => activeIds.has(s.id)).map(s => s.id)
  const inactiveList = streamers.filter(s => !activeIds.has(s.id)).map(s => s.id)

  if (activeList.length) await supabase.from('streamers').update({ is_active: true }).in('id', activeList)
  if (inactiveList.length) await supabase.from('streamers').update({ is_active: false }).in('id', inactiveList)

  await loadData(); renderAll()
  btn.textContent = 'Atualizar Todos'
  showToast('Status atualizado com base nos últimos 30 dias!')
})

// Campaigns
document.getElementById('openAddCampaign')?.addEventListener('click', () => {
  editingCampaignId = null
  document.getElementById('campaignModalTitle')!.textContent = 'Adicionar Campanha'
  document.getElementById('saveCampaignBtn')!.textContent = 'Salvar'
  ;(document.getElementById('campaignForm') as HTMLFormElement).reset()
  document.getElementById('campaignModal')!.classList.remove('hidden')
})
document.getElementById('closeCampaignModal')?.addEventListener('click', () => document.getElementById('campaignModal')!.classList.add('hidden'))
document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const company = (document.getElementById('companyInput') as HTMLInputElement).value
  const startDate = (document.getElementById('startDateInput') as HTMLInputElement).value
  const endDate = (document.getElementById('endDateInput') as HTMLInputElement).value
  const paymentDate = (document.getElementById('globalPaymentDate') as HTMLInputElement).value || null

  // Validação de datas
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || start.getFullYear() < 2020 || start.getFullYear() > 2030) {
    showToast('Data de início inválida', 'error'); return
  }
  if (isNaN(end.getTime()) || end.getFullYear() < 2020 || end.getFullYear() > 2030) {
    showToast('Data de fim inválida', 'error'); return
  }
  if (end < start) {
    showToast('Data de fim não pode ser antes da data de início', 'error'); return
  }
  if (paymentDate) {
    const pay = new Date(paymentDate)
    if (isNaN(pay.getTime()) || pay.getFullYear() < 2020 || pay.getFullYear() > 2030) {
      showToast('Data de pagamento inválida', 'error'); return
    }
  }

  const lines = (document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value.split('\n').map(n => n.trim()).filter(n => n)

  const streamerRows = lines.map(line => {
    const [name, payment] = line.split(':')
    return { streamer_name: name.trim(), payment: Number(payment) || 0, payment_date: paymentDate }
  })

  if (editingCampaignId) {
    await updateCampaign(editingCampaignId, { company, start_date: startDate, end_date: endDate }, streamerRows)
    showToast('Campanha atualizada!')
  } else {
    await addCampaign({ company, start_date: startDate, end_date: endDate }, streamerRows)
    showToast('Campanha adicionada!')
  }

  editingCampaignId = null
  await loadData(); renderAll()
  document.getElementById('campaignModal')!.classList.add('hidden')
})

// Remove selected
document.getElementById('removeSelectedBtn')?.addEventListener('click', async () => {
  if (!await confirmAction(`Remover ${selectedStreamers.size} streamers?`)) return
  await supabase.from('streamers').delete().in('id', [...selectedStreamers])
  selectedStreamers.clear()
  await loadData(); renderAll()
  showToast('Streamers removidos!')
})

// Generate PDF
document.getElementById('generatePdfBtn')?.addEventListener('click', async () => {
  const selected = streamers.filter(s => selectedStreamers.has(s.id))
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Lista de Streamers', 14, 20)
  autoTable(doc, {
    startY: 30,
    head: [['Nome', 'Twitch', 'Média de Viewers']],
    body: selected.map(s => [s.name, `twitch.tv/${s.name.toLowerCase()}`, fmt(s.avg_viewers)]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [79, 70, 229] },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const name = selected[data.row.index]?.name?.toLowerCase()
        if (name) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: `https://twitch.tv/${name}` })
      }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = [79, 70, 229]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  })
  doc.save('streamers.pdf')
})

// Close modals
document.getElementById('closeDetailsModal')?.addEventListener('click', () => document.getElementById('campaignDetailsModal')!.classList.add('hidden'))
document.getElementById('closeHistoryModal')?.addEventListener('click', () => document.getElementById('historyModal')!.classList.add('hidden'))
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (await confirmAction('Deseja sair?', 'Sair')) signOut()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))
})

// Set Category
document.getElementById('setCategoryBtn')?.addEventListener('click', () => {
  document.getElementById('categoryCount')!.textContent = String(selectedStreamers.size)
  ;(document.getElementById('categoryInput') as HTMLInputElement).value = ''
  document.getElementById('categoryModal')!.classList.remove('hidden')
})
document.getElementById('closeCategoryModal')?.addEventListener('click', () => document.getElementById('categoryModal')!.classList.add('hidden'))
document.getElementById('saveCategoryBtn')?.addEventListener('click', async () => {
  const category = (document.getElementById('categoryInput') as HTMLInputElement).value.trim()
  if (!category) { showToast('Digite uma categoria', 'error'); return }
  await supabase.from('streamers').update({ main_category: category }).in('id', [...selectedStreamers])
  selectedStreamers.clear()
  await loadData(); renderAll()
  document.getElementById('categoryModal')!.classList.add('hidden')
  showToast(`Categoria "${category}" aplicada!`)
})

// --- Init ---
init()

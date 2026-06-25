import { getSession, signOut, onAuthChange } from './lib/auth'
import { supabase } from './lib/supabase'
import { getStreamers, addStreamer, deleteStreamer, getCampaigns, addCampaign, updateCampaign, deleteCampaign, updateContactStatus } from './lib/data'
import { fetchTwitchUser, fetchInitialStats, fetchLastLiveDate } from './lib/twitch'
import { streamers, campaigns, selectedStreamers, currentSort, editingCampaignId, setStreamers, setCampaigns, setOverviewPage, setTablePage, setEditingCampaignId } from './state'
import { showToast, confirmAction, fmtDate, fmtCurrency, fmt, langToCountry } from './utils'
import { renderOverview } from './ui/overview'
import { renderTable } from './ui/table'
import { renderCampaigns } from './ui/campaigns'
import { showHistory } from './ui/history'
import { populateFilters, setupAutocomplete, getExistingCompanies, getFilteredStreamers } from './ui/filters'
import { setupProspecting } from './ui/prospecting'
import './style.css'

// --- Init ---
async function init() {
  const session = await getSession()
  if (!session) { window.location.href = '/login.html'; return }
  await loadData()
  setupNav()
  setupProspecting()
  setupAutocomplete('streamerCategoryInput', 'streamerCategorySuggestions')
  setupAutocomplete('categoryInput', 'categorySuggestions')
  setupAutocomplete('companyInput', 'companySuggestions', getExistingCompanies)
  renderAll()
  document.getElementById('loading-overlay')?.classList.add('hidden')
}
onAuthChange((loggedIn) => { if (!loggedIn) window.location.href = '/login.html' })

async function loadData() {
  const [s, c] = await Promise.all([getStreamers(), getCampaigns()])
  setStreamers(s)
  setCampaigns(c)
}

function renderAll() {
  populateFilters()
  renderOverview()
  renderTable()
  renderCampaigns()
}

// --- Navigation ---
function setupNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const viewId = (link as HTMLElement).dataset.view!
      sessionStorage.setItem('activeTab', viewId)
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${viewId}`))
      document.querySelectorAll('.nav-link').forEach(l => {
        const active = (l as HTMLElement).dataset.view === viewId
        l.classList.toggle('border-indigo-500', active)
        l.classList.toggle('text-indigo-400', active)
        l.classList.toggle('border-transparent', !active)
        l.classList.toggle('text-slate-400', !active)
      })
      const streamerBtns = viewId === 'overview' || viewId === 'table'
      const campaignBtn = viewId === 'campaigns'
      document.getElementById('addMultipleBtn')!.classList.toggle('hidden', !streamerBtns)
      document.getElementById('openAddStreamer')!.classList.toggle('hidden', !streamerBtns)
      document.getElementById('openAddCampaign')!.classList.toggle('hidden', !campaignBtn)
    })
  })
  const saved = sessionStorage.getItem('activeTab')
  const target = saved ? document.querySelector(`.nav-link[data-view="${saved}"]`) : document.querySelector('.nav-link')
  target?.dispatchEvent(new Event('click'))
}

// --- Event Listeners ---
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement

  const deleteBtn = target.closest('.delete-btn') as HTMLElement | null
  if (deleteBtn) {
    const id = deleteBtn.dataset.id!
    if (!await confirmAction('Você tem certeza que deseja remover este streamer?')) return
    await deleteStreamer(id)
    selectedStreamers.delete(id)
    await loadData(); renderAll()
    showToast('Streamer removido!')
  }

  const historyBtn = target.closest('.history-btn') as HTMLElement | null
  if (historyBtn) {
    await showHistory(historyBtn.dataset.id!, historyBtn.dataset.name!)
  }

  const editBtn = target.closest('.edit-campaign-btn') as HTMLElement | null
  if (editBtn) {
    const c = campaigns.find(cp => cp.id === editBtn.dataset.id!)
    if (!c) return
    setEditingCampaignId(c.id)
    document.getElementById('campaignModalTitle')!.textContent = 'Editar Campanha'
    document.getElementById('saveCampaignBtn')!.textContent = 'Atualizar'
    ;(document.getElementById('companyInput') as HTMLInputElement).value = c.company
    ;(document.getElementById('startDateInput') as HTMLInputElement).value = c.start_date
    ;(document.getElementById('endDateInput') as HTMLInputElement).value = c.end_date
    ;(document.getElementById('campaignValueInput') as HTMLInputElement).value = c.campaign_value ? String(c.campaign_value) : ''
    ;(document.getElementById('currencyInput') as HTMLSelectElement).value = c.currency || 'USD'
    ;(document.getElementById('myCommissionInput') as HTMLInputElement).value = c.my_commission ? String(c.my_commission) : ''
    ;(document.getElementById('paymentDateInput') as HTMLInputElement).value = c.payment_date || ''
    ;(document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value = c.campaign_streamers?.map(s => s.streamer_name).join('\n') || ''
    document.getElementById('campaignModal')!.classList.remove('hidden')
  }

  const detailsBtn = target.closest('.details-campaign-btn') as HTMLElement | null
  if (detailsBtn) {
    const c = campaigns.find(cp => cp.id === detailsBtn.dataset.id!)
    if (!c) return
    document.getElementById('detailsTitle')!.textContent = c.company
    document.getElementById('detailsCompany')!.textContent = c.company
    document.getElementById('detailsPeriod')!.textContent = `${fmtDate(c.start_date)} a ${fmtDate(c.end_date)}`
    const valueTxt = c.currency === 'USD' ? `US$ ${(c.campaign_value || 0).toFixed(2)}` : fmtCurrency(c.campaign_value || 0)
    document.getElementById('detailsCampaignValue')!.textContent = valueTxt
    document.getElementById('detailsCommission')!.textContent = fmtCurrency(c.my_commission || 0)
    document.getElementById('detailsPaymentDate')!.textContent = c.payment_date ? fmtDate(c.payment_date) : 'Pendente'
    const tbody = document.getElementById('detailsStreamers')!
    tbody.innerHTML = ''
    const statusColors: Record<string, string> = { pendente: 'bg-slate-500', contatado: 'bg-amber-500', nao_respondeu: 'bg-orange-500', confirmado: 'bg-emerald-500', recusado: 'bg-red-500' }
    const selectColors: Record<string, string> = { pendente: 'bg-slate-700', contatado: 'bg-amber-700', nao_respondeu: 'bg-orange-700', confirmado: 'bg-emerald-700', recusado: 'bg-red-700' }
    const statusOrder: Record<string, number> = { pendente: 0, contatado: 1, nao_respondeu: 2, confirmado: 3, recusado: 4 }
    const counts = { pendente: 0, contatado: 0, nao_respondeu: 0, confirmado: 0, recusado: 0 }
    const sorted = [...(c.campaign_streamers || [])].sort((a, b) => (statusOrder[a.contact_status || 'pendente'] || 0) - (statusOrder[b.contact_status || 'pendente'] || 0))
    sorted.forEach(s => {
      const st = s.contact_status || 'pendente'
      counts[st as keyof typeof counts]++
      tbody.innerHTML += `<tr class="hover:bg-slate-700/50" data-status="${st}"><td class="p-2">${s.streamer_name}</td><td class="p-2 text-right whitespace-nowrap"><select class="contact-status-select ${selectColors[st]} text-white text-sm rounded px-3 py-1.5 border border-slate-600 cursor-pointer" data-id="${s.id}"><option value="pendente"${st === 'pendente' ? ' selected' : ''}>Pendente</option><option value="contatado"${st === 'contatado' ? ' selected' : ''}>Contatado</option><option value="nao_respondeu"${st === 'nao_respondeu' ? ' selected' : ''}>Não respondeu</option><option value="confirmado"${st === 'confirmado' ? ' selected' : ''}>Confirmado</option><option value="recusado"${st === 'recusado' ? ' selected' : ''}>Recusado</option></select></td></tr>`
    })
    const summary = document.getElementById('detailsStatusSummary')!
    summary.innerHTML = Object.entries(counts).filter(([,v]) => v > 0).map(([k,v]) => `<span class="${statusColors[k]} text-white px-2 py-1 rounded-full">${v} ${k}</span>`).join('')
    ;(document.getElementById('detailsSearch') as HTMLInputElement).value = ''
    document.querySelectorAll('.status-filter-btn').forEach(b => { b.className = 'status-filter-btn px-2 py-1 rounded bg-slate-600 text-slate-300'; b.removeAttribute('data-active') })
    const allBtn = document.querySelector('.status-filter-btn[data-filter="all"]')!
    allBtn.className = 'status-filter-btn px-2 py-1 rounded bg-indigo-600 text-white'
    allBtn.setAttribute('data-active', 'true')
    document.getElementById('campaignDetailsModal')!.classList.remove('hidden')
  }

  const deleteCampaignBtn = target.closest('.delete-campaign-btn') as HTMLElement | null
  if (deleteCampaignBtn) {
    if (!await confirmAction('Você tem certeza que deseja remover esta campanha?')) return
    await deleteCampaign(deleteCampaignBtn.dataset.id!)
    await loadData(); renderAll()
    showToast('Campanha removida!')
  }
})

// Checkbox handling
document.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement
  if (target.classList.contains('streamer-checkbox')) {
    target.checked ? selectedStreamers.add(target.dataset.id!) : selectedStreamers.delete(target.dataset.id!)
    renderTable()
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
  document.getElementById(id)?.addEventListener('input', () => { setOverviewPage(1); renderOverview() })
  document.getElementById(id)?.addEventListener('change', () => { setOverviewPage(1); renderOverview() })
})
;['search-table', 'country-filter-table', 'status-filter-table', 'category-filter-table'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => { setTablePage(1); renderTable() })
  document.getElementById(id)?.addEventListener('change', () => { setTablePage(1); renderTable() })
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
  const submitBtn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement
  const name = input.value.trim()
  if (!name) return
  submitBtn.disabled = true; submitBtn.textContent = 'Buscando...'
  try {
    const user = await fetchTwitchUser(name)
    if (!user) throw new Error('Streamer não encontrado.')
    if (streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())) throw new Error('Já cadastrado.')
    const lang = user.broadcaster_language?.split('-')[0]
    const category = (document.getElementById('streamerCategoryInput') as HTMLInputElement).value.trim()
    const stats = await fetchInitialStats(user.login)
    await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: category })
    const lastLive = await fetchLastLiveDate(user.id)
    if (lastLive) {
      const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
      if (added) await supabase.from('streamers').update({ last_live_at: lastLive }).eq('id', added.id)
    }
    await loadData(); renderAll()
    input.value = ''; (document.getElementById('streamerCategoryInput') as HTMLInputElement).value = ''
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
  const names = textarea.value.split('\n').map(line => {
    const l = line.trim()
    const urlMatch = l.match(/twitch\.tv\/([^\s\/]+)/)
    if (urlMatch) return urlMatch[1].replace(/[_\\]/g, m => m === '\\' ? '' : m)
    return l.split('-')[0].trim()
  }).filter(n => n)
  if (!names.length) return
  const progress = document.getElementById('multipleProgress')!
  progress.classList.remove('hidden')
  let added = 0
  let processed = 0
  const BATCH_SIZE = 5
  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE)
    progress.textContent = `Buscando ${i + 1}-${Math.min(i + BATCH_SIZE, names.length)}/${names.length}...`
    const results = await Promise.allSettled(batch.map(async (name) => {
      const user = await fetchTwitchUser(name)
      if (!user) return false
      if (streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())) return false
      const lang = user.broadcaster_language?.split('-')[0]
      const stats = await fetchInitialStats(user.login)
      await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' })
      return true
    }))
    for (const r of results) { if (r.status === 'fulfilled' && r.value) added++ }
    processed += batch.length
  }
  progress.classList.add('hidden')
  textarea.value = ''
  document.getElementById('addMultipleModal')!.classList.add('hidden')
  await loadData(); renderAll()
  showToast(`${added}/${names.length} streamers adicionados!`)
})

// Campaigns
document.getElementById('openAddCampaign')?.addEventListener('click', () => {
  setEditingCampaignId(null)
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
  const campaignValue = Number((document.getElementById('campaignValueInput') as HTMLInputElement).value) || 0
  const currency = (document.getElementById('currencyInput') as HTMLSelectElement).value as 'BRL' | 'USD'
  const myCommission = Number((document.getElementById('myCommissionInput') as HTMLInputElement).value) || 0
  const paymentDate = (document.getElementById('paymentDateInput') as HTMLInputElement).value || null

  const start = new Date(startDate), end = new Date(endDate)
  if (isNaN(start.getTime()) || start.getFullYear() < 2020 || start.getFullYear() > 2030) { showToast('Data de início inválida', 'error'); return }
  if (isNaN(end.getTime()) || end.getFullYear() < 2020 || end.getFullYear() > 2030) { showToast('Data de fim inválida', 'error'); return }
  if (end < start) { showToast('Data de fim não pode ser antes da data de início', 'error'); return }
  if (paymentDate && new Date(paymentDate) < start) { showToast('Data de pagamento não pode ser antes da data de início', 'error'); return }

  const lines = (document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value.split('\n').map(n => n.trim()).filter(n => n)
  const streamerRows = lines.map(line => {
    const dashMatch = line.match(/^(.+?)\s*[-–]\s*\$/)
    const name = dashMatch ? dashMatch[1].trim() : line.split(':')[0].trim()
    return { streamer_name: name, payment: 0, payment_date: null as string | null }
  })

  if (editingCampaignId) {
    await updateCampaign(editingCampaignId, { company, start_date: startDate, end_date: endDate, campaign_value: campaignValue, currency, my_commission: myCommission, payment_date: paymentDate }, streamerRows)
    showToast('Campanha atualizada!')
  } else {
    await addCampaign({ company, start_date: startDate, end_date: endDate, campaign_value: campaignValue, currency, my_commission: myCommission, payment_date: paymentDate }, streamerRows)
    showToast('Campanha adicionada!')
  }

  setEditingCampaignId(null)
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

document.getElementById('campaignDetailsModal')?.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement

  // Filter buttons
  const btn = target.closest('.status-filter-btn') as HTMLElement | null
  if (btn) {
    document.querySelectorAll('.status-filter-btn').forEach(b => { b.className = 'status-filter-btn px-2 py-1 rounded bg-slate-600 text-slate-300'; b.removeAttribute('data-active') })
    btn.className = 'status-filter-btn px-2 py-1 rounded bg-indigo-600 text-white'
    btn.setAttribute('data-active', 'true')
    filterDetailsStreamers()
    return
  }

})

function filterDetailsStreamers() {
  const activeBtn = document.querySelector('.status-filter-btn[data-active="true"]') as HTMLElement | null
  const filter = activeBtn?.dataset.filter || 'all'
  const search = (document.getElementById('detailsSearch') as HTMLInputElement).value.toLowerCase()
  document.querySelectorAll('#detailsStreamers tr').forEach(row => {
    const name = row.querySelector('td')!.textContent!.toLowerCase()
    const status = row.getAttribute('data-status')
    const matchStatus = filter === 'all' || status === filter
    const matchSearch = !search || name.includes(search)
    ;(row as HTMLElement).style.display = matchStatus && matchSearch ? '' : 'none'
  })
}

document.getElementById('detailsSearch')?.addEventListener('input', filterDetailsStreamers)

document.getElementById('campaignDetailsModal')?.addEventListener('change', async (e) => {
  const select = e.target as HTMLSelectElement
  if (!select.classList.contains('contact-status-select')) return
  const newStatus = select.value as any
  const id = select.dataset.id!

  // Update UI immediately
  const selectColors: Record<string, string> = { pendente: 'bg-slate-700', contatado: 'bg-amber-700', confirmado: 'bg-emerald-700', recusado: 'bg-red-700' }
  select.className = `contact-status-select ${selectColors[newStatus]} text-white text-sm rounded px-3 py-1.5 border border-slate-600 cursor-pointer`
  select.closest('tr')!.setAttribute('data-status', newStatus)

  // Update state
  const idx = campaigns.findIndex(c => c.campaign_streamers?.some(s => s.id === id))
  if (idx >= 0) {
    const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
    s.contact_status = newStatus
  }

  // Update badges
  const counts = { pendente: 0, contatado: 0, confirmado: 0, recusado: 0 }
  const statusColors: Record<string, string> = { pendente: 'bg-slate-500', contatado: 'bg-amber-500', confirmado: 'bg-emerald-500', recusado: 'bg-red-500' }
  if (idx >= 0) campaigns[idx].campaign_streamers?.forEach(s => { counts[(s.contact_status || 'pendente') as keyof typeof counts]++ })
  document.getElementById('detailsStatusSummary')!.innerHTML = Object.entries(counts).filter(([,v]) => v > 0).map(([k,v]) => `<span class="${statusColors[k]} text-white px-2 py-1 rounded-full">${v} ${k}</span>`).join('')
  filterDetailsStreamers()
  renderCampaigns()

  // Save to DB
  try {
    await updateContactStatus(id, newStatus)
  } catch { showToast('Erro ao salvar status', 'error'); return }

  // Auto-cadastrar no painel quando confirmar
  if (newStatus === 'confirmado' && idx >= 0) {
    const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
    if (!streamers.some(st => st.name.toLowerCase() === s.streamer_name.toLowerCase())) {
      try {
        const user = await fetchTwitchUser(s.streamer_name)
        if (user) {
          const lang = user.broadcaster_language?.split('-')[0]
          const stats = await fetchInitialStats(user.login)
          await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' })
          const lastLive = await fetchLastLiveDate(user.id)
          if (lastLive) {
            const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
            if (added) await supabase.from('streamers').update({ last_live_at: lastLive }).eq('id', added.id)
          }
          setStreamers(await getStreamers())
        }
      } catch { /* ignora */ }
    }
  }
  showToast('Status atualizado!')
})
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

// Lookup
document.getElementById('openLookup')?.addEventListener('click', () => {
  document.getElementById('lookupResult')!.classList.add('hidden')
  document.getElementById('lookupError')!.classList.add('hidden')
  document.getElementById('lookupActions')!.classList.add('hidden')
  document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
  ;(document.getElementById('lookupInput') as HTMLInputElement).value = ''
  document.getElementById('lookupModal')!.classList.remove('hidden')
})
document.getElementById('closeLookupModal')?.addEventListener('click', () => document.getElementById('lookupModal')!.classList.add('hidden'))
document.getElementById('closeLookupModalAlt')?.addEventListener('click', () => document.getElementById('lookupModal')!.classList.add('hidden'))

let lookupUser: any = null
let lookupStats: any = null

async function doLookup() {
  const input = document.getElementById('lookupInput') as HTMLInputElement
  const name = input.value.trim()
  if (!name) return
  const btn = document.getElementById('lookupSearchBtn') as HTMLButtonElement
  btn.disabled = true; btn.textContent = 'Buscando...'
  document.getElementById('lookupResult')!.classList.add('hidden')
  document.getElementById('lookupError')!.classList.add('hidden')
  document.getElementById('lookupActions')!.classList.add('hidden')
  document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
  lookupUser = null; lookupStats = null
  try {
    const user = await fetchTwitchUser(name)
    if (!user) throw new Error('Streamer não encontrado.')
    lookupUser = user
    document.getElementById('lookupAvatar')!.setAttribute('src', user.profile_image_url || '')
    document.getElementById('lookupName')!.textContent = user.display_name
    const link = document.getElementById('lookupTwitchLink') as HTMLAnchorElement
    link.href = `https://twitch.tv/${user.login}`
    link.textContent = `twitch.tv/${user.login}`
    const stats = await fetchInitialStats(user.login)
    lookupStats = stats
    document.getElementById('lookupAvgViewers')!.textContent = fmt(stats?.avg_viewers || 0)
    document.getElementById('lookupPeakViewers')!.textContent = fmt(stats?.peak_viewers || 0)
    document.getElementById('lookupHoursWatched')!.textContent = fmt(stats?.hours_watched || 0)
    document.getElementById('lookupHoursStreamed')!.textContent = fmt(stats?.hours_streamed || 0)
    document.getElementById('lookupResult')!.classList.remove('hidden')
    const alreadyAdded = streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())
    if (alreadyAdded) {
      document.getElementById('lookupActions')!.classList.add('hidden')
      document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
    } else {
      document.getElementById('lookupActions')!.classList.remove('hidden')
      document.getElementById('closeLookupModalAlt')!.classList.add('hidden')
    }
  } catch (err: unknown) {
    const el = document.getElementById('lookupError')!
    el.textContent = err instanceof Error ? err.message : 'Erro ao buscar'
    el.classList.remove('hidden')
  } finally { btn.disabled = false; btn.textContent = 'Buscar' }
}
document.getElementById('lookupSearchBtn')?.addEventListener('click', doLookup)
document.getElementById('lookupInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLookup() })

document.getElementById('lookupAddBtn')?.addEventListener('click', async () => {
  if (!lookupUser) return
  const btn = document.getElementById('lookupAddBtn') as HTMLButtonElement
  btn.disabled = true; btn.textContent = 'Adicionando...'
  try {
    const lang = lookupUser.broadcaster_language?.split('-')[0]
    await addStreamer({ name: lookupUser.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: lookupStats?.avg_viewers || 0, peak_viewers: lookupStats?.peak_viewers || 0, hours_watched: lookupStats?.hours_watched || 0, hours_streamed: lookupStats?.hours_streamed || 0, main_category: '' })
    const lastLive = await fetchLastLiveDate(lookupUser.id)
    if (lastLive) {
      const added = (await supabase.from('streamers').select('id').eq('name', lookupUser.display_name).single()).data
      if (added) await supabase.from('streamers').update({ last_live_at: lastLive }).eq('id', added.id)
    }
    await loadData(); renderAll()
    document.getElementById('lookupModal')!.classList.add('hidden')
    showToast('Streamer adicionado!')
  } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', 'error') }
  finally { btn.disabled = false; btn.textContent = '+ Adicionar' }
})

// Manage Categories
document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => {
  renderCategoriesList()
  document.getElementById('manageCategoriesModal')!.classList.remove('hidden')
})
document.getElementById('closeManageCategories')?.addEventListener('click', () => document.getElementById('manageCategoriesModal')!.classList.add('hidden'))

function renderCategoriesList() {
  const categories = [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()
  const container = document.getElementById('categoriesList')!
  if (!categories.length) { container.innerHTML = '<p class="text-slate-400 text-sm">Nenhuma categoria cadastrada.</p>'; return }
  container.innerHTML = categories.map(c => {
    const count = streamers.filter(s => s.main_category === c).length
    return `<div class="flex items-center gap-2 bg-slate-700/50 rounded-lg px-4 py-3">
      <span class="text-white text-sm font-medium truncate flex-1">${c}</span>
      <span class="text-slate-400 text-xs">${count}</span>
      <button class="rename-cat-btn text-indigo-400 hover:text-indigo-300 text-sm ml-2" data-cat="${c}"><i class="fas fa-pen"></i></button>
      <button class="delete-cat-btn text-slate-400 hover:text-red-400 text-sm" data-cat="${c}"><i class="fas fa-trash"></i></button>
    </div>`
  }).join('')
  container.querySelectorAll('.rename-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oldName = (btn as HTMLElement).dataset.cat!
      const row = btn.closest('div')!
      const nameEl = row.querySelector('span')!
      const input = document.createElement('input')
      input.type = 'text'; input.value = oldName
      input.className = 'px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1'
      nameEl.replaceWith(input)
      input.focus(); input.select()
      const save = async () => {
        const newName = input.value.trim()
        if (!newName || newName === oldName) { renderCategoriesList(); return }
        await supabase.from('streamers').update({ main_category: newName }).eq('main_category', oldName)
        await loadData(); renderAll(); renderCategoriesList()
        showToast(`Categoria renomeada para "${newName}"`)
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderCategoriesList() })
      input.addEventListener('blur', save)
    })
  })
  container.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = (btn as HTMLElement).dataset.cat!
      const count = streamers.filter(s => s.main_category === cat).length
      if (!await confirmAction(`Remover a categoria "${cat}" de ${count} streamer${count > 1 ? 's' : ''}?`)) return
      await supabase.from('streamers').update({ main_category: '' }).eq('main_category', cat)
      await loadData(); renderAll(); renderCategoriesList()
      showToast(`Categoria "${cat}" removida`)
    })
  })
}

init()

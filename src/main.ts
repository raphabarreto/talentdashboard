import { getSession, signOut, onAuthChange } from './lib/auth'
import { supabase } from './lib/supabase'
import { getStreamers, addStreamer, deleteStreamer, getCampaigns, addCampaign, updateCampaign, deleteCampaign } from './lib/data'
import { fetchTwitchUser, fetchInitialStats, fetchLastLiveDate } from './lib/twitch'
import { streamers, campaigns, selectedStreamers, currentSort, editingCampaignId, setStreamers, setCampaigns, setOverviewPage, setTablePage, setEditingCampaignId } from './state'
import { showToast, confirmAction, fmtDate, fmtCurrency, fmt, langToCountry } from './utils'
import { renderOverview } from './ui/overview'
import { renderTable } from './ui/table'
import { renderCampaigns } from './ui/campaigns'
import { showHistory } from './ui/history'
import { populateFilters, setupAutocomplete, getExistingCompanies, getFilteredStreamers } from './ui/filters'
import './style.css'

// --- Init ---
async function init() {
  const session = await getSession()
  if (!session) { window.location.href = '/login.html'; return }
  await loadData()
  setupNav()
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
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${viewId}`))
      document.querySelectorAll('.nav-link').forEach(l => {
        const active = (l as HTMLElement).dataset.view === viewId
        l.classList.toggle('border-indigo-500', active)
        l.classList.toggle('text-indigo-400', active)
        l.classList.toggle('border-transparent', !active)
        l.classList.toggle('text-slate-400', !active)
      })
    })
  })
  document.querySelector('.nav-link')?.dispatchEvent(new Event('click'))
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
    await showHistory(target.dataset.id!, target.dataset.name!)
  }

  if (target.classList.contains('edit-campaign-btn')) {
    const c = campaigns.find(cp => cp.id === target.dataset.id!)
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
    ;(document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value = c.campaign_streamers?.map(s => `${s.streamer_name}${s.payment ? ':' + s.payment : ''}`).join('\n') || ''
    document.getElementById('campaignModal')!.classList.remove('hidden')
  }

  if (target.classList.contains('details-campaign-btn')) {
    const c = campaigns.find(cp => cp.id === target.dataset.id!)
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
    c.campaign_streamers?.forEach(s => {
      tbody.innerHTML += `<tr class="hover:bg-slate-700/50"><td class="p-2">${s.streamer_name}</td><td class="p-2">${fmtCurrency(Number(s.payment || 0))}</td></tr>`
    })
    document.getElementById('campaignDetailsModal')!.classList.remove('hidden')
  }

  if (target.classList.contains('delete-campaign-btn')) {
    if (!await confirmAction('Você tem certeza que deseja remover esta campanha?')) return
    await deleteCampaign(target.dataset.id!)
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
      const stats = await fetchInitialStats(user.login)
      await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' })
      const lastLive = await fetchLastLiveDate(user.id)
      if (lastLive) {
        const rec = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
        if (rec) await supabase.from('streamers').update({ last_live_at: lastLive }).eq('id', rec.id)
      }
      added++
    } catch { /* skip */ }
  }
  progress.classList.add('hidden')
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
    const [name, payment] = line.split(':')
    return { streamer_name: name.trim(), payment: Number(payment) || 0, payment_date: null as string | null }
  })

  // Auto-cadastrar streamers que não existem
  for (const row of streamerRows) {
    if (!streamers.some(s => s.name.toLowerCase() === row.streamer_name.toLowerCase())) {
      try {
        const user = await fetchTwitchUser(row.streamer_name)
        if (user) {
          const lang = user.broadcaster_language?.split('-')[0]
          const stats = await fetchInitialStats(user.login)
          await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' })
          const lastLive = await fetchLastLiveDate(user.id)
          if (lastLive) {
            const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
            if (added) await supabase.from('streamers').update({ last_live_at: lastLive }).eq('id', added.id)
          }
        }
      } catch { /* ignora */ }
    }
  }

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

init()

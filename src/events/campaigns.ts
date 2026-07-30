import { supabase } from '../lib/supabase'
import { addStreamer, addCampaign, updateCampaign, deleteCampaign, updateContactStatus, getStreamers, updateLastLive } from '../lib/data'
import { fetchTwitchUser, fetchInitialStats, fetchLastLiveDate } from '../lib/twitch'
import { streamers, campaigns, editingCampaignId, setCampaigns, setEditingCampaignId, setStreamers } from '../state'
import { showToast, confirmAction, fmtDate, fmtCurrency, langToCountry, sanitizeCurrencyInput } from '../utils'
import { renderCampaigns } from '../ui/campaigns'
import { campaignSchema } from '../lib/validators'
import { logError, setButtonLoading } from '../lib/logger'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

// Estado local do modal de detalhes (não precisa ser global)
let detailsActiveFilter: string = 'pendente'
let detailsCampaignId: string | null = null
function setDetailsCampaignId(id: string | null) { detailsCampaignId = id }

const statusFinalBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/20 text-emerald-400',
  recusado: 'bg-red-500/20 text-red-400',
  nao_respondeu: 'bg-orange-500/20 text-orange-400'
}
const statusChipClass: Record<string, string> = {
  pendente: 'bg-slate-500/20 text-slate-300',
  contatado: 'bg-amber-500/20 text-amber-400',
  confirmado: 'bg-emerald-500/20 text-emerald-400',
  recusado: 'bg-red-500/20 text-red-400',
  nao_respondeu: 'bg-orange-500/20 text-orange-400'
}
const statusChipLabel: Record<string, string> = {
  pendente: 'pendentes',
  contatado: 'contatados',
  confirmado: 'confirmados',
  recusado: 'recusados',
  nao_respondeu: 'não respondeu'
}
const statusOutline: Record<string, string> = {
  pendente: 'outline-slate-400',
  contatado: 'outline-amber-400',
  confirmado: 'outline-emerald-400',
  recusado: 'outline-red-400',
  nao_respondeu: 'outline-orange-400',
  all: 'outline-slate-400'
}

function renderDetailsChips(c: typeof campaigns[number]) {
  const order = ['pendente', 'contatado', 'confirmado', 'nao_respondeu', 'recusado']
  const counts: Record<string, number> = { pendente: 0, contatado: 0, confirmado: 0, recusado: 0, nao_respondeu: 0 }
  c.campaign_streamers?.forEach(s => { counts[s.contact_status || 'pendente']++ })
  const container = document.getElementById('detailsStatusChips')!
  container.innerHTML = order.filter(k => counts[k] > 0).map(k =>
    `<button data-filter="${k}" class="status-filter-btn px-3 py-1.5 rounded text-sm font-semibold ${statusChipClass[k]}">${counts[k]} ${statusChipLabel[k]}</button>`
  ).join('')

  const total = c.campaign_streamers?.length || 0
  const jaContatados = total - counts.pendente
  document.getElementById('detailsProgressText')!.textContent = total > 0 ? `${jaContatados} de ${total} já contatados` : ''
  ;(document.getElementById('detailsProgressBar') as HTMLElement).style.width = total > 0 ? `${Math.round((jaContatados / total) * 100)}%` : '0%'
  highlightActiveChip()
}

function highlightActiveChip() {
  document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('outline', 'outline-2', 'outline-slate-400', 'outline-amber-400', 'outline-emerald-400', 'outline-red-400', 'outline-orange-400'))
  const active = document.querySelector(`.status-filter-btn[data-filter="${detailsActiveFilter}"]`)
  active?.classList.add('outline', 'outline-2', statusOutline[detailsActiveFilter])
}

function renderDetailsList(c: typeof campaigns[number]) {
  const search = (document.getElementById('detailsSearch') as HTMLInputElement).value.toLowerCase()
  const list = document.getElementById('detailsStreamers')!
  const all = c.campaign_streamers || []
  const filtered = all.filter(s => {
    const st = s.contact_status || 'pendente'
    const matchStatus = detailsActiveFilter === 'all' || st === detailsActiveFilter
    const matchSearch = !search || s.streamer_name.toLowerCase().includes(search)
    return matchStatus && matchSearch
  })
  list.innerHTML = ''
  document.getElementById('detailsEmptyState')!.classList.toggle('hidden', filtered.length > 0)

  filtered.forEach(s => {
    const st = s.contact_status || 'pendente'
    const row = document.createElement('div')
    row.className = 'flex items-center justify-between gap-2 bg-slate-700/40 hover:bg-slate-700/70 rounded-lg px-3 py-2 transition-colors'
    row.dataset.id = s.id

    let actions = ''
    if (st === 'pendente') {
      actions = `
        <button data-next="contatado" class="quick-status-btn text-sm font-semibold px-3 py-1.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 whitespace-nowrap"><i class="fas fa-paper-plane mr-1"></i>Marcar contatado</button>
        <button data-next="recusado" class="quick-status-btn text-sm px-2 py-1.5 rounded bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400" title="Recusado"><i class="fas fa-times"></i></button>
      `
    } else if (st === 'contatado') {
      actions = `
        <button data-next="confirmado" class="quick-status-btn text-sm font-semibold px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap"><i class="fas fa-check mr-1"></i>Marcar confirmado</button>
        <button data-next="nao_respondeu" class="quick-status-btn text-sm px-2 py-1.5 rounded bg-slate-700 text-slate-400 hover:bg-orange-500/20 hover:text-orange-400" title="Não respondeu"><i class="fas fa-clock"></i></button>
        <button data-next="recusado" class="quick-status-btn text-sm px-2 py-1.5 rounded bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400" title="Recusado"><i class="fas fa-times"></i></button>
      `
    } else {
      actions = `
        <span class="text-sm font-semibold px-3 py-1.5 rounded ${statusFinalBadge[st] || 'bg-slate-500/20 text-slate-300'}">${st === 'nao_respondeu' ? 'Não respondeu' : st.charAt(0).toUpperCase() + st.slice(1)}</span>
        <button data-next="pendente" class="quick-status-btn text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-300" title="Desfazer"><i class="fas fa-undo"></i></button>
      `
    }

    row.innerHTML = `<span class="text-white text-sm font-medium">${s.streamer_name}</span><span class="flex items-center gap-1.5">${actions}</span>`
    list.appendChild(row)
  })
}

export function setupCampaignsEvents({ loadData, renderAll }: Callbacks) {
  // Delegated clicks for campaign buttons
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    // Edit campaign
    const editBtn = target.closest('.edit-campaign-btn') as HTMLElement | null
    if (editBtn) {
      const c = campaigns.find(cp => cp.id === editBtn.dataset.id!)
      if (!c) return
      setEditingCampaignId(c.id)
      document.getElementById('campaignModalTitle')!.textContent = 'Editar Campanha'
      document.getElementById('saveCampaignBtn')!.textContent = 'Atualizar'
      document.getElementById('saveAndAddAnotherBtn')!.classList.add('hidden')
      ;(document.getElementById('companyInput') as HTMLInputElement).value = c.company
      ;(document.getElementById('startDateInput') as HTMLInputElement).value = c.start_date
      ;(document.getElementById('endDateInput') as HTMLInputElement).value = c.end_date
      ;(document.getElementById('totalReceivedInput') as HTMLInputElement).value = c.total_received ? c.total_received.toFixed(2).replace('.', ',') : ''
      ;(document.getElementById('myCommissionInput') as HTMLInputElement).value = c.my_commission ? c.my_commission.toFixed(2).replace('.', ',') : ''
      ;(document.getElementById('currencyInput') as HTMLSelectElement).value = c.currency || 'USD'
      ;(document.getElementById('paymentDateInput') as HTMLInputElement).value = c.payment_date || ''
      ;(document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value = c.campaign_streamers?.map(s => s.streamer_name).join('\n') || ''
      ;(document.getElementById('alreadyConfirmedInput') as HTMLInputElement).checked = false
      document.getElementById('campaignModal')!.classList.remove('hidden')
    }

    // Details campaign
    const detailsBtn = target.closest('.details-campaign-btn') as HTMLElement | null
    if (detailsBtn) {
      const c = campaigns.find(cp => cp.id === detailsBtn.dataset.id!)
      if (!c) return
      setDetailsCampaignId(c.id)
      document.getElementById('detailsTitle')!.textContent = c.company
      document.getElementById('detailsCompany')!.textContent = c.company
      document.getElementById('detailsPeriod')!.textContent = `${fmtDate(c.start_date)} a ${fmtDate(c.end_date)}`
      const totalReceived = c.total_received || 0
      const myCommission = c.my_commission || 0
      const valueTxt = c.currency === 'USD' ? `US$ ${totalReceived.toFixed(2)}` : fmtCurrency(totalReceived)
      document.getElementById('detailsCampaignValue')!.textContent = valueTxt
      document.getElementById('detailsCommission')!.textContent = fmtCurrency(myCommission)
      document.getElementById('detailsPaymentDate')!.textContent = c.payment_date ? fmtDate(c.payment_date) : 'Pendente'

      const hasPending = c.campaign_streamers?.some(s => (s.contact_status || 'pendente') === 'pendente')
      detailsActiveFilter = hasPending ? 'pendente' : 'all'
      ;(document.getElementById('detailsSearch') as HTMLInputElement).value = ''
      renderDetailsChips(c)
      renderDetailsList(c)
      document.getElementById('campaignDetailsModal')!.classList.remove('hidden')
    }

    // Delete campaign
    const deleteCampaignBtn = target.closest('.delete-campaign-btn') as HTMLElement | null
    if (deleteCampaignBtn) {
      if (!await confirmAction('Você tem certeza que deseja remover esta campanha?')) return
      const id = deleteCampaignBtn.dataset.id!
      setCampaigns(campaigns.filter(c => c.id !== id))
      renderAll()
      showToast('Campanha removida!')
      deleteCampaign(id).catch(() => showToast('Erro ao remover do banco', 'error'))
    }
  })

  // Bloqueia caracteres não numéricos nos campos de valor (permite apenas dígitos e vírgula decimal)
  ;['totalReceivedInput', 'myCommissionInput'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement
      const sanitized = sanitizeCurrencyInput(input.value)
      if (sanitized !== input.value) input.value = sanitized
    })
  })

  // Data de pagamento não pode ser antes da data de fim da campanha
  document.getElementById('endDateInput')?.addEventListener('change', (e) => {
    const endDate = (e.target as HTMLInputElement).value
    const paymentDateInput = document.getElementById('paymentDateInput') as HTMLInputElement
    if (endDate) paymentDateInput.min = endDate
  })

  // Campaign form
  document.getElementById('openAddCampaignInline')?.addEventListener('click', () => {
    setEditingCampaignId(null)
    document.getElementById('campaignModalTitle')!.textContent = 'Adicionar Campanha'
    document.getElementById('saveCampaignBtn')!.textContent = 'Salvar'
    document.getElementById('saveAndAddAnotherBtn')!.classList.remove('hidden')
    ;(document.getElementById('campaignForm') as HTMLFormElement).reset()
    document.getElementById('campaignModal')!.classList.remove('hidden')
  })
  document.getElementById('closeCampaignModal')?.addEventListener('click', () => document.getElementById('campaignModal')!.classList.add('hidden'))
  setupStreamerAutocomplete()
  document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldAddAnother = submitter?.id === 'saveAndAddAnotherBtn'
    const company = (document.getElementById('companyInput') as HTMLInputElement).value
    const startDate = (document.getElementById('startDateInput') as HTMLInputElement).value
    const endDate = (document.getElementById('endDateInput') as HTMLInputElement).value
    const totalReceivedRaw = (document.getElementById('totalReceivedInput') as HTMLInputElement).value.replace(/\./g, '').replace(/,/g, '.')
    const totalReceived = Number(totalReceivedRaw) || 0
    const myCommissionRaw = (document.getElementById('myCommissionInput') as HTMLInputElement).value.replace(/\./g, '').replace(/,/g, '.')
    const myCommission = Number(myCommissionRaw) || 0
    const currency = (document.getElementById('currencyInput') as HTMLSelectElement).value as 'BRL' | 'USD'
    const paymentDate = (document.getElementById('paymentDateInput') as HTMLInputElement).value || null

    // Validação com Zod
    const validation = campaignSchema.safeParse({
      company,
      start_date: startDate,
      end_date: endDate,
      total_received: totalReceived,
      my_commission: myCommission,
      currency,
      payment_date: paymentDate,
    })

    if (!validation.success) {
      const firstError = validation.error.issues[0]
      showToast(firstError.message, 'error')
      logError(validation.error, 'Campaign validation failed')
      return
    }

    const alreadyConfirmed = (document.getElementById('alreadyConfirmedInput') as HTMLInputElement).checked
    const lines = (document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value.split('\n').map(n => n.trim()).filter(n => n)
    const streamerRows = lines.map(line => {
      const dashMatch = line.match(/^(.+?)\s*[-–]\s*\$/)
      const name = dashMatch ? dashMatch[1].trim() : line.split(':')[0].trim()
      return { streamer_name: name, payment: 0, payment_date: null as string | null, ...(alreadyConfirmed ? { contact_status: 'confirmado' as const } : {}) }
    })

    const saveBtn = document.getElementById('saveCampaignBtn') as HTMLButtonElement
    const addAnotherBtn = document.getElementById('saveAndAddAnotherBtn') as HTMLButtonElement
    setButtonLoading(submitter || saveBtn, true)
    ;(submitter === addAnotherBtn ? saveBtn : addAnotherBtn).disabled = true

    try {
      if (editingCampaignId) {
        await updateCampaign(editingCampaignId, { company, start_date: startDate, end_date: endDate, total_received: totalReceived, my_commission: myCommission, currency, payment_date: paymentDate }, streamerRows)
        showToast('Campanha atualizada!')
      } else {
        await addCampaign({ company, start_date: startDate, end_date: endDate, total_received: totalReceived, my_commission: myCommission, currency, payment_date: paymentDate }, streamerRows)
        showToast('Campanha adicionada!')
      }

      setEditingCampaignId(null)
      await loadData(); renderAll()

      if (shouldAddAnother) {
        ;(document.getElementById('campaignForm') as HTMLFormElement).reset()
        ;(document.getElementById('companyInput') as HTMLInputElement).focus()
      } else {
        document.getElementById('campaignModal')!.classList.add('hidden')
      }
    } catch (error) {
      logError(error, 'Failed to save campaign', { company, editingCampaignId })
      showToast('Erro ao salvar campanha', 'error')
    } finally {
      setButtonLoading(saveBtn, false, editingCampaignId ? 'Atualizar' : 'Salvar')
      setButtonLoading(addAnotherBtn, false, 'Salvar e Adicionar Outra')
      saveBtn.disabled = false
      addAnotherBtn.disabled = false
    }
  })

  // Details modal interactions
  document.getElementById('closeDetailsModal')?.addEventListener('click', () => document.getElementById('campaignDetailsModal')!.classList.add('hidden'))

  document.getElementById('campaignDetailsModal')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    // Filtro por chip de status
    const filterBtn = target.closest('.status-filter-btn') as HTMLElement | null
    if (filterBtn) {
      detailsActiveFilter = filterBtn.dataset.filter!
      highlightActiveChip()
      const c = campaigns.find(cp => cp.id === detailsCampaignId)
      if (c) renderDetailsList(c)
      return
    }

    // Ação rápida de status (substitui o select)
    const quickBtn = target.closest('.quick-status-btn') as HTMLElement | null
    if (quickBtn) {
      const row = quickBtn.closest('[data-id]') as HTMLElement
      const id = row.dataset.id!
      const newStatus = quickBtn.dataset.next as any
      await applyContactStatus(id, newStatus)
    }
  })

  document.getElementById('detailsSearch')?.addEventListener('input', () => {
    const c = campaigns.find(cp => cp.id === detailsCampaignId)
    if (c) renderDetailsList(c)
  })

  async function applyContactStatus(id: string, newStatus: string) {
    const idx = campaigns.findIndex(c => c.campaign_streamers?.some(s => s.id === id))
    if (idx < 0) return
    const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
    s.contact_status = newStatus as any

    const c = campaigns[idx]
    renderDetailsChips(c)
    renderDetailsList(c)
    renderCampaigns()

    try { await updateContactStatus(id, newStatus as any) }
    catch { showToast('Erro ao salvar status', 'error'); return }

    // Auto-register streamer when confirmed
    if (newStatus === 'confirmado') {
      if (!streamers.some(st => st.name.toLowerCase() === s.streamer_name.toLowerCase())) {
        try {
          // fetchInitialStats não depende do resultado de fetchTwitchUser, dispara em paralelo
          const [user, stats] = await Promise.all([
            fetchTwitchUser(s.streamer_name),
            fetchInitialStats(s.streamer_name)
          ])
          if (user) {
            const lang = user.broadcaster_language?.split('-')[0]
            await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0 })
            const lastLive = await fetchLastLiveDate(user.id, user.login)
            if (lastLive) {
              const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
              if (added) await updateLastLive(added.id, lastLive)
            }
            setStreamers(await getStreamers())
          }
        } catch { /* ignora */ }
      }
    }
    showToast('Status atualizado!')
  }
}

// Autocomplete de streamers já cadastrados no dashboard, aplicado à linha atual da textarea
function setupStreamerAutocomplete() {
  const textarea = document.getElementById('campaignStreamersInput') as HTMLTextAreaElement
  const suggestions = document.getElementById('streamerSuggestions')!

  function getCurrentLine(): { text: string; start: number; end: number } {
    const cursor = textarea.selectionStart
    const value = textarea.value
    const start = value.lastIndexOf('\n', cursor - 1) + 1
    const nextBreak = value.indexOf('\n', cursor)
    const end = nextBreak === -1 ? value.length : nextBreak
    return { text: value.slice(start, end), start, end }
  }

  function show() {
    const { text } = getCurrentLine()
    const query = text.trim().toLowerCase()
    if (!query) { suggestions.classList.add('hidden'); return }
    const matches = streamers.filter(s => s.name.toLowerCase().includes(query)).slice(0, 8)
    if (!matches.length) { suggestions.classList.add('hidden'); return }
    suggestions.innerHTML = matches.map(s => `<div class="px-4 py-2 hover:bg-slate-600 cursor-pointer text-white text-sm" data-name="${s.name}">${s.name}</div>`).join('')
    suggestions.classList.remove('hidden')
  }

  textarea.addEventListener('input', show)
  textarea.addEventListener('click', show)
  textarea.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') show() })

  suggestions.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-name]') as HTMLElement | null
    if (!el) return
    const { start, end } = getCurrentLine()
    const name = el.dataset.name!
    textarea.value = textarea.value.slice(0, start) + name + textarea.value.slice(end)
    const newCursor = start + name.length
    textarea.setSelectionRange(newCursor, newCursor)
    suggestions.classList.add('hidden')
    textarea.focus()
  })

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target as Node) && e.target !== textarea) suggestions.classList.add('hidden')
  })
}

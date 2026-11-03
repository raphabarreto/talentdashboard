import { escapeHtml as esc } from '../../lib/escape'
import { updateContactStatus, getStreamers } from '../../lib/data'
import { prepareStreamerData, registerStreamer } from '../../lib/registration'
import { streamers, campaigns, setStreamers } from '../../state'
import { showToast, fmtDate, fmtCurrency } from '../../utils'
import { renderCampaigns } from '../../ui/campaigns'
import { logError } from '../../lib/logger'
import type { ContactStatus } from '../../types/index'

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

    row.innerHTML = `<span class="text-white text-sm font-medium">${esc(s.streamer_name)}</span><span class="flex items-center gap-1.5">${actions}</span>`
    list.appendChild(row)
  })
}

// Abre o modal de detalhes de uma campanha.
export function openDetailsModal(c: typeof campaigns[number]) {
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

// Eventos do modal de detalhes (filtros, busca e troca de status).
export function setupDetailsModal() {
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
      const newStatus = quickBtn.dataset.next as ContactStatus
      await applyContactStatus(id, newStatus)
    }
  })

  document.getElementById('detailsSearch')?.addEventListener('input', () => {
    const c = campaigns.find(cp => cp.id === detailsCampaignId)
    if (c) renderDetailsList(c)
  })

  async function applyContactStatus(id: string, newStatus: ContactStatus) {
    const idx = campaigns.findIndex(c => c.campaign_streamers?.some(s => s.id === id))
    if (idx < 0) return
    const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
    s.contact_status = newStatus

    const c = campaigns[idx]
    renderDetailsChips(c)
    renderDetailsList(c)
    renderCampaigns()

    try { await updateContactStatus(id, newStatus) }
    catch { showToast('Erro ao salvar status', 'error'); return }

    // Auto-register streamer when confirmed
    let autoRegisterWarning = false
    if (newStatus === 'confirmado') {
      if (!streamers.some(st => st.name.toLowerCase() === s.streamer_name.toLowerCase())) {
        try {
          const { lastLiveSaved } = await registerStreamer(await prepareStreamerData(s.streamer_name))
          setStreamers(await getStreamers())
          if (!lastLiveSaved) { autoRegisterWarning = true; showToast('Streamer cadastrado, mas sem data de última live', 'error') }
        } catch (err) {
          logError(err, 'Cadastro automático ao confirmar falhou')
          autoRegisterWarning = true
          showToast(`Status salvo, mas não foi possível cadastrar ${s.streamer_name} automaticamente`, 'error')
        }
      }
    }
    if (!autoRegisterWarning) showToast('Status atualizado!')
  }
}

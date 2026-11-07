import { escapeHtml as esc } from '../../lib/escape'
import { updateContactStatus, getStreamers } from '../../lib/data'
import { prepareStreamerData, registerStreamer } from '../../lib/registration'
import { streamers, campaigns, setStreamers } from '../../state'
import { showToast, fmtDate, fmtCurrency } from '../../utils'
import { renderCampaigns, formatPeriod } from '../../ui/campaigns'
import { logError } from '../../lib/logger'
import type { ContactStatus } from '../../types/index'

// Estado local do modal de detalhes (não precisa ser global)
// Agrupamento (accordion) por status: só no filtro "Todos" de campanhas com vários streamers.
let groupingEnabled = false
const openGroups = new Set<string>() // todos os grupos começam recolhidos
const groupOrder = ['contatado', 'pendente', 'nao_respondeu', 'confirmado', 'recusado']
const groupLabel: Record<string, string> = { contatado: 'Contatados', pendente: 'Pendentes', nao_respondeu: 'Sem resposta', confirmado: 'Confirmados', recusado: 'Recusados' }
const groupDot: Record<string, string> = { pendente: 'bg-slate-400', contatado: 'bg-amber-400', confirmado: 'bg-emerald-400', recusado: 'bg-red-400', nao_respondeu: 'bg-orange-400' }
let detailsCampaignId: string | null = null
function setDetailsCampaignId(id: string | null) { detailsCampaignId = id }

const statusTextClass: Record<string, string> = {
  pendente: 'text-slate-400',
  contatado: 'text-amber-400',
  confirmado: 'text-emerald-400',
  recusado: 'text-red-400',
  nao_respondeu: 'text-orange-400'
}
const statusIcon: Record<string, string> = {
  pendente: 'far fa-circle',
  contatado: 'fas fa-paper-plane',
  confirmado: 'far fa-circle-check',
  recusado: 'far fa-circle-xmark',
  nao_respondeu: 'far fa-clock'
}
const statusName = (st: string) => st === 'nao_respondeu' ? 'Não respondeu' : st.charAt(0).toUpperCase() + st.slice(1)
// Até FILTERS_MIN_STREAMERS - 1 streamers a janela fica enxuta (sem busca/filtros); a partir daí eles aparecem.
export const FILTERS_MIN_STREAMERS = 6




function renderDetailsList(c: typeof campaigns[number]) {
  const search = (document.getElementById('detailsSearch') as HTMLInputElement).value.toLowerCase()
  const list = document.getElementById('detailsStreamers')!
  const all = c.campaign_streamers || []
  const filtered = all.filter(s => {
    const matchSearch = !search || s.streamer_name.toLowerCase().includes(search)
    return matchSearch
  })
  list.innerHTML = ''
  // Grupos um pouco mais juntos (gap-1); lista direta mantém o espaço de sempre (gap-1.5).
  list.classList.toggle('gap-1', groupingEnabled)
  list.classList.toggle('gap-1.5', !groupingEnabled)
  document.getElementById('detailsEmptyState')!.classList.toggle('hidden', filtered.length > 0)

  const buildRow = (s: NonNullable<typeof c.campaign_streamers>[number]) => {
    const st = s.contact_status || 'pendente'
    const row = document.createElement('div')
    // Dentro dos grupos (6+ streamers) os cartões ficam mais compactos; na lista direta mantêm o tamanho de sempre.
    const compact = groupingEnabled
    row.className = `flex items-center justify-between gap-3 bg-slate-700/40 hover:bg-slate-700/60 rounded-xl px-3 ${compact ? 'py-1' : 'py-2'} transition-colors`
    row.dataset.id = s.id

    let actions = ''
    if (st === 'pendente') {
      actions = `
        <button data-next="contatado" class="quick-status-btn text-sm font-semibold px-2.5 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white whitespace-nowrap" title="Marcar como contatado" aria-label="Marcar como contatado">Marcar contato</button>
        <button data-next="recusado" class="quick-status-btn text-sm px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400" title="Recusado" aria-label="Marcar como recusado"><i class="fas fa-times" aria-hidden="true"></i></button>
      `
    } else if (st === 'contatado') {
      actions = `
        <button data-next="confirmado" class="quick-status-btn text-sm font-semibold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 whitespace-nowrap" title="Marcar como confirmado" aria-label="Marcar como confirmado"><i class="fas fa-check mr-1" aria-hidden="true"></i>Confirmado</button>
        <button data-next="nao_respondeu" class="quick-status-btn text-sm px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-orange-500/20 hover:text-orange-400" title="Não respondeu" aria-label="Marcar como não respondeu"><i class="fas fa-clock" aria-hidden="true"></i></button>
        <button data-next="recusado" class="quick-status-btn text-sm px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400" title="Recusado" aria-label="Marcar como recusado"><i class="fas fa-times" aria-hidden="true"></i></button>
      `
    } else {
      actions = `
        <button data-next="pendente" class="quick-status-btn ${compact ? 'w-8 h-8' : 'w-9 h-9'} inline-flex items-center justify-center rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="Reverter status" aria-label="Reverter status"><i class="fas fa-undo" aria-hidden="true"></i></button>
      `
    }

    // Nos grupos por status o cabeçalho já diz o status; na lista direta ele continua abaixo do nome.
    const statusLine = groupingEnabled ? '' : `<span class="block text-xs mt-0.5 ${statusTextClass[st] || 'text-slate-400'}"><i class="${statusIcon[st] || 'far fa-circle'} mr-1" aria-hidden="true"></i>${statusName(st)}</span>`
    row.innerHTML = `<span class="flex items-center gap-3 min-w-0"><span class="${compact ? 'w-8 h-8 text-sm' : 'w-10 h-10'} rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold shrink-0" aria-hidden="true">${esc(s.streamer_name.charAt(0).toUpperCase())}</span><span class="min-w-0"><span class="block text-white font-semibold truncate" title="${esc(s.streamer_name)}">${esc(s.streamer_name)}</span>${statusLine}</span></span><span class="flex items-center gap-1.5 shrink-0">${actions}</span>`
    return row
  }

  if (!groupingEnabled) {
    filtered.forEach(s => list.appendChild(buildRow(s)))
    return
  }

  // Grupos por status (vazios não aparecem). Com busca ativa, só aparecem os grupos com resultado, já abertos.
  groupOrder.forEach(k => {
    const items = filtered.filter(s => (s.contact_status || 'pendente') === k)
    if (items.length === 0) return
    const open = !!search || openGroups.has(k)
    const section = document.createElement('div')
    section.innerHTML = `<button type="button" data-group="${k}" aria-expanded="${open}" aria-controls="group-${k}" class="group-toggle w-full grid grid-cols-[auto_minmax(0,1fr)_auto_1rem] items-center gap-x-2.5 px-3 py-1.5 rounded-xl bg-slate-700/40 hover:bg-slate-700/60 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><span class="w-2.5 h-2.5 rounded-full ${groupDot[k]}" aria-hidden="true"></span><span class="text-sm font-semibold text-white truncate">${groupLabel[k]}</span><span class="min-w-[1.75rem] px-2 py-0.5 rounded-full bg-slate-700 text-xs font-semibold text-slate-200 text-center tabular-nums">${items.length}</span><i class="fas fa-chevron-down text-xs text-slate-400 text-center transition-transform ${open ? 'rotate-180' : ''}" aria-hidden="true"></i></button>`
    if (open) {
      const body = document.createElement('div')
      body.id = `group-${k}`
      body.className = 'flex flex-col gap-1 mt-1 mb-0.5'
      items.forEach(s => body.appendChild(buildRow(s)))
      section.appendChild(body)
    }
    list.appendChild(section)
  })
}

// Abre o modal de detalhes de uma campanha.
export function openDetailsModal(c: typeof campaigns[number]) {
  setDetailsCampaignId(c.id)
  document.getElementById('detailsTitle')!.textContent = c.company
  document.getElementById('detailsPeriod')!.textContent = formatPeriod(c.start_date, c.end_date)
  const totalReceived = c.total_received || 0
  const myCommission = c.my_commission || 0
  const valueTxt = c.currency === 'USD' ? `US$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : fmtCurrency(totalReceived)
  document.getElementById('detailsCampaignValue')!.textContent = valueTxt
  document.getElementById('detailsCommission')!.textContent = fmtCurrency(myCommission)
  document.getElementById('detailsPaymentDate')!.textContent = c.payment_date ? fmtDate(c.payment_date) : 'Pendente'

  const total = c.campaign_streamers?.length || 0
  const showFilters = total >= FILTERS_MIN_STREAMERS // poucos streamers: lista simples; muitos: busca e filtros
  groupingEnabled = showFilters
  openGroups.clear()
  document.getElementById('detailsParticipants')!.textContent = String(total)
  document.getElementById('detailsFilters')!.classList.toggle('hidden', !showFilters)
  document.getElementById('detailsParticipants')!.classList.toggle('hidden', total <= 1) // 1 streamer: sem contador
  ;(document.getElementById('detailsSearch') as HTMLInputElement).value = ''
  renderDetailsList(c)
  document.getElementById('campaignDetailsModal')!.classList.remove('hidden')
}

// Eventos do modal de detalhes (filtros, busca e troca de status).
export function setupDetailsModal() {
  const closeDetails = () => document.getElementById('campaignDetailsModal')!.classList.add('hidden')
  document.getElementById('closeDetailsModal')?.addEventListener('click', closeDetails)
  document.getElementById('closeDetailsX')?.addEventListener('click', closeDetails)

  document.getElementById('campaignDetailsModal')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    // Grupo (accordion) do filtro "Todos": abre/recolhe
    const groupBtn = target.closest('.group-toggle') as HTMLElement | null
    if (groupBtn) {
      const k = groupBtn.dataset.group!
      openGroups.has(k) ? openGroups.delete(k) : openGroups.add(k)
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

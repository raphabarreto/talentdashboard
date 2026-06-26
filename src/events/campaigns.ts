import { supabase } from '../lib/supabase'
import { addStreamer, addCampaign, updateCampaign, deleteCampaign, updateContactStatus, getStreamers, updateLastLive } from '../lib/data'
import { fetchTwitchUser, fetchInitialStats, fetchLastLiveDate } from '../lib/twitch'
import { streamers, campaigns, editingCampaignId, setCampaigns, setEditingCampaignId, setStreamers } from '../state'
import { showToast, confirmAction, fmtDate, fmtCurrency, langToCountry, statusColors, selectColors } from '../utils'
import { renderCampaigns } from '../ui/campaigns'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

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
      ;(document.getElementById('companyInput') as HTMLInputElement).value = c.company
      ;(document.getElementById('startDateInput') as HTMLInputElement).value = c.start_date
      ;(document.getElementById('endDateInput') as HTMLInputElement).value = c.end_date
      ;(document.getElementById('totalReceivedInput') as HTMLInputElement).value = c.total_received ? String(c.total_received) : ''
      ;(document.getElementById('totalPaidInput') as HTMLInputElement).value = c.total_paid ? String(c.total_paid) : ''
      ;(document.getElementById('currencyInput') as HTMLSelectElement).value = c.currency || 'BRL'
      ;(document.getElementById('paymentDateInput') as HTMLInputElement).value = c.payment_date || ''
      ;(document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value = c.campaign_streamers?.map(s => s.streamer_name).join('\n') || ''
      document.getElementById('campaignModal')!.classList.remove('hidden')
    }

    // Details campaign
    const detailsBtn = target.closest('.details-campaign-btn') as HTMLElement | null
    if (detailsBtn) {
      const c = campaigns.find(cp => cp.id === detailsBtn.dataset.id!)
      if (!c) return
      document.getElementById('detailsTitle')!.textContent = c.company
      document.getElementById('detailsCompany')!.textContent = c.company
      document.getElementById('detailsPeriod')!.textContent = `${fmtDate(c.start_date)} a ${fmtDate(c.end_date)}`
      const totalReceived = c.total_received || 0
      const totalPaid = c.total_paid || 0
      const myCommission = totalReceived - totalPaid
      const valueTxt = c.currency === 'USD' ? `US$ ${totalReceived.toFixed(2)}` : fmtCurrency(totalReceived)
      document.getElementById('detailsCampaignValue')!.textContent = valueTxt
      document.getElementById('detailsCommission')!.textContent = fmtCurrency(myCommission)
      document.getElementById('detailsPaymentDate')!.textContent = c.payment_date ? fmtDate(c.payment_date) : 'Pendente'
      const tbody = document.getElementById('detailsStreamers')!
      tbody.innerHTML = ''
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

  // Auto-calculate 80% for streamers when typing total received
  document.getElementById('totalReceivedInput')?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement
    const raw = input.value.replace(/\./g, '').replace(/,/g, '.')
    const total = Number(raw) || 0
    const streamersPart = Math.round(total * 0.8 * 100) / 100
    ;(document.getElementById('totalPaidInput') as HTMLInputElement).value = streamersPart > 0 ? String(streamersPart) : ''
  })

  // Campaign form
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
    const totalReceivedRaw = (document.getElementById('totalReceivedInput') as HTMLInputElement).value.replace(/\./g, '').replace(/,/g, '.')
    const totalReceived = Number(totalReceivedRaw) || 0
    const totalPaidRaw = (document.getElementById('totalPaidInput') as HTMLInputElement).value.replace(/\./g, '').replace(/,/g, '.')
    const totalPaid = Number(totalPaidRaw) || 0
    const currency = (document.getElementById('currencyInput') as HTMLSelectElement).value as 'BRL' | 'USD'
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
      await updateCampaign(editingCampaignId, { company, start_date: startDate, end_date: endDate, total_received: totalReceived, total_paid: totalPaid, currency, payment_date: paymentDate }, streamerRows)
      showToast('Campanha atualizada!')
    } else {
      await addCampaign({ company, start_date: startDate, end_date: endDate, total_received: totalReceived, total_paid: totalPaid, currency, payment_date: paymentDate }, streamerRows)
      showToast('Campanha adicionada!')
    }

    setEditingCampaignId(null)
    await loadData(); renderAll()
    document.getElementById('campaignModal')!.classList.add('hidden')
  })

  // Details modal interactions
  document.getElementById('closeDetailsModal')?.addEventListener('click', () => document.getElementById('campaignDetailsModal')!.classList.add('hidden'))

  document.getElementById('campaignDetailsModal')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const btn = target.closest('.status-filter-btn') as HTMLElement | null
    if (btn) {
      document.querySelectorAll('.status-filter-btn').forEach(b => { b.className = 'status-filter-btn px-2 py-1 rounded bg-slate-600 text-slate-300'; b.removeAttribute('data-active') })
      btn.className = 'status-filter-btn px-2 py-1 rounded bg-indigo-600 text-white'
      btn.setAttribute('data-active', 'true')
      filterDetailsStreamers()
    }
  })

  document.getElementById('detailsSearch')?.addEventListener('input', filterDetailsStreamers)

  // Contact status change
  document.getElementById('campaignDetailsModal')?.addEventListener('change', async (e) => {
    const select = e.target as HTMLSelectElement
    if (!select.classList.contains('contact-status-select')) return
    const newStatus = select.value as any
    const id = select.dataset.id!

    select.className = `contact-status-select ${selectColors[newStatus]} text-white text-sm rounded px-3 py-1.5 border border-slate-600 cursor-pointer`
    select.closest('tr')!.setAttribute('data-status', newStatus)

    const idx = campaigns.findIndex(c => c.campaign_streamers?.some(s => s.id === id))
    if (idx >= 0) {
      const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
      s.contact_status = newStatus
    }

    const counts = { pendente: 0, contatado: 0, confirmado: 0, recusado: 0 }
    const statusColors: Record<string, string> = { pendente: 'bg-slate-500', contatado: 'bg-amber-500', confirmado: 'bg-emerald-500', recusado: 'bg-red-500' }
    if (idx >= 0) campaigns[idx].campaign_streamers?.forEach(s => { counts[(s.contact_status || 'pendente') as keyof typeof counts]++ })
    document.getElementById('detailsStatusSummary')!.innerHTML = Object.entries(counts).filter(([,v]) => v > 0).map(([k,v]) => `<span class="${statusColors[k]} text-white px-2 py-1 rounded-full">${v} ${k}</span>`).join('')
    filterDetailsStreamers()
    renderCampaigns()

    try { await updateContactStatus(id, newStatus) }
    catch { showToast('Erro ao salvar status', 'error'); return }

    // Auto-register streamer when confirmed
    if (newStatus === 'confirmado' && idx >= 0) {
      const s = campaigns[idx].campaign_streamers!.find(s => s.id === id)!
      if (!streamers.some(st => st.name.toLowerCase() === s.streamer_name.toLowerCase())) {
        try {
          const user = await fetchTwitchUser(s.streamer_name)
          if (user) {
            const lang = user.broadcaster_language?.split('-')[0]
            const stats = await fetchInitialStats(user.login)
            await addStreamer({ name: user.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' })
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
  })
}

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

import { addCampaign, updateCampaign } from '../../lib/data'
import { campaigns, streamers, editingCampaignId, setEditingCampaignId } from '../../state'
import { showToast, sanitizeCurrencyInput } from '../../utils'
import { campaignSchema } from '../../lib/validators'
import { logError, setButtonLoading } from '../../lib/logger'
import { escapeHtml as esc } from '../../lib/escape'
import { parseMoney, extractStreamerNames, toStreamerRows, mergeNames, type ExtractResult } from './parse'
import { setupStreamerAutocomplete } from './streamerAutocomplete'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

// --- Conferência de linhas duvidosas antes de salvar -----------------------------------------
let reviewedNames: string[] | null = null

function reviewBox() { return document.getElementById('streamerReview')! }

// Esconde a conferência e descarta qualquer decisão anterior (ao abrir o modal ou editar o texto).
function resetReview() {
  reviewedNames = null
  reviewBox().classList.add('hidden')
}

function renderReview(result: ExtractResult, submitterId: string | undefined) {
  const box = reviewBox()
  const rows = result.ambiguous.map((a, i) => `
    <div class="flex items-center gap-2">
      <input type="checkbox" class="review-check w-4 h-4 rounded accent-indigo-500" data-i="${i}" title="É um streamer">
      <input type="text" class="review-name w-40 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white" data-i="${i}" value="${esc(a.suggestion)}" maxlength="25">
      <span class="text-xs text-slate-500 truncate" title="${esc(a.line)}">${esc(a.line)}</span>
    </div>`).join('')
  const summary = [
    `${result.names.length} streamers reconhecidos`,
    result.duplicates ? `${result.duplicates} repetidos ignorados` : '',
    result.ignored.length ? `${result.ignored.length} linhas ignoradas (países, valores, mensagens)` : '',
  ].filter(Boolean).join(' • ')
  box.innerHTML = `
    <p class="text-amber-300 font-semibold">Conferir antes de salvar</p>
    <p class="text-slate-300">${summary}.</p>
    <p class="text-slate-400">Estas linhas ficaram em dúvida. Marque as que são streamers e corrija o nome, se precisar:</p>
    <div class="space-y-2">${rows}</div>
    <div class="flex gap-2">
      <button type="button" id="reviewConfirm" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg">Confirmar e salvar</button>
      <button type="button" id="reviewBack" class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg">Voltar e editar</button>
    </div>`
  box.classList.remove('hidden')

  box.querySelector('#reviewBack')!.addEventListener('click', resetReview)
  box.querySelector('#reviewConfirm')!.addEventListener('click', () => {
    const picked = [...box.querySelectorAll<HTMLInputElement>('.review-check')]
      .filter(c => c.checked)
      .map(c => box.querySelector<HTMLInputElement>(`.review-name[data-i="${c.dataset.i}"]`)!.value)
    reviewedNames = mergeNames(result.names, picked)
    box.classList.add('hidden')
    const btn = (submitterId && document.getElementById(submitterId)) as HTMLButtonElement | null
    const form = document.getElementById('campaignForm') as HTMLFormElement
    if (btn) form.requestSubmit(btn); else form.requestSubmit()
  })
}

// Abre o modal de campanha preenchido para edição.
export function openEditModal(c: typeof campaigns[number]) {
  resetReview()
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

// Formulário de campanha: abrir/fechar, máscaras de valor e salvar.
export function setupCampaignForm({ loadData, renderAll }: Callbacks) {
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

  document.getElementById('openAddCampaignInline')?.addEventListener('click', () => {
    resetReview()
    setEditingCampaignId(null)
    document.getElementById('campaignModalTitle')!.textContent = 'Adicionar Campanha'
    document.getElementById('saveCampaignBtn')!.textContent = 'Salvar'
    document.getElementById('saveAndAddAnotherBtn')!.classList.remove('hidden')
    ;(document.getElementById('campaignForm') as HTMLFormElement).reset()
    document.getElementById('campaignModal')!.classList.remove('hidden')
  })
  document.getElementById('closeCampaignModal')?.addEventListener('click', () => document.getElementById('campaignModal')!.classList.add('hidden'))
  setupStreamerAutocomplete()
  document.getElementById('campaignStreamersInput')?.addEventListener('input', resetReview)

  document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldAddAnother = submitter?.id === 'saveAndAddAnotherBtn'
    const company = (document.getElementById('companyInput') as HTMLInputElement).value
    const startDate = (document.getElementById('startDateInput') as HTMLInputElement).value
    const endDate = (document.getElementById('endDateInput') as HTMLInputElement).value
    const totalReceived = parseMoney((document.getElementById('totalReceivedInput') as HTMLInputElement).value)
    const myCommission = parseMoney((document.getElementById('myCommissionInput') as HTMLInputElement).value)
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
    // Reconhece os nomes no texto colado; linhas em dúvida passam por conferência antes de salvar.
    const rawText = (document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value
    let names: string[]
    let summary = ''
    if (reviewedNames) {
      names = reviewedNames
      reviewedNames = null
    } else {
      const current = campaigns.find(c => c.id === editingCampaignId)?.campaign_streamers?.map(s => s.streamer_name) ?? []
      const found = extractStreamerNames(rawText, new Set([...streamers.map(s => s.name), ...current]))
      if (found.ambiguous.length) { renderReview(found, submitter?.id); return }
      if (rawText.trim() && !found.names.length) { showToast('Nenhum nome de streamer reconhecido no texto', 'error'); return }
      names = found.names
      if (found.ignored.length || found.duplicates) {
        summary = ` (${names.length} streamers${found.ignored.length ? `, ${found.ignored.length} linhas ignoradas` : ''}${found.duplicates ? `, ${found.duplicates} repetidos` : ''})`
      }
    }
    const streamerRows = toStreamerRows(names, alreadyConfirmed)

    const saveBtn = document.getElementById('saveCampaignBtn') as HTMLButtonElement
    const addAnotherBtn = document.getElementById('saveAndAddAnotherBtn') as HTMLButtonElement
    setButtonLoading(submitter || saveBtn, true)
    ;(submitter === addAnotherBtn ? saveBtn : addAnotherBtn).disabled = true

    try {
      if (editingCampaignId) {
        await updateCampaign(editingCampaignId, { company, start_date: startDate, end_date: endDate, total_received: totalReceived, my_commission: myCommission, currency, payment_date: paymentDate }, streamerRows)
        showToast(`Campanha atualizada!${summary}`)
      } else {
        await addCampaign({ company, start_date: startDate, end_date: endDate, total_received: totalReceived, my_commission: myCommission, currency, payment_date: paymentDate }, streamerRows)
        showToast(`Campanha adicionada!${summary}`)
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
}

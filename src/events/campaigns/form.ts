import { addCampaign, updateCampaign } from '../../lib/data'
import { campaigns, editingCampaignId, setEditingCampaignId } from '../../state'
import { showToast, sanitizeCurrencyInput } from '../../utils'
import { campaignSchema } from '../../lib/validators'
import { logError, setButtonLoading } from '../../lib/logger'
import { parseMoney, parseStreamerLines } from './parse'
import { setupStreamerAutocomplete } from './streamerAutocomplete'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

// Abre o modal de campanha preenchido para edição.
export function openEditModal(c: typeof campaigns[number]) {
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
    const streamerRows = parseStreamerLines((document.getElementById('campaignStreamersInput') as HTMLTextAreaElement).value, alreadyConfirmed)

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
}

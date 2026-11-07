import { deleteCampaign } from '../../lib/data'
import { campaigns, setCampaigns } from '../../state'
import { showToast, confirmAction } from '../../utils'
import { openEditModal, setupCampaignForm } from './form'
import { openDetailsModal, setupDetailsModal } from './details'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

export function setupCampaignsEvents({ loadData, renderAll }: Callbacks) {
  // Cliques delegados nos botões de cada campanha (editar, detalhes, remover)
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    const editBtn = target.closest('.edit-campaign-btn') as HTMLElement | null
    if (editBtn) {
      const c = campaigns.find(cp => cp.id === editBtn.dataset.id!)
      if (!c) return
      openEditModal(c)
    }

    const detailsBtn = target.closest('.details-campaign-btn') as HTMLElement | null
    if (detailsBtn) {
      const c = campaigns.find(cp => cp.id === detailsBtn.dataset.id!)
      if (!c) return
      openDetailsModal(c)
    }

    const deleteCampaignBtn = target.closest('.delete-campaign-btn') as HTMLElement | null
    if (deleteCampaignBtn) {
      const id = deleteCampaignBtn.dataset.id!
      const name = campaigns.find(c => c.id === id)?.company
      const message = name ? `Tem certeza de que deseja excluir a campanha ${name}?` : 'Tem certeza de que deseja excluir esta campanha?'
      if (!await confirmAction(message, 'Excluir', { title: 'Excluir campanha?' })) return
      setCampaigns(campaigns.filter(c => c.id !== id))
      renderAll()
      showToast('Campanha removida!')
      deleteCampaign(id).catch(() => showToast('Erro ao remover do banco', 'error'))
    }
  })

  setupCampaignForm({ loadData, renderAll })
  setupDetailsModal()
}

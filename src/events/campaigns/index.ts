import { deleteCampaign } from '../../lib/data'
import { campaigns, setCampaigns } from '../../state'
import { showToast, confirmAction } from '../../utils'
import { openEditModal, setupCampaignForm } from './form'
import { openDetailsModal, setupDetailsModal } from './details'
import { toggleCampaignMenu, closeCampaignMenus } from '../../ui/campaigns'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void }

export function setupCampaignsEvents({ loadData, renderAll }: Callbacks) {
  // Cliques delegados nos botões de cada campanha (editar, detalhes, remover)
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    const menuBtn = target.closest('.campaign-menu-btn') as HTMLElement | null
    if (menuBtn) { toggleCampaignMenu(menuBtn); return }

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
      closeCampaignMenus()
      const id = deleteCampaignBtn.dataset.id!
      const name = campaigns.find(c => c.id === id)?.company
      const message = name ? `Tem certeza de que deseja excluir a campanha ${name}?` : 'Tem certeza de que deseja excluir esta campanha?'
      if (!await confirmAction(message, 'Excluir', { title: 'Excluir campanha?' })) return
      try { await deleteCampaign(id) } catch { showToast('Não foi possível excluir a campanha. Nada foi alterado.', 'error'); return }
      setCampaigns(campaigns.filter(c => c.id !== id))
      renderAll()
      showToast('Campanha removida!')
    }
  })

  // Teclado: Esc fecha o menu e devolve o foco ao botão; rolagem/redimensionar fecham (o menu é fixo na tela)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCampaignMenus(true) }, true)
  window.addEventListener('resize', () => closeCampaignMenus())
  document.addEventListener('scroll', () => closeCampaignMenus(), true)

  setupCampaignForm({ loadData, renderAll })
  setupDetailsModal({ renderAll })
}

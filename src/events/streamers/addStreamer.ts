import { supabase } from '../../lib/supabase'
import { addStreamer, updateLastLive } from '../../lib/data'
import { streamers } from '../../state'
import { showToast } from '../../utils'
import { streamerSchema } from '../../lib/validators'
import { logError } from '../../lib/logger'

type PrepareStreamerData = (name: string, category?: string) => Promise<{
  user: any
  streamerData: any
  lastLive: string | null
}>

export function setupAddStreamerModal(
  prepareStreamerData: PrepareStreamerData,
  callbacks: { loadData: () => Promise<void>; renderAll: () => void }
) {
  const { loadData, renderAll } = callbacks

  document.getElementById('openAddStreamer')?.addEventListener('click', () => {
    document.getElementById('addStreamerModal')!.classList.remove('hidden')
  })
  
  document.getElementById('closeAddStreamer')?.addEventListener('click', () => {
    document.getElementById('addStreamerModal')!.classList.add('hidden')
  })
  
  document.getElementById('addStreamerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('streamerNameInput') as HTMLInputElement
    const submitBtn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement
    const name = input.value.trim()
    const category = (document.getElementById('streamerCategoryInput') as HTMLInputElement).value.trim()
    
    if (!name) {
      showToast('Nome do streamer é obrigatório', 'error')
      return
    }
    
    submitBtn.disabled = true
    submitBtn.textContent = 'Buscando...'
    
    try {
      const { user, streamerData, lastLive } = await prepareStreamerData(name, category)
      
      if (streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())) {
        throw new Error('Já cadastrado.')
      }
      
      const validation = streamerSchema.safeParse(streamerData)
      if (!validation.success) {
        const firstError = validation.error.issues[0]
        showToast(firstError.message, 'error')
        logError(validation.error, 'Streamer validation failed')
        return
      }
      
      await addStreamer(streamerData)
      
      if (lastLive) {
        const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
        if (added) await updateLastLive(added.id, lastLive)
      }
      
      await loadData()
      renderAll()
      input.value = ''
      ;(document.getElementById('streamerCategoryInput') as HTMLInputElement).value = ''
      document.getElementById('addStreamerModal')!.classList.add('hidden')
      showToast('Streamer adicionado!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar streamer'
      showToast(message, 'error')
      logError(err, 'Failed to add streamer', { name })
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Buscar e Salvar'
    }
  })
}

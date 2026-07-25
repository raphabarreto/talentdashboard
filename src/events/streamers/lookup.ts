import { supabase } from '../../lib/supabase'
import { addStreamer, updateLastLive } from '../../lib/data'
import { streamers } from '../../state'
import { showToast, fmt } from '../../utils'

type PrepareStreamerData = (name: string) => Promise<{
  user: any
  streamerData: any
  lastLive: string | null
}>

export function setupLookupModal(
  prepareStreamerData: PrepareStreamerData,
  callbacks: { loadData: () => Promise<void>; renderAll: () => void }
) {
  const { loadData, renderAll } = callbacks
  let lookupData: Awaited<ReturnType<PrepareStreamerData>> | null = null

  document.getElementById('openLookup')?.addEventListener('click', () => {
    document.getElementById('lookupResult')!.classList.add('hidden')
    document.getElementById('lookupError')!.classList.add('hidden')
    document.getElementById('lookupActions')!.classList.add('hidden')
    document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
    ;(document.getElementById('lookupInput') as HTMLInputElement).value = ''
    document.getElementById('lookupModal')!.classList.remove('hidden')
  })

  document.getElementById('closeLookupModal')?.addEventListener('click', () => {
    document.getElementById('lookupModal')!.classList.add('hidden')
  })

  document.getElementById('closeLookupModalAlt')?.addEventListener('click', () => {
    document.getElementById('lookupModal')!.classList.add('hidden')
  })

  async function doLookup() {
    const input = document.getElementById('lookupInput') as HTMLInputElement
    const name = input.value.trim()
    if (!name) return

    const btn = document.getElementById('lookupSearchBtn') as HTMLButtonElement
    const spinner = document.getElementById('lookupSearchSpinner')!
    const btnText = document.getElementById('lookupSearchBtnText')!
    btn.disabled = true
    spinner.classList.remove('hidden')
    btnText.textContent = 'Buscando...'
    
    document.getElementById('lookupResult')!.classList.add('hidden')
    document.getElementById('lookupError')!.classList.add('hidden')
    document.getElementById('lookupActions')!.classList.add('hidden')
    document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
    lookupData = null

    try {
      lookupData = await prepareStreamerData(name)
      const { user, streamerData } = lookupData
      
      document.getElementById('lookupAvatar')!.setAttribute('src', user.profile_image_url || '')
      document.getElementById('lookupName')!.textContent = user.display_name
      const link = document.getElementById('lookupTwitchLink') as HTMLAnchorElement
      link.href = `https://twitch.tv/${user.login}`
      link.textContent = `twitch.tv/${user.login}`
      document.getElementById('lookupAvgViewers')!.textContent = fmt(streamerData.avg_viewers)
      document.getElementById('lookupPeakViewers')!.textContent = fmt(streamerData.peak_viewers)
      document.getElementById('lookupHoursWatched')!.textContent = fmt(streamerData.hours_watched)
      document.getElementById('lookupHoursStreamed')!.textContent = fmt(streamerData.hours_streamed)
      document.getElementById('lookupResult')!.classList.remove('hidden')
      
      const alreadyAdded = streamers.some(s => s.name.toLowerCase() === user.display_name.toLowerCase())
      if (alreadyAdded) {
        document.getElementById('lookupActions')!.classList.add('hidden')
        document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
      } else {
        document.getElementById('lookupActions')!.classList.remove('hidden')
        document.getElementById('closeLookupModalAlt')!.classList.add('hidden')
      }
    } catch (err: unknown) {
      const el = document.getElementById('lookupError')!
      el.textContent = err instanceof Error ? err.message : 'Erro ao buscar'
      el.classList.remove('hidden')
    } finally {
      btn.disabled = false
      spinner.classList.add('hidden')
      btnText.textContent = 'Buscar'
    }
  }

  document.getElementById('lookupSearchBtn')?.addEventListener('click', doLookup)
  document.getElementById('lookupInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLookup()
  })

  document.getElementById('lookupAddBtn')?.addEventListener('click', async () => {
    if (!lookupData) return
    
    const btn = document.getElementById('lookupAddBtn') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = 'Adicionando...'
    
    try {
      const { user, streamerData, lastLive } = lookupData
      await addStreamer(streamerData)
      
      if (lastLive) {
        const added = (await supabase.from('streamers').select('id').eq('name', user.display_name).single()).data
        if (added) await updateLastLive(added.id, lastLive)
      }
      
      await loadData()
      renderAll()
      document.getElementById('lookupModal')!.classList.add('hidden')
      showToast('Streamer adicionado!')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', 'error')
    } finally {
      btn.disabled = false
      btn.textContent = '+ Adicionar'
    }
  })
}

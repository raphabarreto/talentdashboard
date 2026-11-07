import { registerStreamer, type PreparedStreamer } from '../../lib/registration'
import { streamers } from '../../state'
import { showToast, fmt } from '../../utils'
import { addToShortlist, isInShortlist, prospectFromLookup } from '../../ui/prospecting/shortlist'
import { renderShortlist } from '../../ui/prospecting/render'

type PrepareStreamerData = (name: string) => Promise<PreparedStreamer>

export function setupLookupModal(
  prepareStreamerData: PrepareStreamerData,
  callbacks: { loadData: () => Promise<void>; renderAll: () => void }
) {
  const { loadData, renderAll } = callbacks
  let lookupData: Awaited<ReturnType<PrepareStreamerData>> | null = null

  const shortlistBtn = () => document.getElementById('lookupShortlistBtn') as HTMLButtonElement
  // Fora da lista: botão "+ Minha Lista". Na lista: faixa verde de confirmação com atalho "Ver lista".
  function setShortlistBtn(inList: boolean) {
    const b = shortlistBtn()
    b.disabled = false
    b.textContent = '+ Minha Lista (Prospecção)'
    b.classList.toggle('hidden', inList)
    document.getElementById('lookupShortlistStatus')!.classList.toggle('hidden', !inList)
  }

  document.getElementById('lookupGoShortlist')?.addEventListener('click', () => {
    document.getElementById('lookupModal')!.classList.add('hidden')
    document.querySelector('.nav-link[data-view="prospecting"]')?.dispatchEvent(new Event('click'))
    document.getElementById('shortlistSection')?.scrollIntoView({ behavior: 'smooth' })
  })

  // Abre a janela; com um nome, já dispara a busca.
  function openLookup(name = '') {
    document.getElementById('lookupResult')!.classList.add('hidden')
    document.getElementById('lookupError')!.classList.add('hidden')
    document.getElementById('lookupActions')!.classList.add('hidden')
    document.getElementById('closeLookupModalAlt')!.classList.remove('hidden')
    ;(document.getElementById('lookupInput') as HTMLInputElement).value = name
    document.getElementById('lookupModal')!.classList.remove('hidden')
    if (name) doLookup()
  }

  // Barra "Consultar streamer na Twitch..." no topo: Enter abre a janela já com o resultado.
  const headerInput = document.getElementById('headerLookupInput') as HTMLInputElement | null
  headerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const name = headerInput.value.trim()
      if (!name) return
      headerInput.value = ''
      headerInput.blur()
      openLookup(name)
    } else if (e.key === 'Escape') {
      headerInput.value = ''
      headerInput.blur()
    }
  })

  // Atalho "/": leva o cursor para a barra (exceto quando já se está digitando em outro campo).
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
    if (!document.getElementById('lookupModal')!.classList.contains('hidden')) return
    e.preventDefault()
    headerInput?.focus()
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
      setShortlistBtn(isInShortlist(user.login))
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
      const { streamerData, lastLive } = lookupData
      const { lastLiveSaved } = await registerStreamer({ streamerData, lastLive })

      await loadData()
      renderAll()
      document.getElementById('lookupModal')!.classList.add('hidden')
      showToast(lastLiveSaved ? 'Streamer adicionado!' : 'Streamer adicionado, mas não foi possível salvar a última live', lastLiveSaved ? undefined : 'error')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', 'error')
    } finally {
      btn.disabled = false
      btn.textContent = '+ Adicionar ao Dashboard'
    }
  })

  document.getElementById('lookupShortlistBtn')?.addEventListener('click', async () => {
    if (!lookupData) return
    const b = shortlistBtn()
    b.disabled = true
    b.textContent = 'Adicionando...'
    try {
      const result = await addToShortlist(prospectFromLookup(lookupData.user))
      setShortlistBtn(true)
      renderShortlist()
      showToast(result === 'added' ? 'Adicionado à Minha Lista da Prospecção!' : 'Já estava na Minha Lista')
    } catch (err: unknown) {
      setShortlistBtn(false)
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar à lista', 'error')
    }
  })
}

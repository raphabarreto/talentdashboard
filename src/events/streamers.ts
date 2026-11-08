import { deleteStreamer, deleteStreamers } from '../lib/data'
import { prepareStreamerData, buildStreamerRow, registerStreamersBatch } from '../lib/registration'
import { fetchTwitchUsers, fetchInitialStats, fetchLastLiveDate } from '../lib/twitch'
import { streamers, selectedStreamers, setStreamers } from '../state'
import { showToast, confirmAction, fmt } from '../utils'
import { getTablePageStreamers } from '../ui/table'
import { getOverviewPageStreamers, updateOverviewSelection, isSelectionMode, setSelectionMode } from '../ui/overview'
import { setupLookupModal } from './streamers/lookup'
import { MAX_STREAMERS_BATCH, TWITCH_API_BATCH_SIZE } from '../constants'

type TwitchUser = Awaited<ReturnType<typeof fetchTwitchUsers>>[number]

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void; renderTable: () => void }

async function removeSelected(renderAll: () => void) {
  const n = selectedStreamers.size
  const names = streamers.filter(s => selectedStreamers.has(s.id)).map(s => s.name)
  const detail = names.length <= 3 ? `: ${names.join(', ')}` : ''
  if (!await confirmAction(`Tem certeza de que deseja remover ${n === 1 ? '1 streamer selecionado' : `os ${n} streamers selecionados`} da sua lista${detail}?`, 'Remover', { title: n === 1 ? 'Remover streamer?' : `Remover ${n} streamers?` })) return
  const ids = [...selectedStreamers]
  // Só mostra como removido depois que o banco confirmou; se falhar, a lista e a seleção continuam como estavam.
  try { await deleteStreamers(ids) } catch { showToast('Não foi possível remover. Nada foi alterado.', 'error'); return }
  selectedStreamers.clear()
  setStreamers(streamers.filter(s => !ids.includes(s.id)))
  renderAll()
  showToast('Streamers removidos!')
}

export function setupStreamersEvents({ loadData, renderAll, renderTable }: Callbacks) {
  // Configurar modais (extraídos para arquivos separados)
  setupLookupModal(prepareStreamerData, { loadData, renderAll })
  // Delete streamer + history (delegated click)
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const deleteBtn = target.closest('.delete-btn') as HTMLElement | null
    if (deleteBtn) {
      const id = deleteBtn.dataset.id!
      const name = streamers.find(s => s.id === id)?.name
      const message = name ? `Tem certeza de que deseja remover ${name} da sua lista?` : 'Tem certeza de que deseja remover este streamer da sua lista?'
      if (!await confirmAction(message, 'Remover', { title: 'Remover streamer?' })) return
      try { await deleteStreamer(id) } catch { showToast('Não foi possível remover. Nada foi alterado.', 'error'); return }
      selectedStreamers.delete(id)
      setStreamers(streamers.filter(s => s.id !== id))
      renderAll()
      showToast('Streamer removido!')
    }
  })

  // Checkboxes
  document.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    if (target.classList.contains('streamer-checkbox')) {
      target.checked ? selectedStreamers.add(target.dataset.id!) : selectedStreamers.delete(target.dataset.id!)
      renderTable()
      updateOverviewSelection()
    }
  })
  // Visão Geral: caixa de cada card e barra de seleção (mesma seleção da Tabela de Dados)
  document.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement
    if (!box.classList?.contains('card-checkbox')) return
    box.checked ? selectedStreamers.add(box.dataset.id!) : selectedStreamers.delete(box.dataset.id!)
    updateOverviewSelection()
  })
  document.getElementById('overviewSelectModeBtn')?.addEventListener('click', () => {
    setSelectionMode(!isSelectionMode())
    renderTable() // sair do modo limpa a seleção (compartilhada com a Tabela de Dados)
  })
  document.getElementById('overviewSelectPageBtn')?.addEventListener('click', () => {
    getOverviewPageStreamers().forEach(s => selectedStreamers.add(s.id))
    updateOverviewSelection()
  })
  document.getElementById('overviewClearSelectionBtn')?.addEventListener('click', () => {
    selectedStreamers.clear()
    updateOverviewSelection()
    renderTable()
  })
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    // Só a página atual: marca/desmarca os streamers visíveis, sem mexer na seleção das outras páginas.
    const checked = (e.target as HTMLInputElement).checked
    getTablePageStreamers().forEach(s => checked ? selectedStreamers.add(s.id) : selectedStreamers.delete(s.id))
    renderTable()
    updateOverviewSelection()
  })

  // Add Multiple
  document.getElementById('addMultipleBtn')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.remove('hidden'))
  document.getElementById('closeMultipleModal')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.add('hidden'))
  document.getElementById('multipleNamesInput')?.addEventListener('keydown', (e) => {
    const evt = e as KeyboardEvent
    if ((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter') {
      evt.preventDefault()
      document.getElementById('saveMultipleBtn')?.click()
    }
  })
  document.getElementById('saveMultipleBtn')?.addEventListener('click', async () => {
    const textarea = document.getElementById('multipleNamesInput') as HTMLTextAreaElement
    const names = textarea.value.split('\n').map(line => {
      const l = line.trim()
      const urlMatch = l.match(/twitch\.tv\/([^\s\/]+)/)
      if (urlMatch) return urlMatch[1].replace(/[_\\]/g, m => m === '\\' ? '' : m)
      return l.split('-')[0].trim()
    }).filter(n => n)
    
    if (!names.length) {
      showToast('Digite pelo menos um nome de streamer', 'error')
      return
    }
    
    if (names.length > MAX_STREAMERS_BATCH) {
      showToast(`Máximo de ${MAX_STREAMERS_BATCH} streamers por vez`, 'error')
      return
    }
    const progress = document.getElementById('multipleProgress')!
    progress.classList.remove('hidden')
    progress.textContent = `Buscando ${names.length} streamers...`
    try {
      const allUsers: TwitchUser[] = []
      for (let i = 0; i < names.length; i += TWITCH_API_BATCH_SIZE) {
        const users = await fetchTwitchUsers(names.slice(i, i + TWITCH_API_BATCH_SIZE))
        allUsers.push(...users)
      }
      
      const notFound = names.filter(n => !allUsers.some(u => u.login.toLowerCase() === n.toLowerCase()))
      const newUsers = allUsers.filter(u => !streamers.some(s => s.name.toLowerCase() === u.display_name.toLowerCase()))
      const alreadyAdded = allUsers.filter(u => streamers.some(s => s.name.toLowerCase() === u.display_name.toLowerCase()))
      
      if (!newUsers.length) {
        progress.classList.add('hidden')
        textarea.value = ''
        if (notFound.length && alreadyAdded.length) {
          showToast(`${notFound.length} não encontrados, ${alreadyAdded.length} já cadastrados`, 'error')
        } else if (notFound.length) {
          showToast(`Não encontrados na Twitch: ${notFound.join(', ')}`, 'error')
        } else {
          showToast(`Todos os ${alreadyAdded.length} streamers já estão cadastrados`, 'error')
        }
        return 
      }

      progress.textContent = `Buscando estatísticas e atividade de ${newUsers.length} streamers...`
      const [statsResults, liveResults] = await Promise.all([
        Promise.allSettled(newUsers.map(u => fetchInitialStats(u.login))),
        Promise.allSettled(newUsers.map(u => fetchLastLiveDate(u.id, u.login)))
      ])
      const items = newUsers.map((u, i) => ({
        streamerData: buildStreamerRow(u, statsResults[i].status === 'fulfilled' ? statsResults[i].value : null),
        lastLive: liveResults[i].status === 'fulfilled' ? liveResults[i].value : null
      }))
      progress.textContent = `Cadastrando...`
      const { lastLiveFailures } = await registerStreamersBatch(items)
      const toInsert = items

      await loadData(); renderAll()
      textarea.value = ''
      document.getElementById('addMultipleModal')!.classList.add('hidden')
      
      let msg = `${toInsert.length} adicionados`
      if (alreadyAdded.length) msg += `, ${alreadyAdded.length} já existiam`
      if (notFound.length) msg += `, ${notFound.length} não encontrados`
      if (lastLiveFailures) msg += `, ${lastLiveFailures} sem data de última live`
      showToast(msg)
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', 'error') }
    finally { progress.classList.add('hidden') }
  })

  // Remove selected
  document.getElementById('removeSelectedBtn')?.addEventListener('click', () => removeSelected(renderAll))
  document.getElementById('overviewRemoveSelectedBtn')?.addEventListener('click', () => removeSelected(renderAll))

  // Generate PDF
  document.getElementById('generatePdfBtn')?.addEventListener('click', async () => {
    const selected = streamers.filter(s => selectedStreamers.has(s.id))
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    type CellHookData = Parameters<NonNullable<NonNullable<Parameters<typeof autoTable>[1]>['didDrawCell']>>[0]
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Lista de Streamers', 14, 20)
    autoTable(doc, {
      startY: 30,
      head: [['Nome', 'Twitch', 'Média de Viewers']],
      body: selected.map(s => [s.name, `twitch.tv/${s.name.toLowerCase()}`, fmt(s.avg_viewers)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [79, 70, 229] },
      didDrawCell: (data: CellHookData) => {
        if (data.section === 'body' && data.column.index === 1) {
          const name = selected[data.row.index]?.name?.toLowerCase()
          if (name) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: `https://twitch.tv/${name}` })
        }
      },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = [79, 70, 229]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })
    doc.save('streamers.pdf')
  })
}

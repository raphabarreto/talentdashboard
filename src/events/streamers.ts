import { supabase } from '../lib/supabase'
import { addStreamer, addStreamers, deleteStreamer, updateLastLive } from '../lib/data'
import { fetchTwitchUsers, fetchInitialStats, fetchLastLiveDate, fetchStreamerLookup } from '../lib/twitch'
import { exportStreamersToCSV } from '../lib/export'
import { streamers, selectedStreamers, setStreamers } from '../state'
import { showToast, confirmAction, fmt, langToCountry } from '../utils'
import { getFilteredStreamers } from '../ui/filters'
import { streamerSchema } from '../lib/validators'
import { logError } from '../lib/logger'
import { setupAddStreamerModal } from './streamers/addStreamer'
import { setupLookupModal } from './streamers/lookup'
import { MAX_STREAMERS_BATCH, TWITCH_API_BATCH_SIZE } from '../constants'

type Callbacks = { loadData: () => Promise<void>; renderAll: () => void; renderTable: () => void }

// Helper: buscar e preparar dados de um streamer
async function prepareStreamerData(name: string, category = '') {
  // lookup combinado (user + channel + last_video/streams em 1 invocação) e stats do twitchtracker
  // disparam juntos, pois não dependem um do outro.
  const [{ user, lastLive }, stats] = await Promise.all([
    fetchStreamerLookup(name),
    fetchInitialStats(name)
  ])
  if (!user) throw new Error('Streamer não encontrado.')
  
  const lang = user.broadcaster_language?.split('-')[0]
  
  const streamerData = {
    name: user.display_name,
    country: (lang && langToCountry[lang]) || '',
    avg_viewers: stats?.avg_viewers || 0,
    peak_viewers: stats?.peak_viewers || 0,
    hours_watched: stats?.hours_watched || 0,
    hours_streamed: stats?.hours_streamed || 0,
    main_category: category
  }
  
  return { user, streamerData, lastLive }
}

export function setupStreamersEvents({ loadData, renderAll, renderTable }: Callbacks) {
  // Configurar modais (extraídos para arquivos separados)
  setupAddStreamerModal(prepareStreamerData, { loadData, renderAll })
  setupLookupModal(prepareStreamerData, { loadData, renderAll })
  // Delete streamer + history (delegated click)
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const deleteBtn = target.closest('.delete-btn') as HTMLElement | null
    if (deleteBtn) {
      const id = deleteBtn.dataset.id!
      if (!await confirmAction('Você tem certeza que deseja remover este streamer?')) return
      selectedStreamers.delete(id)
      setStreamers(streamers.filter(s => s.id !== id))
      renderAll()
      showToast('Streamer removido!')
      deleteStreamer(id).catch(() => showToast('Erro ao remover do banco', 'error'))
    }
  })

  // Checkboxes
  document.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    if (target.classList.contains('streamer-checkbox')) {
      target.checked ? selectedStreamers.add(target.dataset.id!) : selectedStreamers.delete(target.dataset.id!)
      renderTable()
    }
  })
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked
    if (checked) { getFilteredStreamers('table').forEach(s => selectedStreamers.add(s.id)) }
    else { selectedStreamers.clear() }
    renderTable()
  })

  // Add Multiple
  document.getElementById('addMultipleBtn')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.remove('hidden'))
  document.getElementById('closeMultipleModal')?.addEventListener('click', () => document.getElementById('addMultipleModal')!.classList.add('hidden'))
  document.getElementById('saveMultipleBtn')?.addEventListener('click', async () => {
    const textarea = document.getElementById('multipleNamesInput') as HTMLTextAreaElement
    const btn = document.getElementById('saveMultipleBtn') as HTMLButtonElement
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
      const allUsers = []
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

      progress.textContent = `Buscando estatísticas de ${newUsers.length} streamers...`
      const statsResults = await Promise.allSettled(newUsers.map(u => fetchInitialStats(u.login)))
      const toInsert = newUsers.map((u, i) => {
        const stats = statsResults[i].status === 'fulfilled' ? statsResults[i].value : null
        const lang = u.broadcaster_language?.split('-')[0]
        return { name: u.display_name, country: (lang && langToCountry[lang]) || '', avg_viewers: stats?.avg_viewers || 0, peak_viewers: stats?.peak_viewers || 0, hours_watched: stats?.hours_watched || 0, hours_streamed: stats?.hours_streamed || 0, main_category: '' }
      })
      await addStreamers(toInsert)

      progress.textContent = `Verificando atividade...`
      const liveResults = await Promise.allSettled(newUsers.map(u => fetchLastLiveDate(u.id, u.login)))
      const updates = newUsers.map((u, i) => {
        const lastLive = liveResults[i].status === 'fulfilled' ? liveResults[i].value : null
        return lastLive ? { name: u.display_name, lastLive } : null
      }).filter(Boolean) as { name: string; lastLive: string }[]
      
      const inserted = (await supabase.from('streamers').select('id, name').in('name', newUsers.map(u => u.display_name))).data || []
      for (const { name, lastLive } of updates) {
        const streamer = inserted.find(s => s.name === name)
        if (streamer) await updateLastLive(streamer.id, lastLive)
      }

      await loadData(); renderAll()
      textarea.value = ''
      document.getElementById('addMultipleModal')!.classList.add('hidden')
      
      let msg = `${toInsert.length} adicionados`
      if (alreadyAdded.length) msg += `, ${alreadyAdded.length} já existiam`
      if (notFound.length) msg += `, ${notFound.length} não encontrados`
      showToast(msg)
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', 'error') }
    finally { progress.classList.add('hidden') }
  })

  // Remove selected
  document.getElementById('removeSelectedBtn')?.addEventListener('click', async () => {
    if (!await confirmAction(`Remover ${selectedStreamers.size} streamers?`)) return
    const ids = [...selectedStreamers]
    selectedStreamers.clear()
    setStreamers(streamers.filter(s => !ids.includes(s.id)))
    renderAll()
    showToast('Streamers removidos!')
    supabase.from('streamers').delete().in('id', ids).then(({ error }) => { if (error) showToast('Erro ao remover do banco', 'error') })
  })

  // Generate PDF
  document.getElementById('generatePdfBtn')?.addEventListener('click', async () => {
    const selected = streamers.filter(s => selectedStreamers.has(s.id))
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Lista de Streamers', 14, 20)
    autoTable(doc, {
      startY: 30,
      head: [['Nome', 'Twitch', 'Média de Viewers']],
      body: selected.map(s => [s.name, `twitch.tv/${s.name.toLowerCase()}`, fmt(s.avg_viewers)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [79, 70, 229] },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          const name = selected[data.row.index]?.name?.toLowerCase()
          if (name) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: `https://twitch.tv/${name}` })
        }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = [79, 70, 229]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })
    doc.save('streamers.pdf')
  })

  // Export CSV
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    const selected = streamers.filter(s => selectedStreamers.has(s.id))
    exportStreamersToCSV(selected)
    showToast(`${selected.length} streamers exportados!`)
  })

  // Set Category
  document.getElementById('setCategoryBtn')?.addEventListener('click', () => {
    document.getElementById('categoryCount')!.textContent = String(selectedStreamers.size)
    ;(document.getElementById('categoryInput') as HTMLInputElement).value = ''
    document.getElementById('categoryModal')!.classList.remove('hidden')
  })
  document.getElementById('closeCategoryModal')?.addEventListener('click', () => document.getElementById('categoryModal')!.classList.add('hidden'))
  document.getElementById('saveCategoryBtn')?.addEventListener('click', async () => {
    const category = (document.getElementById('categoryInput') as HTMLInputElement).value.trim()
    if (!category) { showToast('Digite uma categoria', 'error'); return }
    await supabase.from('streamers').update({ main_category: category }).in('id', [...selectedStreamers])
    selectedStreamers.clear()
    await loadData(); renderAll()
    document.getElementById('categoryModal')!.classList.add('hidden')
    showToast(`Categoria "${category}" aplicada!`)
  })

  // Manage Categories
  document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => {
    renderCategoriesList(loadData, renderAll)
    document.getElementById('manageCategoriesModal')!.classList.remove('hidden')
  })
  document.getElementById('closeManageCategories')?.addEventListener('click', () => document.getElementById('manageCategoriesModal')!.classList.add('hidden'))
}

function renderCategoriesList(loadData: () => Promise<void>, renderAll: () => void) {
  const categories = [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()
  const container = document.getElementById('categoriesList')!
  if (!categories.length) { container.innerHTML = '<p class="text-slate-400 text-sm">Nenhuma categoria cadastrada.</p>'; return }
  container.innerHTML = categories.map(c => {
    const count = streamers.filter(s => s.main_category === c).length
    return `<div class="flex items-center gap-2 bg-slate-700/50 rounded-lg px-4 py-3">
      <span class="text-white text-sm font-medium truncate flex-1">${c}</span>
      <span class="text-slate-400 text-xs">${count}</span>
      <button class="rename-cat-btn text-indigo-400 hover:text-indigo-300 text-sm ml-2" data-cat="${c}"><i class="fas fa-pen"></i></button>
      <button class="delete-cat-btn text-slate-400 hover:text-red-400 text-sm" data-cat="${c}"><i class="fas fa-trash"></i></button>
    </div>`
  }).join('')
  container.querySelectorAll('.rename-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oldName = (btn as HTMLElement).dataset.cat!
      const row = btn.closest('div')!
      const nameEl = row.querySelector('span')!
      const input = document.createElement('input')
      input.type = 'text'; input.value = oldName
      input.className = 'px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1'
      nameEl.replaceWith(input)
      input.focus(); input.select()
      const save = async () => {
        const newName = input.value.trim()
        if (!newName || newName === oldName) { renderCategoriesList(loadData, renderAll); return }
        await supabase.from('streamers').update({ main_category: newName }).eq('main_category', oldName)
        await loadData(); renderAll(); renderCategoriesList(loadData, renderAll)
        showToast(`Categoria renomeada para "${newName}"`)
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderCategoriesList(loadData, renderAll) })
      input.addEventListener('blur', save)
    })
  })
  container.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = (btn as HTMLElement).dataset.cat!
      const count = streamers.filter(s => s.main_category === cat).length
      if (!await confirmAction(`Remover a categoria "${cat}" de ${count} streamer${count > 1 ? 's' : ''}?`)) return
      await supabase.from('streamers').update({ main_category: '' }).eq('main_category', cat)
      await loadData(); renderAll(); renderCategoriesList(loadData, renderAll)
      showToast(`Categoria "${cat}" removida`)
    })
  })
}

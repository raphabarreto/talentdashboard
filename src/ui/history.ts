import { getStreamerHistory } from '../lib/data'
import { fmt, monthNames } from '../utils'

export async function showHistory(id: string, name: string) {
  const modal = document.getElementById('historyModal')!
  const title = document.getElementById('historyTitle')!
  const content = document.getElementById('historyContent')!
  title.textContent = `Histórico - ${name}`
  content.innerHTML = '<p class="text-slate-400">Carregando...</p>'
  modal.classList.remove('hidden')

  const docs = await getStreamerHistory(id)
  if (!docs.length) {
    content.innerHTML = '<p class="text-slate-400">Nenhum histórico disponível. O cron vai começar a popular automaticamente.</p>'
    return
  }

  const maxAvg = Math.max(...docs.map(h => h.avg_viewers || 0))
  let html = '<div class="space-y-2 mb-6">'
  ;[...docs].reverse().forEach(h => {
    const pct = maxAvg > 0 ? ((h.avg_viewers || 0) / maxAvg * 100) : 0
    const [y, m] = h.month.split('-')
    const short = monthNames[parseInt(m) - 1]?.slice(0, 3) || h.month
    html += `<div class="flex items-center gap-2 text-xs">
      <span class="w-16 text-slate-400">${short} ${y}</span>
      <div class="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden"><div class="bg-indigo-500 h-full rounded-full" style="width:${pct}%"></div></div>
      <span class="w-14 text-right text-slate-300">${fmt(h.avg_viewers)}</span>
    </div>`
  })
  html += '</div>'

  html += `<table class="w-full text-sm text-left"><thead class="border-b border-slate-600 text-slate-400"><tr><th class="p-3">Mês</th><th class="p-3">Média</th><th class="p-3">Pico</th><th class="p-3">Hrs Assistidas</th><th class="p-3">Hrs Streamadas</th></tr></thead><tbody class="divide-y divide-slate-700">`
  docs.forEach(h => {
    const [y, m] = h.month.split('-')
    html += `<tr class="hover:bg-slate-700/50"><td class="p-3">${monthNames[parseInt(m) - 1]} ${y}</td><td class="p-3">${fmt(h.avg_viewers)}</td><td class="p-3">${fmt(h.peak_viewers)}</td><td class="p-3">${fmt(h.hours_watched)}</td><td class="p-3">${fmt(h.hours_streamed)}</td></tr>`
  })
  html += '</tbody></table>'
  content.innerHTML = html
}

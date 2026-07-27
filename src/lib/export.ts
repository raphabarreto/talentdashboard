import type { Streamer } from '../types/index'

export function exportStreamersToCSV(streamers: Streamer[], filename = 'streamers.csv') {
  // Header
  const headers = ['Nome', 'País', 'Média Viewers', 'Pico Viewers', 'Horas Assistidas', 'Horas Transmitidas']
  
  // Rows
  const rows = streamers.map(s => [
    s.name,
    s.country || '-',
    s.avg_viewers.toString(),
    s.peak_viewers.toString(),
    s.hours_watched.toString(),
    s.hours_streamed.toString(),
  ])
  
  // Generate CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  // Download
  downloadCSV(csvContent, filename)
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

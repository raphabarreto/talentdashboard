import type { Campaign, Streamer } from '../types/index'

export function exportCampaignsToCSV(campaigns: Campaign[], filename = 'campanhas.csv') {
  // Header
  const headers = ['Empresa', 'Data Início', 'Data Fim', 'Total Recebido', 'Total Pago', 'Minha Comissão', 'Moeda', 'Data Pagamento', 'Streamers']
  
  // Rows
  const rows = campaigns.map(c => {
    const totalReceived = c.total_received || 0
    const totalPaid = c.total_paid || 0
    const commission = totalReceived - totalPaid
    const streamers = c.campaign_streamers?.map(s => s.streamer_name).join('; ') || ''
    
    return [
      c.company,
      c.start_date,
      c.end_date,
      totalReceived.toFixed(2),
      totalPaid.toFixed(2),
      commission.toFixed(2),
      c.currency || 'BRL',
      c.payment_date || 'Pendente',
      streamers,
    ]
  })
  
  // Generate CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  // Download
  downloadCSV(csvContent, filename)
}

export function exportStreamersToCSV(streamers: Streamer[], filename = 'streamers.csv') {
  // Header
  const headers = ['Nome', 'País', 'Categoria', 'Média Viewers', 'Pico Viewers', 'Horas Assistidas', 'Horas Transmitidas']
  
  // Rows
  const rows = streamers.map(s => [
    s.name,
    s.country || '-',
    s.main_category || '-',
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

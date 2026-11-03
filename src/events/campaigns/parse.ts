// Conversões do formulário de campanha (funções puras, com teste).

// "1.234,56" -> 1234.56 (valor inválido ou vazio vira 0)
export function parseMoney(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(/,/g, '.')) || 0
}

// Uma linha por streamer. Aceita "nome", "nome: algo" ou "nome - $valor".
export function parseStreamerLines(text: string, alreadyConfirmed: boolean) {
  return text.split('\n').map(n => n.trim()).filter(n => n).map(line => {
    const dashMatch = line.match(/^(.+?)\s*[-–]\s*\$/)
    const name = dashMatch ? dashMatch[1].trim() : line.split(':')[0].trim()
    return { streamer_name: name, payment: 0, payment_date: null as string | null, ...(alreadyConfirmed ? { contact_status: 'confirmado' as const } : {}) }
  })
}

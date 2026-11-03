// Conversões do formulário de campanha (funções puras, com teste).

// "1.234,56" -> 1234.56 (valor inválido ou vazio vira 0)
export function parseMoney(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(/,/g, '.')) || 0
}

export interface AmbiguousLine { line: string; suggestion: string }
export interface ExtractResult {
  names: string[]              // nomes reconhecidos com segurança, sem duplicados
  ambiguous: AmbiguousLine[]   // linhas em que o sistema não tem certeza: o usuário confere
  ignored: string[]            // cabeçalhos, bandeiras, mensagens e linhas sem nome
  duplicates: number           // quantas linhas repetiam um nome já lido
}

// Palavras que aparecem em respostas de empresas e NÃO são streamers (comparadas sem acento e em minúsculas).
const NOT_A_NAME = new Set([
  'brazil', 'brasil', 'spain', 'espana', 'others', 'other', 'outros', 'portugal', 'mexico', 'argentina', 'chile',
  'colombia', 'peru', 'uruguay', 'venezuela', 'latam', 'usa', 'eua', 'us', 'uk', 'global', 'worldwide', 'europe', 'europa',
  'united states', 'united kingdom', 'south america', 'latin america', 'america latina',
  'total', 'valor', 'valores', 'pagamento', 'payment', 'payments', 'bonus', 'cpa', 'rate', 'note', 'notes', 'obs',
  'observacao', 'observacoes', 'aprovados', 'aprovado', 'approved', 'lista', 'list', 'streamers', 'streamer', 'canais',
  'nome', 'name', 'names', 'pais', 'country', 'regiao', 'region', 'hello', 'hi', 'ola', 'oi', 'obrigado', 'obrigada', 'thanks', 'thank',
])

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const FLAGS = /[\u{1F1E6}-\u{1F1FF}]/u
const DECORATION = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu
const LEADING_MARKS = /^[\s•·▪▫◦●○■□▶►→➤*>\-–—+#~`|]+/
const LEADING_NUMBER = /^\d{1,3}[.)]\s+/
const TWITCH_LINK = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]+)\S*/i
const ANY_URL = /(?:https?:\/\/|www\.)\S+|twitch\.tv\/\S+/gi
const NAME_START = /^@?([\p{L}\p{N}_]{2,25})(.*)$/u
// Depois do nome, estes caracteres indicam "o resto é informação comercial": o nome está claro.
const SEPARATOR = /^[-–—:|(\[$+@·•,;=/!?*~`]/

// Lê um texto colado (por exemplo, a resposta da empresa no Discord) e separa o que é nome de streamer.
// `known` = nomes já conhecidos (campanha em edição, streamers do dashboard): linha igual a um deles é aceita direto.
export function extractStreamerNames(text: string, known: Set<string> = new Set()): ExtractResult {
  const out: ExtractResult = { names: [], ambiguous: [], ignored: [], duplicates: 0 }
  const seen = new Set<string>()
  const knownLower = new Set([...known].map(k => k.toLowerCase()))

  const addName = (name: string) => {
    const key = name.toLowerCase()
    if (seen.has(key)) { out.duplicates++; return }
    seen.add(key)
    out.names.push(name)
  }

  for (const raw of text.split('\n')) {
    const original = raw.trim()
    if (!original) continue

    // Linha igual a um nome já conhecido: aceita como está (inclui nomes antigos com formato diferente).
    if (knownLower.has(original.toLowerCase())) { addName(original); continue }

    const hadFlag = FLAGS.test(original)
    const linkLogin = original.match(TWITCH_LINK)?.[1] ?? null

    let line = original.replace(ANY_URL, ' ').replace(DECORATION, ' ')
    line = line.replace(LEADING_MARKS, '').replace(LEADING_NUMBER, '').replace(LEADING_MARKS, '').trim()

    // Só havia link/emoji/marcador: usa o login do link, se houver.
    if (!line) {
      if (linkLogin) addName(linkLogin)
      else out.ignored.push(original)
      continue
    }

    // Cabeçalhos: terminam em ":" ou são só um país/rótulo conhecido.
    if (line.endsWith(':') || NOT_A_NAME.has(normalize(line))) { out.ignored.push(original); continue }

    const m = line.match(NAME_START)
    if (!m) { out.ignored.push(original); continue }
    const token = m[1]
    const rest = m[2]
    const restTrim = rest.trim()

    if (NOT_A_NAME.has(normalize(token))) { out.ignored.push(original); continue }

    // Só o nome na linha
    if (!restTrim) {
      // Bandeira + palavra solta que não é país conhecido: pode ser cabeçalho novo; pede conferência.
      if (hadFlag) out.ambiguous.push({ line: original, suggestion: token })
      else addName(token)
      continue
    }

    // Nome seguido de separador ou de valor ("nome - $300", "nome: x", "nome ($200)", "nome 300")
    const startsWithSpace = /^\s/.test(rest)
    if (SEPARATOR.test(restTrim) && (startsWithSpace || SEPARATOR.test(rest))) { addName(token); continue }
    if (startsWithSpace && /^\d/.test(restTrim)) { addName(token); continue }

    // Nome seguido de palavras soltas: frase de mensagem (longa) ou possível nome composto (curta).
    const words = line.split(/\s+/).length
    if (words >= 4) out.ignored.push(original)
    else out.ambiguous.push({ line: original, suggestion: token })
  }

  return out
}

// Monta as linhas de streamer da campanha a partir dos nomes já conferidos.
export function toStreamerRows(names: string[], alreadyConfirmed: boolean) {
  return names.map(name => ({
    streamer_name: name,
    payment: 0,
    payment_date: null as string | null,
    ...(alreadyConfirmed ? { contact_status: 'confirmado' as const } : {}),
  }))
}

// Junta listas de nomes sem repetir (ignora maiúsculas) e sem vazios.
export function mergeNames(...lists: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of lists.flat().map(n => n.trim()).filter(Boolean)) {
    const key = name.toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(name) }
  }
  return out
}

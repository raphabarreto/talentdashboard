// Escapa texto para uso seguro em template strings atribuídas a innerHTML
// (conteúdo de elementos e valores de atributos entre aspas).
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPES[ch])
}

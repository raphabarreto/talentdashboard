import { escapeHtml as esc } from '../../lib/escape'
import { streamers } from '../../state'

// Autocomplete de streamers já cadastrados no dashboard, aplicado à linha atual da textarea
export function setupStreamerAutocomplete() {
  const textarea = document.getElementById('campaignStreamersInput') as HTMLTextAreaElement
  const suggestions = document.getElementById('streamerSuggestions')!

  function getCurrentLine(): { text: string; start: number; end: number } {
    const cursor = textarea.selectionStart
    const value = textarea.value
    const start = value.lastIndexOf('\n', cursor - 1) + 1
    const nextBreak = value.indexOf('\n', cursor)
    const end = nextBreak === -1 ? value.length : nextBreak
    return { text: value.slice(start, end), start, end }
  }

  function show() {
    const { text } = getCurrentLine()
    const query = text.trim().toLowerCase()
    if (!query) { suggestions.classList.add('hidden'); return }
    const matches = streamers.filter(s => s.name.toLowerCase().includes(query)).slice(0, 8)
    if (!matches.length) { suggestions.classList.add('hidden'); return }
    suggestions.innerHTML = matches.map(s => `<div class="px-4 py-2 hover:bg-slate-600 cursor-pointer text-white text-sm" data-name="${esc(s.name)}">${esc(s.name)}</div>`).join('')
    suggestions.classList.remove('hidden')
  }

  textarea.addEventListener('input', show)
  textarea.addEventListener('click', show)
  textarea.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') show() })

  suggestions.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-name]') as HTMLElement | null
    if (!el) return
    const { start, end } = getCurrentLine()
    const name = el.dataset.name!
    textarea.value = textarea.value.slice(0, start) + name + textarea.value.slice(end)
    const newCursor = start + name.length
    textarea.setSelectionRange(newCursor, newCursor)
    suggestions.classList.add('hidden')
    textarea.focus()
  })

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target as Node) && e.target !== textarea) suggestions.classList.add('hidden')
  })
}

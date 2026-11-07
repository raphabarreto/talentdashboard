import { escapeHtml as esc } from '../lib/escape'
import { streamers, campaigns, currentSort } from '../state'
import { isActive } from '../utils'
import type { Streamer } from '../types/index'

export function getFilteredStreamers(prefix: string): Streamer[] {
  const search = (document.getElementById(`search-${prefix}`) as HTMLInputElement)?.value.toLowerCase() || ''
  const status = (document.getElementById(`status-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'

  return streamers
    .filter(s => !search || s.name.toLowerCase().includes(search))
    .filter(s => {
      if (status === 'all') return true
      if (status === 'live') return s.is_live
      return status === 'active' ? isActive(s) : !isActive(s)
    })
    .sort((a, b) => compareStreamers(a, b, currentSort))
}

// Números comparam por valor; textos (ex.: nome) em ordem alfabética, sem diferenciar maiúsculas/acentos.
export function compareStreamers(a: Streamer, b: Streamer, sort: { key: string; order: 'asc' | 'desc' }): number {
  const aVal = a[sort.key as keyof Streamer]
  const bVal = b[sort.key as keyof Streamer]
  const diff = typeof aVal === 'string' || typeof bVal === 'string'
    ? String(aVal ?? '').localeCompare(String(bVal ?? ''), 'pt-BR', { sensitivity: 'base' })
    : (Number(aVal) || 0) - (Number(bVal) || 0)
  return sort.order === 'desc' ? -diff : diff
}

export function getExistingCompanies(): string[] {
  return [...new Set(campaigns.map(c => c.company).filter(Boolean))].sort()
}


export function setupAutocomplete(inputId: string, suggestionsId: string, dataFn: () => string[]) {
  const input = document.getElementById(inputId) as HTMLInputElement
  const suggestions = document.getElementById(suggestionsId)!

  input.addEventListener('focus', () => showSuggestions(input, suggestions, dataFn))
  input.addEventListener('input', () => showSuggestions(input, suggestions, dataFn))
  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target as Node) && e.target !== input) suggestions.classList.add('hidden')
  })
}

function showSuggestions(input: HTMLInputElement, container: HTMLElement, dataFn: () => string[]) {
  const items = dataFn()
  const val = input.value.toLowerCase()
  const filtered = val ? items.filter(c => c.toLowerCase().includes(val)) : items
  if (!filtered.length) { container.classList.add('hidden'); return }
  container.innerHTML = filtered.map(c => `<div class="px-4 py-3 hover:bg-slate-600 cursor-pointer text-white">${esc(c)}</div>`).join('')
  container.classList.remove('hidden')
  container.querySelectorAll('div').forEach(el => {
    el.addEventListener('click', () => { input.value = el.textContent!; container.classList.add('hidden') })
  })
}

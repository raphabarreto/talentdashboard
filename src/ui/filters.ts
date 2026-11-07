import { escapeHtml as esc } from '../lib/escape'
import { streamers, campaigns, currentSort, getCachedCountries } from '../state'
import { isActive, countryNames } from '../utils'
import type { Streamer } from '../types/index'

export function getFilteredStreamers(prefix: string): Streamer[] {
  const search = (document.getElementById(`search-${prefix}`) as HTMLInputElement)?.value.toLowerCase() || ''
  const country = (document.getElementById(prefix === 'overview' ? 'country-filter' : 'country-filter-table') as HTMLSelectElement)?.value || 'all'
  const status = (document.getElementById(`status-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'

  return streamers
    .filter(s => !search || s.name.toLowerCase().includes(search))
    .filter(s => country === 'all' || s.country === country)
    .filter(s => {
      if (status === 'all') return true
      if (status === 'live') return s.is_live
      return status === 'active' ? isActive(s) : !isActive(s)
    })
    .sort((a, b) => {
      const aVal = a[currentSort.key as keyof Streamer] as number
      const bVal = b[currentSort.key as keyof Streamer] as number
      return currentSort.order === 'desc' ? bVal - aVal : aVal - bVal
    })
}

export function getExistingCompanies(): string[] {
  return [...new Set(campaigns.map(c => c.company).filter(Boolean))].sort()
}

export function populateFilters() {
  const countries = getCachedCountries()

  ;['country-filter', 'country-filter-table'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement
    const val = el.value
    el.innerHTML = '<option value="all">País</option>'
    countries.forEach(c => { el.innerHTML += `<option value="${esc(c)}">${esc(countryNames[c] || c.toUpperCase())}</option>` })
    el.value = val || 'all'
  })
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

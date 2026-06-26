import { streamers, campaigns, currentSort } from '../state'
import { isActive, countryNames } from '../utils'
import type { Streamer } from '../types'

export function getFilteredStreamers(prefix: string): Streamer[] {
  const search = (document.getElementById(`search-${prefix}`) as HTMLInputElement)?.value.toLowerCase() || ''
  const country = (document.getElementById(prefix === 'overview' ? 'country-filter' : 'country-filter-table') as HTMLSelectElement)?.value || 'all'
  const status = (document.getElementById(`status-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'
  const category = (document.getElementById(`category-filter-${prefix}`) as HTMLSelectElement)?.value || 'all'

  return streamers
    .filter(s => !search || s.name.toLowerCase().includes(search))
    .filter(s => country === 'all' || s.country === country)
    .filter(s => {
      if (status === 'all') return true
      if (status === 'live') return s.is_live
      return status === 'active' ? isActive(s) : !isActive(s)
    })
    .filter(s => category === 'all' || s.main_category === category)
    .sort((a, b) => {
      const aVal = a[currentSort.key as keyof Streamer] as number
      const bVal = b[currentSort.key as keyof Streamer] as number
      return currentSort.order === 'desc' ? bVal - aVal : aVal - bVal
    })
}

export function getExistingCategories(): string[] {
  return [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()
}

export function getExistingCompanies(): string[] {
  return [...new Set(campaigns.map(c => c.company).filter(Boolean))].sort()
}

export function populateFilters() {
  const countries = [...new Set(streamers.map(s => s.country).filter(Boolean))].sort()
  const categories = [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()

  ;['country-filter', 'country-filter-table'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement
    const val = el.value
    el.innerHTML = '<option value="all">Todos os Países</option>'
    countries.forEach(c => { el.innerHTML += `<option value="${c}">${countryNames[c] || c.toUpperCase()}</option>` })
    el.value = val || 'all'
  })
  ;['category-filter-overview', 'category-filter-table'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement
    if (!el) return
    const val = el.value
    el.innerHTML = '<option value="all">Todas Categorias</option>'
    categories.forEach(c => { el.innerHTML += `<option value="${c}">${c}</option>` })
    el.value = val || 'all'
  })
}

export function setupAutocomplete(inputId: string, suggestionsId: string, dataFn?: () => string[]) {
  const input = document.getElementById(inputId) as HTMLInputElement
  const suggestions = document.getElementById(suggestionsId)!
  const getData = dataFn || getExistingCategories

  input.addEventListener('focus', () => showSuggestions(input, suggestions, getData))
  input.addEventListener('input', () => showSuggestions(input, suggestions, getData))
  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target as Node) && e.target !== input) suggestions.classList.add('hidden')
  })
}

function showSuggestions(input: HTMLInputElement, container: HTMLElement, dataFn: () => string[]) {
  const items = dataFn()
  const val = input.value.toLowerCase()
  const filtered = val ? items.filter(c => c.toLowerCase().includes(val)) : items
  if (!filtered.length) { container.classList.add('hidden'); return }
  container.innerHTML = filtered.map(c => `<div class="px-4 py-3 hover:bg-slate-600 cursor-pointer text-white">${c}</div>`).join('')
  container.classList.remove('hidden')
  container.querySelectorAll('div').forEach(el => {
    el.addEventListener('click', () => { input.value = el.textContent!; container.classList.add('hidden') })
  })
}

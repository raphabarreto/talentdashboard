import { describe, it, expect } from 'vitest'
import { compareStreamers } from '../ui/filters'
import type { Streamer } from '../types/index'

const s = (name: string, avg: number) => ({ id: name, name, country: 'br', avg_viewers: avg, peak_viewers: 0, hours_watched: 0, hours_streamed: 0, last_live_at: null, created_at: '' }) as Streamer
const list = [s('zeus', 10), s('Ábaco', 30), s('beto', 20), s('Alfa', 5)]
const names = (sort: { key: string; order: 'asc' | 'desc' }) => [...list].sort((a, b) => compareStreamers(a, b, sort)).map(x => x.name)

describe('ordenação da tabela', () => {
  it('nome A→Z, sem diferenciar maiúsculas e acentos', () => {
    expect(names({ key: 'name', order: 'asc' })).toEqual(['Ábaco', 'Alfa', 'beto', 'zeus'])
  })

  it('nome Z→A', () => {
    expect(names({ key: 'name', order: 'desc' })).toEqual(['zeus', 'beto', 'Alfa', 'Ábaco'])
  })

  it('média continua numérica (maior→menor e menor→maior)', () => {
    expect(names({ key: 'avg_viewers', order: 'desc' })).toEqual(['Ábaco', 'beto', 'zeus', 'Alfa'])
    expect(names({ key: 'avg_viewers', order: 'asc' })).toEqual(['Alfa', 'zeus', 'beto', 'Ábaco'])
  })
})

describe('seta de ordenação no título da coluna', () => {
  it('mostra ▲/▼ só na coluna ordenada e atualiza aria-sort', async () => {
    const { updateSortIndicators } = await import('../ui/table')
    const { currentSort } = await import('../state')
    document.body.innerHTML = `<table><thead><tr>
      <th data-sort="name">Nome<span class="sort-indicator"></span></th>
      <th data-sort="avg_viewers">Média<span class="sort-indicator"></span></th></tr></thead></table>`
    const [nameTh, avgTh] = [...document.querySelectorAll('th')]
    currentSort.key = 'avg_viewers'; currentSort.order = 'desc'
    updateSortIndicators()
    expect(avgTh.querySelector('.sort-indicator')!.textContent).toBe('▼')
    expect(avgTh.getAttribute('aria-sort')).toBe('descending')
    expect(nameTh.querySelector('.sort-indicator')!.textContent).toBe('')
    expect(nameTh.getAttribute('aria-sort')).toBe('none')
    currentSort.key = 'name'; currentSort.order = 'asc'
    updateSortIndicators()
    expect(nameTh.querySelector('.sort-indicator')!.textContent).toBe('▲')
    expect(avgTh.querySelector('.sort-indicator')!.textContent).toBe('')
    currentSort.key = 'avg_viewers'; currentSort.order = 'desc'
  })
})

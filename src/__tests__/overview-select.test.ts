import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../state', () => ({
  overviewPage: 1, setOverviewPage: vi.fn(), PAGE_SIZE: 12, selectedStreamers: new Set<string>(),
}))
vi.mock('../ui/filters', () => ({
  getFilteredStreamers: () => [
    { id: 'a', name: 'Ana', country: 'br', is_live: false, avg_viewers: 1, peak_viewers: 1, hours_watched: 1, hours_streamed: 1 },
    { id: 'b', name: 'Beto', country: 'br', is_live: true, avg_viewers: 2, peak_viewers: 2, hours_watched: 2, hours_streamed: 2 },
  ],
}))

import { renderOverview, updateOverviewSelection, setSelectionMode } from '../ui/overview'
import { selectedStreamers } from '../state'

beforeEach(() => {
  selectedStreamers.clear()
  document.body.innerHTML = `<button id="overviewSelectModeBtn"><span>Selecionar</span></button>
    <div id="overviewSelectionBar" class="hidden"><span id="overviewSelectedCount"></span><span id="overviewRemoveCount"></span><button id="overviewRemoveSelectedBtn" disabled></button></div>
    <div><div id="overview-grid"></div></div>`
  setSelectionMode(false)
})
const bar = () => document.getElementById('overviewSelectionBar')!
const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`)!

describe('modo de seleção na Visão Geral', () => {
  it('por padrão os cards ficam limpos: sem caixas e sem barra', () => {
    renderOverview()
    expect(document.querySelectorAll('.card-checkbox').length).toBe(0)
    expect(bar().classList.contains('hidden')).toBe(true)
  })

  it('"Selecionar" liga as caixas (no cabeçalho do card) e a barra', () => {
    setSelectionMode(true)
    expect(document.querySelectorAll('.card-checkbox').length).toBe(2)
    expect(card('a').querySelector('.card-checkbox')!.parentElement!.classList.contains('flex')).toBe(true)
    expect(bar().classList.contains('hidden')).toBe(false)
    expect(document.querySelector('#overviewSelectModeBtn span')!.textContent).toBe('Cancelar')
  })

  it('marcados ganham borda roxa, contam na barra e liberam o botão Remover', () => {
    setSelectionMode(true)
    selectedStreamers.add('a'); updateOverviewSelection()
    expect(card('a').classList.contains('card-selected')).toBe(true)
    expect(card('b').classList.contains('card-selected')).toBe(false)
    expect(document.getElementById('overviewSelectedCount')!.textContent).toBe('1')
    expect((document.getElementById('overviewRemoveSelectedBtn') as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicar no card marca; clicar no link do nome não marca', () => {
    setSelectionMode(true)
    ;(card('a').querySelector('.flex-1') as HTMLElement).click()
    expect(selectedStreamers.has('a')).toBe(true)
    ;(card('b').querySelector('a') as HTMLElement).click()
    expect(selectedStreamers.has('b')).toBe(false)
  })

  it('sair do modo limpa a seleção e restaura os cards', () => {
    setSelectionMode(true)
    selectedStreamers.add('a'); updateOverviewSelection()
    setSelectionMode(false)
    expect(selectedStreamers.size).toBe(0)
    expect(document.querySelectorAll('.card-checkbox').length).toBe(0)
    expect(card('a').classList.contains('card-selected')).toBe(false)
    expect(bar().classList.contains('hidden')).toBe(true)
  })
})

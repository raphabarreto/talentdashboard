import { describe, it, expect, beforeEach } from 'vitest'
import { setStreamers } from '../state'
import { renderTable } from '../ui/table'

beforeEach(() => {
  document.body.innerHTML = `
    <div><div class="overflow-x-auto"><table><tbody id="table-body"></tbody></table></div></div>
    <input id="search-table" value="ninguem-assim">
    <div id="generatePdfBtn"></div><div id="removeSelectedBtn"></div>
    <span id="selectedCount"></span><span id="selectedCountRemove"></span>`
})

describe('Tabela de Dados sem resultado', () => {
  it('mostra "Nenhum streamer encontrado." em vez de ficar em branco', () => {
    setStreamers([{ id: '1', name: 'Toniki', country: 'br', avg_viewers: 1, peak_viewers: 1, hours_watched: 1, hours_streamed: 1 } as never])
    renderTable()
    const rows = document.querySelectorAll('#table-body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Nenhum streamer encontrado.')
  })
})

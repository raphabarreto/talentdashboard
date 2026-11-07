import { describe, it, expect, beforeEach } from 'vitest'
import { setStreamers } from '../state'
import { renderTable } from '../ui/table'
import type { Streamer } from '../types/index'

const streamer = (id: string, name: string, avg: number) => ({ id, name, country: 'br', avg_viewers: avg, peak_viewers: 1, hours_watched: 1, hours_streamed: 1, last_live_at: null, created_at: '', is_live: false }) as Streamer

beforeEach(() => {
  document.body.innerHTML = `
    <div><div class="overflow-x-auto"><table><tbody id="table-body"></tbody></table></div></div>
    <div id="generatePdfBtn"></div><div id="removeSelectedBtn"></div>
    <span id="selectedCount"></span><span id="selectedCountRemove"></span>`
  setStreamers([streamer('1', 'Toniki', 2387), streamer('2', 'XAROLA_', 2340)])
  renderTable()
})

const rows = () => [...document.querySelectorAll('#table-body tr')]

describe('Tabela de Dados: coluna Links', () => {
  it('cada linha tem: seleção, nome, média, links e ações (5 colunas)', () => {
    rows().forEach(r => expect(r.querySelectorAll('td')).toHaveLength(5))
  })

  it('ícone da Twitch abre o canal certo de cada streamer, em nova aba', () => {
    const hrefs = rows().map(r => r.querySelector<HTMLAnchorElement>('a.table-link-twitch')!)
    expect(hrefs.map(a => a.getAttribute('href'))).toEqual(['https://twitch.tv/toniki', 'https://twitch.tv/xarola_'])
    hrefs.forEach(a => {
      expect(a.target).toBe('_blank')
      expect(a.title).toBe('Abrir Twitch')
      expect(a.getAttribute('aria-label')).toMatch(/^Abrir Twitch de /)
    })
  })

  it('ícone de gráfico abre o SullyGnome certo (30 dias), em nova aba', () => {
    const links = rows().map(r => r.querySelector<HTMLAnchorElement>('a.table-link-sully')!)
    expect(links.map(a => a.getAttribute('href'))).toEqual(['https://sullygnome.com/channel/toniki/30', 'https://sullygnome.com/channel/xarola_/30'])
    links.forEach(a => {
      expect(a.target).toBe('_blank')
      expect(a.title).toBe('Abrir SullyGnome')
      expect(a.getAttribute('aria-label')).toMatch(/^Abrir SullyGnome de /)
    })
  })

  it('não repete mais os textos longos', () => {
    const text = document.getElementById('table-body')!.textContent!
    expect(text).not.toContain('twitch.tv/')
    expect(text).not.toContain('Ver no SullyGnome')
  })

  it('caixa de seleção e botão remover continuam em cada linha', () => {
    rows().forEach(r => {
      expect(r.querySelector('input.streamer-checkbox')).not.toBeNull()
      expect(r.querySelector('button.delete-btn')).not.toBeNull()
    })
  })
})

describe('Tabela de Dados: indicador ao vivo', () => {
  it('mostra a bolinha vermelha só em quem está ao vivo (is_live do banco)', () => {
    setStreamers([{ ...streamer('1', 'Toniki', 2387), is_live: true }, streamer('2', 'XAROLA_', 2340)])
    renderTable()
    const [live, off] = rows()
    expect(live.querySelector('.animate-pulse.bg-red-500')).not.toBeNull()
    expect(off.querySelector('.animate-pulse.bg-red-500')).toBeNull()
  })

  it('ícones com área clicável de 36 px, sem aumentar a altura da linha (margem negativa)', () => {
    rows().forEach(r => {
      r.querySelectorAll('a.table-link-twitch, a.table-link-sully').forEach(a => {
        expect(a.className).toMatch(/\bw-9\b/)
        expect(a.className).toMatch(/\bh-9\b/)
        expect(a.className).toMatch(/-my-1\b/)
      })
    })
  })
})

describe('Tabela de Dados: página e seleção', () => {
  const many = Array.from({ length: 20 }, (_, i) => streamer(String(i + 1), `s${String(i + 1).padStart(2, '0')}`, 1000 - i))

  beforeEach(async () => {
    const { selectedStreamers, setTablePage } = await import('../state')
    selectedStreamers.clear()
    setTablePage(1)
    document.body.insertAdjacentHTML('afterbegin', '<input type="checkbox" id="selectAll">')
    setStreamers(many)
    renderTable()
  })

  it('mostra 8 streamers por página', () => {
    expect(rows()).toHaveLength(8)
  })

  it('selecionar todos marca só a página atual, e desmarcar não mexe nas outras páginas', async () => {
    const { selectedStreamers, setTablePage } = await import('../state')
    const { getTablePageStreamers } = await import('../ui/table')
    getTablePageStreamers().forEach(s => selectedStreamers.add(s.id)) // o que o "selecionar todos" faz
    expect(selectedStreamers.size).toBe(8)
    setTablePage(2); renderTable()
    expect((document.getElementById('selectAll') as HTMLInputElement).checked).toBe(false)
    selectedStreamers.add(getTablePageStreamers()[0].id); renderTable()
    expect((document.getElementById('selectAll') as HTMLInputElement).indeterminate).toBe(true)
    setTablePage(1); renderTable()
    expect((document.getElementById('selectAll') as HTMLInputElement).checked).toBe(true)
    expect(selectedStreamers.size).toBe(9)
  })

  it('não existe mais o botão de exportar CSV', () => {
    expect(document.getElementById('exportCsvBtn')).toBeNull()
  })
})

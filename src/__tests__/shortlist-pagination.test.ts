import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
})
vi.mock('../lib/data', () => ({ getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn(), addProspectRow: vi.fn() }))
vi.mock('../utils', () => ({ showToast: vi.fn() }))

import { setShortlist } from '../ui/prospecting/shortlist'
import { renderShortlist } from '../ui/prospecting/render'
import { ps } from '../ui/prospecting/state'

const item = (i: number) => ({ user_login: `s${i}`, user_name: `S${i}`, viewer_count: 0, game_name: '', email: null, language: 'pt', added_at: '2026-01-01' })
const names = () => [...document.querySelectorAll('#shortlistBody tr td:first-child')].map(td => td.textContent!.trim())

beforeEach(() => {
  document.body.innerHTML = `<div id="shortlistSection"></div><span id="shortlistCount"></span><table><tbody id="shortlistBody"></tbody></table><div id="shortlistPagination"></div>`
  ps.listPage = 1
  setShortlist(Array.from({ length: 25 }, (_, i) => item(i + 1)) as never)
})

describe('Minha Lista: paginação', () => {
  it('mostra 10 por página, com o total real no contador', () => {
    renderShortlist()
    expect(names()).toHaveLength(10)
    expect(document.getElementById('shortlistCount')!.textContent).toBe('25')
    expect(document.getElementById('shortlistPagination')!.textContent).toContain('Página 1 de 3')
  })

  it('"Próxima" mostra os itens seguintes e a última página tem o resto (5)', () => {
    renderShortlist()
    document.querySelector<HTMLElement>('.shortlist-next')!.click()
    expect(names()[0]).toBe('S11')
    document.querySelector<HTMLElement>('.shortlist-next')!.click()
    expect(names()).toEqual(['S21', 'S22', 'S23', 'S24', 'S25'])
    expect((document.querySelector('.shortlist-next') as HTMLButtonElement).disabled).toBe(true)
  })

  it('se a página some (ex.: removeu itens), volta para a última existente', () => {
    ps.listPage = 3
    setShortlist(Array.from({ length: 12 }, (_, i) => item(i + 1)) as never)
    renderShortlist()
    expect(ps.listPage).toBe(2)
    expect(names()).toEqual(['S11', 'S12'])
  })

  it('até 10 itens: sem paginação', () => {
    setShortlist(Array.from({ length: 10 }, (_, i) => item(i + 1)) as never)
    renderShortlist()
    expect(document.getElementById('shortlistPagination')!.innerHTML).toBe('')
  })
})

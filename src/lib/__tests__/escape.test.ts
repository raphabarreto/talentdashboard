import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../escape'

describe('escapeHtml', () => {
  it('escapa caracteres perigosos em conteúdo e atributos', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(escapeHtml('" onmouseover="x')).toBe('&quot; onmouseover=&quot;x')
    expect(escapeHtml("a'b&c`d")).toBe('a&#39;b&amp;c&#96;d')
  })

  it('retorna string vazia para null e undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('converte números e mantém texto normal', () => {
    expect(escapeHtml(42)).toBe('42')
    expect(escapeHtml('Canal Legal')).toBe('Canal Legal')
  })
})

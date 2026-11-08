import { describe, it, expect, vi, beforeEach } from 'vitest'
import { showLoadError } from '../ui/loadError'

beforeEach(() => {
  document.body.innerHTML = '<div id="loading-overlay" class="hidden"><div class="animate-pulse">esqueleto</div></div>'
})

describe('falha no carregamento inicial', () => {
  it('troca o esqueleto por um aviso claro com botão para tentar de novo', () => {
    showLoadError(() => {})
    const overlay = document.getElementById('loading-overlay')!
    expect(overlay.classList.contains('hidden')).toBe(false)
    expect(overlay.textContent).toContain('Não foi possível carregar os dados')
    expect(overlay.querySelector('.animate-pulse')).toBeNull()
    expect(overlay.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('"Tentar novamente" chama o recarregamento uma vez e evita cliques repetidos', () => {
    const retry = vi.fn()
    showLoadError(retry)
    const btn = document.getElementById('loadRetryBtn') as HTMLButtonElement
    btn.click()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Carregando...')
  })

  it('sem a tela de carregamento na página, não quebra', () => {
    document.body.innerHTML = ''
    expect(() => showLoadError(() => {})).not.toThrow()
  })
})

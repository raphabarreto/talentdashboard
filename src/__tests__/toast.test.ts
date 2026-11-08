import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showToast } from '../utils'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="toast" class="translate-y-[200%]"><span id="toast-message"></span></div>'
})
afterEach(() => vi.useRealTimers())

const visible = () => document.getElementById('toast')!.classList.contains('translate-y-0')

describe('showToast', () => {
  it('aparece e some depois de 3 segundos', () => {
    showToast('oi')
    expect(visible()).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(visible()).toBe(false)
  })

  it('um aviso novo reinicia a contagem: o anterior não o esconde antes da hora', () => {
    showToast('primeiro')
    vi.advanceTimersByTime(2500)
    showToast('segundo')
    vi.advanceTimersByTime(1000) // 3,5 s desde o primeiro, 1 s desde o segundo
    expect(visible()).toBe(true)
    expect(document.getElementById('toast-message')!.textContent).toBe('segundo')
    vi.advanceTimersByTime(2000)
    expect(visible()).toBe(false)
  })
})

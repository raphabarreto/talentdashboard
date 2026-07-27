import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce, sanitizeCurrencyInput } from '../utils'

describe('Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('debounce', () => {
    it('deve atrasar a execução da função', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 300)
      
      debounced()
      expect(fn).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(300)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('deve cancelar execuções anteriores', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 300)
      
      debounced()
      debounced()
      debounced()
      
      vi.advanceTimersByTime(300)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('deve passar argumentos corretamente', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 300)
      
      debounced('arg1', 'arg2')
      vi.advanceTimersByTime(300)
      
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('sanitizeCurrencyInput', () => {
    it('deve remover letras e símbolos, mantendo dígitos', () => {
      expect(sanitizeCurrencyInput('abc123')).toBe('123')
      expect(sanitizeCurrencyInput('R$ 100')).toBe('100')
    })

    it('deve manter pontos (milhar) e vírgula (decimal)', () => {
      expect(sanitizeCurrencyInput('1.234,56')).toBe('1.234,56')
    })

    it('deve permitir apenas uma vírgula decimal', () => {
      expect(sanitizeCurrencyInput('12,34,56')).toBe('12,3456')
    })

    it('deve remover espaços e caracteres inválidos misturados com números', () => {
      expect(sanitizeCurrencyInput('1 2 3 abc')).toBe('123')
    })
  })
})

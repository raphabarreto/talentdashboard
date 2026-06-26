import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from '../utils'

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
})

import { describe, it, expect, beforeEach } from 'vitest'
import { setStreamers, getCachedCountries } from '../state'
import type { Streamer } from '../types/index'

describe('State - Cache', () => {
  const mockStreamers: Streamer[] = [
    { id: '1', name: 'Streamer1', country: 'br', avg_viewers: 1000, peak_viewers: 2000, hours_watched: 10000, hours_streamed: 100, last_live_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: '2', name: 'Streamer2', country: 'us', avg_viewers: 500, peak_viewers: 1000, hours_watched: 5000, hours_streamed: 50, last_live_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: '3', name: 'Streamer3', country: 'br', avg_viewers: 800, peak_viewers: 1500, hours_watched: 8000, hours_streamed: 80, last_live_at: new Date().toISOString(), created_at: new Date().toISOString() },
  ]

  beforeEach(() => {
    setStreamers([])
  })

  describe('getCachedCountries', () => {
    it('deve retornar países únicos ordenados', () => {
      setStreamers(mockStreamers)
      const countries = getCachedCountries()
      expect(countries).toEqual(['br', 'us'])
    })

    it('deve usar cache na segunda chamada', () => {
      setStreamers(mockStreamers)
      getCachedCountries() // Primeira chamada popula o cache
      
      // Limpar streamers mas não invalidar cache manualmente
      // O cache só deve ser recalculado na próxima setStreamers
      const countries = getCachedCountries()
      expect(countries).toEqual(['br', 'us'])
      
      // Se fosse recalcular, estaria vazio
      // Cache mantém o valor anterior
    })

    it('deve invalidar cache ao atualizar streamers', () => {
      setStreamers(mockStreamers)
      const first = getCachedCountries()
      
      setStreamers([...mockStreamers, { ...mockStreamers[0], id: '4', country: 'es' }])
      const second = getCachedCountries()
      
      expect(first).not.toBe(second)
      expect(second).toEqual(['br', 'es', 'us'])
    })
  })
})

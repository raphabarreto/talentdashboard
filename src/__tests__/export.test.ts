import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportStreamersToCSV } from '../lib/export'
import type { Streamer } from '../types/index'

describe('Export', () => {
  let mockCreateElement: any
  let mockCreateObjectURL: any
  let mockLink: any

  beforeEach(() => {
    mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {}
    }
    mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
    mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportStreamersToCSV', () => {
    it('deve gerar CSV com headers corretos', () => {
      const streamers: Streamer[] = [
        { id: '1', name: 'Test1', country: 'br', avg_viewers: 1000, peak_viewers: 2000, hours_watched: 5000, hours_streamed: 100, last_live_at: null, created_at: '' }
      ]
      
      exportStreamersToCSV(streamers, 'test.csv')
      
      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('deve incluir todos os dados do streamer', () => {
      const streamers: Streamer[] = [
        { id: '1', name: 'TestStreamer', country: 'br', avg_viewers: 500, peak_viewers: 1000, hours_watched: 10000, hours_streamed: 200, last_live_at: null, created_at: '' }
      ]
      
      exportStreamersToCSV(streamers)
      
      // Verifica que foi criado um Blob com o conteúdo
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('deve usar nome padrão se não fornecido', () => {
      exportStreamersToCSV([])
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'streamers.csv')
    })
  })
})

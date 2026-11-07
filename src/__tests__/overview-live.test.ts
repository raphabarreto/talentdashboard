import { describe, it, expect, beforeEach } from 'vitest'
import { setStreamers } from '../state'
import { renderOverview } from '../ui/overview'
import type { Streamer } from '../types/index'

const streamer = (id: string, name: string, is_live: boolean) => ({ id, name, country: 'br', avg_viewers: 1, peak_viewers: 1, hours_watched: 1, hours_streamed: 1, last_live_at: null, created_at: '', is_live }) as Streamer

beforeEach(() => {
  document.body.innerHTML = '<div><div id="overview-grid"></div></div>'
})

describe('Visão Geral: selo AO VIVO e legendas', () => {
  it('mostra o selo "AO VIVO" só no card de quem está ao vivo', () => {
    setStreamers([streamer('1', 'aovivo', true), streamer('2', 'offline', false)])
    renderOverview()
    const cards = [...document.querySelectorAll('#overview-grid > div')]
    const live = cards.find(c => c.textContent!.includes('aovivo'))!
    const off = cards.find(c => c.textContent!.includes('offline'))!
    expect(live.querySelector('.live-badge')?.textContent).toContain('AO VIVO')
    expect(off.querySelector('.live-badge')).toBeNull()
  })

  it('usa legendas por extenso', () => {
    setStreamers([streamer('1', 'alguem', false)])
    renderOverview()
    const text = document.getElementById('overview-grid')!.textContent!
    expect(text).toContain('Horas assistidas')
    expect(text).toContain('Horas em live')
  })
})

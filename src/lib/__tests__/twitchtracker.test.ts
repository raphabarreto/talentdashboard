import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }))
import { fetchInitialStats } from '../twitch'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks() })

describe('fetchInitialStats (twitchtracker)', () => {
  it('codifica o nome do canal na URL', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ avg_viewers: 5 }), { status: 200 }))
    globalThis.fetch = f as unknown as typeof fetch
    await fetchInitialStats('a/../b?x=1')
    expect(String(f.mock.calls[0][0])).toBe('https://twitchtracker.com/api/channels/summary/a%2F..%2Fb%3Fx%3D1')
  })

  it('retorna null (sem lancar) e registra aviso quando o servico falha', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('x', { status: 503 })) as unknown as typeof fetch
    expect(await fetchInitialStats('ana')).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it('retorna null quando a requisicao falha por rede', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('rede')) as unknown as typeof fetch
    expect(await fetchInitialStats('ana')).toBeNull()
  })

  it('mapeia os campos quando tudo da certo', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ avg_viewers: 10, max_viewers: 20, hours_watched: 30, minutes_streamed: 120 }), { status: 200 })) as unknown as typeof fetch
    expect(await fetchInitialStats('ana')).toEqual({ avg_viewers: 10, peak_viewers: 20, hours_watched: 30, hours_streamed: 2 })
  })
})

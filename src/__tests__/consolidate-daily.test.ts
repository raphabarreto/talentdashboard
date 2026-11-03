import { describe, it, expect, vi, beforeEach } from 'vitest'

// consolidate-daily: so apaga snapshots antigos quando todos os updates deram certo.

const createClientMock = vi.fn()
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

type Handler = (req: Request) => Promise<Response>
let handler: Handler

const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  CRON_SECRET: 'segredo',
}

const req = () => new Request('https://x/functions/v1/consolidate-daily', {
  method: 'POST', headers: { 'x-cron-secret': 'segredo' },
})

function mockDb(opts: { updateError?: boolean; deleteError?: boolean }) {
  const del = vi.fn(() => ({ lt: vi.fn().mockResolvedValue({ error: opts.deleteError ? { message: 'falhou' } : null }) }))
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: opts.updateError ? { message: 'rls' } : null }) }))
  const metrics = [{ streamer_id: 'a', avg_viewers: 1, peak_viewers: 2, hours_streamed: 3, hours_watched: 4 }]
  createClientMock.mockImplementation(() => ({
    rpc: vi.fn().mockResolvedValue({ data: metrics, error: null }),
    from: (t: string) => (t === 'streamers' ? { update } : { delete: del }),
  }))
  return { del }
}

beforeEach(async () => {
  createClientMock.mockReset()
  ;(globalThis as any).Deno = { env: { get: (k: string) => ENV[k] }, serve: (h: Handler) => { handler = h } }
  vi.resetModules()
  const path = '../../supabase/functions/consolidate-daily/index.ts'
  await import(/* @vite-ignore */ path)
})

describe('consolidate-daily', () => {
  it('limpa snapshots antigos quando tudo da certo', async () => {
    const { del } = mockDb({})
    const res = await handler(req())
    expect(res.status).toBe(200)
    expect((await res.json()).cleaned).toBe(true)
    expect(del).toHaveBeenCalledOnce()
  })

  it('NAO apaga nada e retorna 500 quando um update falha', async () => {
    const { del } = mockDb({ updateError: true })
    const res = await handler(req())
    expect(res.status).toBe(500)
    expect((await res.json()).cleaned).toBe(false)
    expect(del).not.toHaveBeenCalled()
  })

  it('retorna 500 e cleaned=false quando a limpeza falha', async () => {
    mockDb({ deleteError: true })
    const res = await handler(req())
    expect(res.status).toBe(500)
    expect((await res.json()).cleaned).toBe(false)
  })
})

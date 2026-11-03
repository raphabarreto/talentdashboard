import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Garante que falhas da Twitch nao viram dados falsos (snapshots "offline" / listas vazias).
// Deno, supabase-js e fetch sao simulados.

const createClientMock = vi.fn()
vi.mock('https://esm.sh/@supabase/supabase-js@2.118.0', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))
vi.mock('https://esm.sh/zod@4.6.7', async () => await import('zod'))

type Handler = (req: Request) => Promise<Response>
let handler: Handler
const fetchMock = vi.fn()
const realFetch = globalThis.fetch

const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  CRON_SECRET: 'segredo',
  TWITCH_CLIENT_ID: 'cid',
  TWITCH_CLIENT_SECRET: 'csecret',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function load(fn: string) {
  ;(globalThis as any).Deno = { env: { get: (k: string) => ENV[k] }, serve: (h: Handler) => { handler = h } }
  vi.resetModules()
  const path = `../../supabase/functions/${fn}/index.ts`
  await import(/* @vite-ignore */ path)
}

beforeEach(() => {
  createClientMock.mockReset()
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => { globalThis.fetch = realFetch })

describe('collect-snapshots', () => {
  const cronReq = () => new Request('https://x/functions/v1/collect-snapshots', {
    method: 'POST', headers: { 'x-cron-secret': 'segredo' },
  })

  function mockDb() {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const inFn = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ in: inFn }))
    const select = vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Ana' }], error: null })
    createClientMock.mockImplementation(() => ({
      from: (t: string) => (t === 'streamers' ? { select, update } : { insert }),
    }))
    return { insert }
  }

  beforeEach(async () => { await load('collect-snapshots') })

  it('aborta sem gravar quando o token da Twitch falha', async () => {
    const { insert } = mockDb()
    fetchMock.mockResolvedValueOnce(json({ message: 'invalid client' }, 400))
    const res = await handler(cronReq())
    expect(res.status).toBe(500)
    expect(insert).not.toHaveBeenCalled()
  })

  it('aborta sem gravar quando a consulta de streams falha', async () => {
    const { insert } = mockDb()
    fetchMock.mockResolvedValueOnce(json({ access_token: 't' })).mockResolvedValueOnce(json({}, 429))
    const res = await handler(cronReq())
    expect(res.status).toBe(500)
    expect(insert).not.toHaveBeenCalled()
  })

  it('grava os snapshots quando tudo da certo', async () => {
    const { insert } = mockDb()
    fetchMock.mockResolvedValueOnce(json({ access_token: 't' }))
      .mockResolvedValueOnce(json({ data: [{ user_login: 'ana', viewer_count: 10, game_name: 'X' }] }))
    const res = await handler(cronReq())
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })
})

describe('twitch-proxy', () => {
  const proxyReq = () => new Request('https://x/functions/v1/twitch-proxy?action=streams&usernames=ana', {
    headers: { authorization: 'Bearer jwt' },
  })

  beforeEach(async () => {
    createClientMock.mockImplementation(() => ({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    }))
    await load('twitch-proxy')
  })

  it('retorna 502 (nao lista vazia) quando a Twitch responde erro', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 't', expires_in: 3600 })).mockResolvedValueOnce(json({}, 500))
    const res = await handler(proxyReq())
    expect(res.status).toBe(502)
  })

  it('retorna 502 quando o token nao e emitido', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'forbidden' }, 403))
    const res = await handler(proxyReq())
    expect(res.status).toBe(502)
  })
})

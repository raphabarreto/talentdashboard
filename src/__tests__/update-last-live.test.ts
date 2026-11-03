import { describe, it, expect, vi, beforeEach } from 'vitest'

// Testa o handler da Edge Function update-last-live com Deno e supabase-js simulados.
// Objetivo: garantir que a gravacao use o JWT do usuario (RLS) e nao a service role.

const createClientMock = vi.fn()

vi.mock('https://esm.sh/@supabase/supabase-js@2.118.0', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))
vi.mock('https://esm.sh/zod@3.23.8', async () => await import('zod'))

type Handler = (req: Request) => Promise<Response>
let handler: Handler

const VALID_BODY = { streamer_id: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', last_live_at: '2026-01-01T00:00:00Z' }

function makeRequest(body: unknown, withAuth = true) {
  return new Request('https://x.supabase.co/functions/v1/update-last-live', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(withAuth ? { authorization: 'Bearer user-jwt' } : {}) },
    body: JSON.stringify(body),
  })
}

// Cliente simulado: getUser + from().update().eq().select()
function mockClients(opts: { user: object | null; updated: object[] | null; dbError?: object }) {
  const select = vi.fn().mockResolvedValue({ data: opts.updated, error: opts.dbError ?? null })
  const eq = vi.fn(() => ({ select }))
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  createClientMock.mockImplementation(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }) },
    from,
  }))
  return { from, update, eq, select }
}

beforeEach(async () => {
  createClientMock.mockReset()
  const envVars: Record<string, string> = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key-test',
  }
  ;(globalThis as any).Deno = {
    env: { get: (k: string) => envVars[k] },
    serve: (h: Handler) => { handler = h },
  }
  vi.resetModules()
  // Caminho em variavel: evita o tsc do front seguir o arquivo Deno (que usa o global Deno).
  const functionPath = '../../supabase/functions/update-last-live/index.ts'
  await import(/* @vite-ignore */ functionPath)
})

describe('update-last-live', () => {
  it('retorna 401 sem header Authorization', async () => {
    mockClients({ user: null, updated: [] })
    const res = await handler(makeRequest(VALID_BODY, false))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando o JWT nao corresponde a um usuario', async () => {
    mockClients({ user: null, updated: [] })
    const res = await handler(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('retorna 400 para entrada invalida', async () => {
    mockClients({ user: { id: 'u1' }, updated: [{ id: 'x' }] })
    const res = await handler(makeRequest({ streamer_id: 'nao-e-uuid', last_live_at: 'x' }))
    expect(res.status).toBe(400)
  })

  it('grava com a anon key e o JWT do usuario, nunca com a service role', async () => {
    mockClients({ user: { id: 'u1' }, updated: [{ id: VALID_BODY.streamer_id }] })
    const res = await handler(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)

    const keysUsed = createClientMock.mock.calls.map(c => c[1])
    expect(keysUsed).not.toContain('service-key-test')

    const writeClientCall = createClientMock.mock.calls.find(c => c[2]?.global?.headers?.Authorization)
    expect(writeClientCall?.[2].global.headers.Authorization).toBe('Bearer user-jwt')
  })

  it('retorna 403 quando a RLS bloqueia (nenhuma linha afetada)', async () => {
    mockClients({ user: { id: 'u1' }, updated: [] })
    const res = await handler(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('retorna 500 em erro real do banco', async () => {
    mockClients({ user: { id: 'u1' }, updated: null, dbError: { message: 'boom' } })
    const res = await handler(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
  })
})

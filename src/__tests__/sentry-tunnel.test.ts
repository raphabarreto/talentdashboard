import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDsn, tunnelTarget, POST, GET } from '../../api/sentry-tunnel'

const DSN = 'https://abc123@o111.ingest.us.sentry.io/4507'
const envelope = (dsn: string) => `${JSON.stringify({ dsn, sent_at: '2026-11-07T00:00:00Z' })}\n{"type":"event"}\n{"message":"x"}`
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

describe('túnel do Sentry: regras', () => {
  it('lê host e projeto do DSN', () => {
    expect(parseDsn(DSN)).toEqual({ host: 'o111.ingest.us.sentry.io', projectId: '4507' })
    expect(parseDsn('http://k@o1.ingest.sentry.io/1')).toBeNull()
    expect(parseDsn('lixo')).toBeNull()
    expect(parseDsn('')).toBeNull()
  })

  it('aceita envelope do nosso projeto e monta o destino a partir do DSN do servidor', () => {
    expect(tunnelTarget(envelope(DSN), DSN)).toBe('https://o111.ingest.us.sentry.io/api/4507/envelope/')
  })

  it('recusa outro projeto, outro host ou envelope inválido', () => {
    expect(tunnelTarget(envelope('https://abc123@o111.ingest.us.sentry.io/999'), DSN)).toBeNull()
    expect(tunnelTarget(envelope('https://abc123@evil.example.com/4507'), DSN)).toBeNull()
    expect(tunnelTarget('não é json\n{}', DSN)).toBeNull()
    expect(tunnelTarget('{}\n{}', DSN)).toBeNull()
    expect(tunnelTarget(envelope(DSN), undefined)).toBeNull()
  })
})

describe('túnel do Sentry: função', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    env.SENTRY_DSN = DSN
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { delete env.SENTRY_DSN; vi.unstubAllGlobals() })

  const req = (body: string) => new Request('https://dashlugs.vercel.app/api/sentry-tunnel', { method: 'POST', body })

  it('repassa ao Sentry o envelope do nosso projeto', async () => {
    const res = await POST(req(envelope(DSN)))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://o111.ingest.us.sentry.io/api/4507/envelope/')
  })

  it('recusa (403) e não repassa envelope de outro destino', async () => {
    const res = await POST(req(envelope('https://k@evil.example.com/4507')))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('503 se o servidor não tiver DSN configurado', async () => {
    delete env.SENTRY_DSN
    delete env.VITE_SENTRY_DSN
    expect((await POST(req(envelope(DSN)))).status).toBe(503)
  })

  it('recusa envelope grande demais (413)', async () => {
    const res = await POST(req(envelope(DSN) + 'x'.repeat(1_000_001)))
    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('502 se o Sentry não responder; GET não é permitido', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect((await POST(req(envelope(DSN)))).status).toBe(502)
    expect(GET().status).toBe(405)
  })
})

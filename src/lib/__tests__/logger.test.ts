import { describe, it, expect, vi, beforeEach } from 'vitest'

const captureException = vi.fn()
vi.mock('@sentry/browser', () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

import { log, logError } from '../logger'

beforeEach(() => {
  captureException.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_SENTRY_DSN', 'https://x@o1.ingest.us.sentry.io/1')
})

describe('logger -> Sentry', () => {
  it('envia o erro original (com stack) quando existe', () => {
    const original = new Error('falhou')
    logError(original, 'Contexto')
    expect(captureException.mock.calls[0][0]).toBe(original)
    expect(captureException.mock.calls[0][1].extra.log_message).toBe('Contexto: falhou')
  })
  it('sem erro original cria um Error com a mensagem', () => {
    log('error', 'algo deu errado')
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(captureException.mock.calls[0][0].message).toBe('algo deu errado')
  })
  it('não envia warn/info', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    log('warn', 'aviso')
    expect(captureException).not.toHaveBeenCalled()
  })
  it('não envia fora de produção', () => {
    vi.stubEnv('PROD', false)
    log('error', 'dev')
    expect(captureException).not.toHaveBeenCalled()
  })
})

// Túnel do Sentry: o navegador envia os erros para /api/sentry-tunnel (mesmo domínio do site, que
// bloqueadores de anúncio não costumam barrar) e esta função repassa ao Sentry.
// Segurança: só repassa para o projeto do DSN configurado no servidor; o destino é montado a partir
// desse DSN (nunca do que o navegador mandou), então não serve de ponte para outros endereços.

declare const process: { env: Record<string, string | undefined> }

const MAX_BYTES = 1_000_000

export interface Dsn { host: string; projectId: string }

export function parseDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\/+|\/+$/g, '')
    if (url.protocol !== 'https:' || !url.hostname || !/^\d+$/.test(projectId)) return null
    return { host: url.hostname, projectId }
  } catch {
    return null
  }
}

// Endereço do Sentry para onde o envelope pode ir, ou null se o envelope não for do nosso projeto.
export function tunnelTarget(envelope: string, allowedDsn: string | undefined): string | null {
  const allowed = parseDsn(allowedDsn)
  if (!allowed) return null
  const firstLine = envelope.slice(0, envelope.indexOf('\n') === -1 ? undefined : envelope.indexOf('\n'))
  let header: { dsn?: string }
  try { header = JSON.parse(firstLine) } catch { return null }
  const sent = parseDsn(header?.dsn)
  if (!sent || sent.host !== allowed.host || sent.projectId !== allowed.projectId) return null
  return `https://${allowed.host}/api/${allowed.projectId}/envelope/`
}

export async function POST(request: Request): Promise<Response> {
  const allowedDsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN
  if (!allowedDsn) return new Response('Sentry não configurado', { status: 503 })

  const length = Number(request.headers.get('content-length') || 0)
  if (length > MAX_BYTES) return new Response('Envelope grande demais', { status: 413 })
  const envelope = await request.text()
  if (envelope.length > MAX_BYTES) return new Response('Envelope grande demais', { status: 413 })

  const target = tunnelTarget(envelope, allowedDsn)
  if (!target) return new Response('Destino não permitido', { status: 403 })

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    })
    return new Response(null, { status: upstream.status })
  } catch {
    return new Response('Falha ao repassar ao Sentry', { status: 502 })
  }
}

export function GET(): Response {
  return new Response('Método não permitido', { status: 405, headers: { Allow: 'POST' } })
}

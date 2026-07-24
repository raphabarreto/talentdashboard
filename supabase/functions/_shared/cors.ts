// Origens permitidas a chamar as Edge Functions via browser.
// Configurar ALLOWED_ORIGIN nos secrets do Supabase para o domínio de produção.
// Sem essa env var configurada, apenas localhost (dev) é permitido - nunca "*".
const DEV_ORIGINS = ["http://localhost:8000"]

function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN")
  const allowedOrigins = configuredOrigin
    ? [configuredOrigin, ...DEV_ORIGINS]
    : DEV_ORIGINS

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  // Origem não reconhecida: omitimos o header (retornamos null) em vez de
  // vazar o domínio de produção no fallback. Sem o header, o browser do
  // solicitante bloqueia a leitura da resposta por padrão.
  return null
}

export function buildCorsHeaders(req: Request, extraHeaders = ""): Record<string, string> {
  const requestOrigin = req.headers.get("origin")
  const baseHeaders = "authorization, x-client-info, apikey, content-type"
  const allowedOrigin = resolveAllowedOrigin(requestOrigin)

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": extraHeaders ? `${baseHeaders}, ${extraHeaders}` : baseHeaders,
    "Vary": "Origin",
  }
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin
  }
  return headers
}

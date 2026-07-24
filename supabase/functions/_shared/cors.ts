// Origens permitidas a chamar as Edge Functions via browser.
// Configurar ALLOWED_ORIGIN nos secrets do Supabase para o domínio de produção.
// Sem essa env var configurada, apenas localhost (dev) é permitido - nunca "*".
const DEV_ORIGINS = ["http://localhost:8000"]

function resolveAllowedOrigin(requestOrigin: string | null): string {
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN")
  const allowedOrigins = configuredOrigin
    ? [configuredOrigin, ...DEV_ORIGINS]
    : DEV_ORIGINS

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  // Fallback restritivo: nunca "*". Se a origem não bate, usamos o primeiro
  // permitido (produção, se configurado) só para preencher o header - o
  // browser do solicitante vai bloquear a resposta por não bater com a sua origem.
  return allowedOrigins[0]
}

export function buildCorsHeaders(req: Request, extraHeaders = ""): Record<string, string> {
  const requestOrigin = req.headers.get("origin")
  const baseHeaders = "authorization, x-client-info, apikey, content-type"
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(requestOrigin),
    "Access-Control-Allow-Headers": extraHeaders ? `${baseHeaders}, ${extraHeaders}` : baseHeaders,
    "Vary": "Origin",
  }
}

// Acesso mínimo à API do GitHub para as Releases do repositório PRIVADO de backups.
// O token vem do ambiente (BACKUPS_REPO_TOKEN) e nunca é impresso; erros mostram só o código HTTP.
const API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '')

export async function ghFetch(method, urlOrPath, { token, body, accept = 'application/vnd.github+json', contentType } = {}) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : API + urlOrPath
  const headers = { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }
  if (body !== undefined) headers['Content-Type'] = contentType ?? 'application/json'
  return fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) })
}

export async function ghJson(method, path, opts = {}) {
  const res = await ghFetch(method, path, { ...opts, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  if (!res.ok) throw new Error(`${method} falhou (HTTP ${res.status})`)
  return res.status === 204 ? null : res.json()
}

export const listReleases = (repo, token) => ghJson('GET', `/repos/${repo}/releases?per_page=100`, { token })

// Baixa o conteúdo de um asset (a API redireciona para o armazenamento; o cabeçalho de autorização não segue para outro domínio).
export async function downloadAsset(repo, token, asset) {
  const res = await ghFetch('GET', `/repos/${repo}/releases/assets/${asset.id}`, { token, accept: 'application/octet-stream' })
  if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

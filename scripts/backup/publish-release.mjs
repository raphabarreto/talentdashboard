import './safe.mjs'
// Publica o backup criptografado como Release do repositório PRIVADO de backups.
// Ordem: confere o arquivo local -> confere o token/repositório -> cria RASCUNHO -> envia os 2 arquivos ->
// baixa de volta e compara hash e tamanho -> só então publica (a Release publicada é imutável).
// Qualquer falha antes de publicar apaga o rascunho e termina com erro; rascunhos de tentativas anteriores são apagados.
// Uso: node scripts/backup/publish-release.mjs <pasta-saida-do-seal>
// Env: BACKUPS_REPO_TOKEN, BACKUPS_REPO (dono/repositorio), GITHUB_RUN_ID (sufixo se a tag do dia já estiver publicada).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { downloadAsset, ghFetch, ghJson, listReleases } from './ghapi.mjs'
import { sha256 } from './lib.mjs'

const die = (m) => { console.error(`::error::${m}`); process.exit(1) }
const dir = process.argv[2]
const repo = process.env.BACKUPS_REPO
const token = process.env.BACKUPS_REPO_TOKEN
if (!dir) die('uso: publish-release.mjs <pasta>')
if (!repo || !token) die('repositorio ou token de backups nao configurado')

// 1. Arquivo local íntegro (o seal acabou de gerar; confere de novo antes de enviar)
const manifestBytes = readFileSync(join(dir, 'manifest.json'))
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const name = manifest.name
const fileName = `${name}.json.gpg`
const fileBytes = readFileSync(join(dir, fileName))
if (manifest.file !== fileName || manifest.sha256 !== sha256(fileBytes) || manifest.size !== fileBytes.length) die('arquivo local nao confere com o manifesto')

let draftId = null
const cleanup = async () => { if (draftId) await ghFetch('DELETE', `/repos/${repo}/releases/${draftId}`, { token }).catch(() => {}) }
const fail = async (m) => { await cleanup(); die(m) }

try {
  // 2. Repositório certo e com permissão de escrita (só leitura de metadados; o valor do token nunca aparece)
  const info = await ghJson('GET', `/repos/${repo}`, { token })
  if (info.private !== true) die('o repositorio de backups NAO e privado; nada foi publicado')
  if (info.permissions?.push !== true) die('o token nao tem permissao de escrita no repositorio de backups')

  // 3. Rascunhos de tentativas anteriores saem; se a tag do dia já estiver publicada (ex.: execução forçada), usa sufixo
  const releases = await listReleases(repo, token)
  for (const r of releases.filter((x) => x.draft && String(x.tag_name).startsWith(name))) {
    await ghFetch('DELETE', `/repos/${repo}/releases/${r.id}`, { token })
  }
  const taken = releases.some((r) => !r.draft && r.tag_name === name)
  const tag = taken ? `${name}-r${process.env.GITHUB_RUN_ID || Date.now()}` : name

  // 4. Rascunho + envio
  const draft = await ghJson('POST', `/repos/${repo}/releases`, { token, body: { tag_name: tag, name: tag, draft: true, body: 'Backup criptografado (GPG). Ver docs/BACKUP.md no repositorio principal.' } })
  draftId = draft.id
  const uploadBase = String(draft.upload_url).replace(/\{.*$/, '')
  const sent = []
  for (const [assetName, bytes] of [[fileName, fileBytes], ['manifest.json', manifestBytes]]) {
    const res = await ghFetch('POST', `${uploadBase}?name=${encodeURIComponent(assetName)}`, { token, body: bytes, contentType: 'application/octet-stream' })
    if (!res.ok) await fail(`envio de ${assetName} falhou (HTTP ${res.status})`)
    sent.push({ asset: await res.json(), bytes })
  }

  // 5. Conferir o que o GitHub guardou: baixa de volta e compara hash e tamanho
  for (const { asset, bytes } of sent) {
    const back = await downloadAsset(repo, token, asset)
    if (back.length !== bytes.length || sha256(back) !== sha256(bytes)) await fail(`${asset.name}: o que o GitHub guardou nao confere com o enviado`)
  }

  // 6. Publicar e confirmar
  const published = await ghJson('PATCH', `/repos/${repo}/releases/${draftId}`, { token, body: { draft: false } })
  draftId = null // publicada: não há mais rascunho para apagar
  if (published.draft !== false) die('a Release nao foi publicada')
  if (published.immutable === false) die('Release publicada, mas NAO esta imutavel; conferir a configuracao do repositorio de backups')
  console.log(`Release publicada: ${published.tag_name}, ${sent.length} arquivos, ${fileBytes.length} bytes criptografados (imutavel: ${published.immutable === true ? 'sim' : 'nao informado'})`)
} catch (e) {
  await cleanup()
  die(`falha ao publicar a Release (${e?.message?.slice(0, 80) ?? 'erro'})`)
}

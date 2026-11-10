import './safe.mjs'
// Já existe um backup VÁLIDO de hoje (data de Brasília)? Procura a Release publicada `backup-AAAA-MM-DD` no repositório
// privado de backups e não confia só no nome: confere estado (publicada, imutável confirmada: immutable === true), hash/tamanho do arquivo, manifesto
// e destinatário da criptografia.
// Limite conhecido: sem a chave privada não dá para abrir o conteúdo; a checagem prova integridade e origem, não o conteúdo.
// Se não for possível verificar, responde "não existe" (um backup a mais é inofensivo; um a menos, não).
// Env: BACKUPS_REPO_TOKEN, BACKUPS_REPO, BACKUP_GPG_PUBLIC_KEY, GITHUB_OUTPUT (ou CHECK_OUTPUT); opcional: BACKUP_NAME (testes).
import { appendFileSync } from 'node:fs'
import { listPackets, withPublicKeyring } from './gpg.mjs'
import { downloadAsset, listReleases } from './ghapi.mjs'
import { artifactNameFor, brasiliaDate, evaluateCandidate, parsePacketKeyIds, sha256 } from './lib.mjs'

const repo = process.env.BACKUPS_REPO
const token = process.env.BACKUPS_REPO_TOKEN
const name = process.env.BACKUP_NAME || artifactNameFor(brasiliaDate())

function finish(exists, reason) {
  console.log(`backup do dia (${name}): ${exists ? 'ja existe e esta integro' : `nao encontrado (${reason})`}`)
  const dest = process.env.CHECK_OUTPUT || process.env.GITHUB_OUTPUT
  if (dest) appendFileSync(dest, `exists=${exists}\n`)
}

let expectedKeyIds
try {
  expectedKeyIds = withPublicKeyring(process.env.BACKUP_GPG_PUBLIC_KEY, ({ keyIds }) => keyIds)
} catch (e) {
  console.error(`::error::${e.message}`)
  process.exit(1) // sem a chave pública configurada não há como criar nem validar backups
}

let found = false
const reasons = []
try {
  if (!repo || !token) throw new Error('repositorio ou token de backups nao configurado')
  const candidates = (await listReleases(repo, token)).filter((r) => r.tag_name === name && !r.draft)
  if (candidates.length === 0) reasons.push('nenhuma release publicada')
  for (const release of candidates) {
    try {
      const mAsset = release.assets?.find((a) => a.name === 'manifest.json')
      const fAsset = release.assets?.find((a) => a.name === `${name}.json.gpg`)
      if (!mAsset || !fAsset) { reasons.push('arquivos-ausentes'); continue }
      const manifest = JSON.parse((await downloadAsset(repo, token, mAsset)).toString('utf8'))
      const bytes = await downloadAsset(repo, token, fAsset)
      const recipients = withPublicKeyring(process.env.BACKUP_GPG_PUBLIC_KEY, ({ home }) => parsePacketKeyIds(listPackets(home, bytes)))
      const reason = evaluateCandidate({
        name, release, manifest, fileSha256: sha256(bytes), fileSize: bytes.length,
        expectedKeyIds: recipients.length ? expectedKeyIds : [],
      })
      if (reason) reasons.push(reason)
      // o destinatário real do arquivo precisa coincidir com o declarado no manifesto
      else if (!recipients.every((k) => manifest.recipients.includes(k))) reasons.push('destinatario-diverge-do-manifesto')
      else { found = true; break }
    } catch (e) {
      reasons.push(`nao-verificavel(${e?.name ?? 'erro'})`)
    }
  }
} catch (e) {
  console.log(`::warning::nao foi possivel consultar as releases (${e?.name ?? 'erro'}); sera criado um novo backup`)
  reasons.push('consulta-falhou')
}
finish(found, [...new Set(reasons)].join(','))

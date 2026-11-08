import './safe.mjs'
// Já existe um backup VÁLIDO de hoje (data de Brasília)? Não confia no nome do artifact: confere procedência
// (nosso workflow, neste repositório, evento manual/agendado, ramo main, execução concluída com sucesso),
// hash/tamanho do arquivo, manifesto e destinatário da criptografia.
// Limite conhecido: sem a chave privada não dá para abrir o conteúdo; a checagem prova integridade e procedência, não o conteúdo.
// Se não for possível verificar, responde "não existe" (um backup a mais é inofensivo; um a menos, não).
// Env: GH_TOKEN, GITHUB_REPOSITORY, BACKUP_GPG_PUBLIC_KEY, GITHUB_OUTPUT (ou CHECK_OUTPUT); opcionais: ARTIFACT_NAME, ACCEPT_RUN_ID (auto-teste).
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listPackets, withPublicKeyring } from './gpg.mjs'
import { artifactNameFor, brasiliaDate, evaluateCandidate, parsePacketKeyIds, sha256 } from './lib.mjs'

const repo = process.env.GITHUB_REPOSITORY
const name = process.env.ARTIFACT_NAME || artifactNameFor(brasiliaDate())
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

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
  const list = JSON.parse(gh(['api', `repos/${repo}/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`]))
  const candidates = (list.artifacts ?? []).filter((a) => a.name === name && !a.expired).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  if (candidates.length === 0) reasons.push('nenhum artifact')
  for (const artifact of candidates) {
    const dir = mkdtempSync(join(tmpdir(), 'bkchk-'))
    try {
      const runId = artifact.workflow_run?.id
      const run = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${runId}`]))
      gh(['run', 'download', String(runId), '-R', repo, '-n', name, '-D', dir])
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
      const bytes = readFileSync(join(dir, `${name}.json.gpg`))
      const recipients = withPublicKeyring(process.env.BACKUP_GPG_PUBLIC_KEY, ({ home }) => parsePacketKeyIds(listPackets(home, bytes)))
      const reason = evaluateCandidate({
        name, artifact, run, manifest, fileSha256: sha256(bytes), fileSize: bytes.length, repo,
        expectedKeyIds: recipients.length ? expectedKeyIds : [], acceptRunId: process.env.ACCEPT_RUN_ID,
      })
      if (reason) reasons.push(reason)
      // o destinatário real do arquivo precisa coincidir com o declarado no manifesto
      else if (!recipients.every((k) => manifest.recipients.includes(k))) reasons.push('destinatario-diverge-do-manifesto')
      else { found = true; break }
    } catch (e) {
      reasons.push(`nao-verificavel(${e?.name ?? 'erro'})`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
} catch (e) {
  console.log(`::warning::nao foi possivel consultar os artifacts (${e?.name ?? 'erro'}); sera criado um novo backup`)
  reasons.push('consulta-falhou')
}
finish(found, [...new Set(reasons)].join(','))

// Funções puras do backup automático (sem rede, sem disco): fáceis de testar com dados fictícios.
// REGRA: nenhuma mensagem de erro/aviso daqui pode conter valores do banco (os logs do Actions são públicos);
// só nomes de tabelas, contagens e códigos.
import { createHash } from 'node:crypto'

// Ordem de restauração (respeita as chaves estrangeiras).
export const TABLES = ['allowed_users', 'streamers', 'campaigns', 'campaign_streamers', 'prospect_shortlist', 'streamer_history']
export const PRIMARY_KEY = { allowed_users: 'email', prospect_shortlist: 'user_login' }
export const pkOf = (t) => PRIMARY_KEY[t] ?? 'id'
// Sem estas duas, o backup é considerado vazio/defeituoso (as demais podem ficar vazias legitimamente).
export const ESSENTIAL_NON_EMPTY = ['allowed_users', 'streamers']
export const FORMAT = 1

export const REQUIRED_COLUMNS = {
  allowed_users: ['email'],
  streamers: ['id', 'name', 'country', 'avg_viewers', 'peak_viewers', 'hours_watched', 'hours_streamed', 'game_name', 'created_at', 'main_category', 'last_live_at'],
  campaigns: ['id', 'company', 'start_date', 'end_date', 'created_at', 'campaign_value', 'currency', 'my_commission', 'payment_date', 'total_received', 'commission_percentage', 'original_amount_usd'],
  campaign_streamers: ['id', 'campaign_id', 'streamer_name', 'payment', 'payment_date', 'contact_status'],
  prospect_shortlist: ['user_login', 'data', 'created_at'],
  streamer_history: ['id', 'streamer_id', 'month', 'avg_viewers', 'peak_viewers', 'hours_watched', 'hours_streamed', 'created_at'],
}

// Uma única instrução SQL = um único retrato (snapshot) do banco: as tabelas e as contagens
// vêm do MESMO instante, então alterações feitas durante a execução nunca geram divergência.
export function buildBackupQuery() {
  const rows = TABLES.map((t) => `'${t}', (select coalesce(jsonb_agg(to_jsonb(x) order by x.${pkOf(t)}), '[]'::jsonb) from public.${t} x)`).join(',\n    ')
  const counts = TABLES.map((t) => `'${t}', (select count(*) from public.${t})`).join(', ')
  // ::text => a API devolve o texto exato do jsonb (números sem passar por double do JavaScript)
  return `select (jsonb_build_object(\n  'format', ${FORMAT},\n  'generated_at', now(),\n  'tables', jsonb_build_object(\n    ${rows}\n  ),\n  'counts', jsonb_build_object(${counts})\n))::text as backup`
}

// Texto exato do backup, sem reserializar (preserva a precisão de numeric).
export function extractBackupText(response) {
  const row = Array.isArray(response) ? response[0] : response
  const b = row && typeof row === 'object' && 'backup' in row ? row.backup : undefined
  if (typeof b !== 'string' || b.length < 2) throw new Error('resposta da API sem o campo backup em texto')
  return b
}

export function extractBackup(response) {
  try {
    const row = Array.isArray(response) ? response[0] : response
    let doc = row && typeof row === 'object' && 'backup' in row ? row.backup : row
    if (typeof doc === 'string') doc = JSON.parse(doc)
    return doc
  } catch {
    throw new Error('resposta da API nao e um JSON valido')
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function validateBackup(doc) {
  const errors = []
  const warnings = []
  const counts = {}
  if (!isObj(doc)) return { ok: false, errors: ['documento invalido'], warnings, counts }
  if (doc.format !== FORMAT) errors.push(`formato inesperado (${typeof doc.format === 'number' ? doc.format : 'ausente'})`)
  if (!isObj(doc.tables)) return { ok: false, errors: [...errors, 'campo tables ausente'], warnings, counts }
  if (!isObj(doc.counts)) errors.push('campo counts ausente')

  for (const t of TABLES) {
    const rows = doc.tables[t]
    if (!Array.isArray(rows)) { errors.push(`tabela ${t} ausente ou invalida`); continue }
    counts[t] = rows.length
    if (isObj(doc.counts) && doc.counts[t] !== rows.length) errors.push(`contagem de ${t} diverge (${rows.length} linhas, ${doc.counts?.[t]} contadas)`)
    if (ESSENTIAL_NON_EMPTY.includes(t) && rows.length === 0) errors.push(`tabela essencial ${t} esta vazia`)
    const pk = pkOf(t)
    const seen = new Set()
    let missingCols = 0
    let badRows = 0
    let dupes = 0
    for (const r of rows) {
      if (!isObj(r)) { badRows++; continue }
      if (REQUIRED_COLUMNS[t].some((c) => !(c in r))) missingCols++
      const k = r[pk]
      if (k === null || k === undefined || k === '') badRows++
      else if (seen.has(k)) dupes++
      else seen.add(k)
    }
    if (badRows) errors.push(`${t}: ${badRows} linha(s) sem chave primaria`)
    if (dupes) errors.push(`${t}: ${dupes} chave(s) primaria(s) repetida(s)`)
    if (missingCols) errors.push(`${t}: ${missingCols} linha(s) sem colunas esperadas`)
  }

  // Relacionamentos: no mesmo retrato, nenhuma referência pode ficar solta.
  const ids = (t) => new Set((doc.tables[t] ?? []).filter(isObj).map((r) => r.id))
  const orphans = (child, col, parent) => {
    if (!Array.isArray(doc.tables[child]) || !Array.isArray(doc.tables[parent])) return
    const ok = ids(parent)
    const n = doc.tables[child].filter((r) => isObj(r) && r[col] != null && !ok.has(r[col])).length
    if (n) errors.push(`${child}: ${n} referencia(s) para ${parent} sem correspondente`)
  }
  orphans('campaign_streamers', 'campaign_id', 'campaigns')
  orphans('streamer_history', 'streamer_id', 'streamers')

  if (Array.isArray(doc.tables.campaigns) && doc.tables.campaigns.length === 0) warnings.push('tabela campaigns vazia')
  return { ok: errors.length === 0, errors, warnings, counts }
}

// ---- comparação backup original x banco restaurado (independe do fuso e da formatação de números) ----
const ISO_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/
export function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical)
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
  if (typeof v === 'string' && ISO_TS.test(v)) {
    // normaliza para UTC preservando os microssegundos (Date só guarda milissegundos)
    const m = v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00').match(/^(.*?T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(.*)$/)
    const d = new Date(`${m[1]}${m[3]}`)
    return Number.isNaN(d.getTime()) ? v : `${d.toISOString().slice(0, 19)}.${(m[2] ?? '').padEnd(6, '0').slice(0, 6)}Z`
  }
  return v
}

// Devolve só números (nunca valores) para poder ir ao log público.
export function diffTables(original, restored) {
  const result = {}
  for (const t of TABLES) {
    const a = original?.tables?.[t] ?? []
    const b = restored?.tables?.[t] ?? []
    const pk = pkOf(t)
    const byKey = new Map(b.map((r) => [r[pk], JSON.stringify(canonical(r))]))
    let different = 0
    for (const r of a) if (byKey.get(r[pk]) !== JSON.stringify(canonical(r))) different++
    result[t] = { original: a.length, restored: b.length, different }
  }
  return result
}
export const diffOk = (d) => Object.values(d).every((x) => x.original === x.restored && x.different === 0)

// ---- nomes, datas e verificações do artifact ----
export function brasiliaDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
export const artifactNameFor = (date) => `backup-${date}`
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

export const parsePacketKeyIds = (text) => [...text.matchAll(/:pubkey enc packet:.*?keyid ([0-9A-Fa-f]+)/g)].map((m) => m[1].toUpperCase())
// Chaves (principal e subchaves) com capacidade de criptografar, a partir de `gpg --list-keys --with-colons`.
export function parseEncryptionKeyIds(text) {
  const ids = []
  for (const line of text.split('\n')) {
    const f = line.split(':')
    if ((f[0] === 'pub' || f[0] === 'sub') && /e/i.test(f[11] ?? '') && f[1] !== 'r' && f[1] !== 'e') ids.push(f[4].toUpperCase())
  }
  return ids
}

export function buildManifest({ date, generatedAt, fileName, fileBytes, recipients, counts }) {
  return {
    format: FORMAT,
    name: artifactNameFor(date),
    date,
    generated_at: generatedAt,
    file: fileName,
    sha256: sha256(fileBytes),
    size: fileBytes.length,
    recipients,
    counts,
    tables: TABLES,
  }
}

// Decide se um artifact encontrado conta como "backup válido do dia". Não confia no nome:
// confere conclusão do workflow, ramo, integridade do arquivo e para quem foi criptografado.
// Procedência: a chave pública é pública, então qualquer pessoa consegue criar um arquivo "criptografado para ela".
// Por isso só vale artifact vindo do NOSSO workflow, neste repositório (não de fork), disparado manualmente/agendado, na main.
export const BACKUP_WORKFLOW_PATH = '.github/workflows/backup.yml'
export function evaluateCandidate({ name, artifact, run, manifest, fileSha256, fileSize, expectedKeyIds, acceptRunId, repo }) {
  if (!artifact || artifact.expired) return 'expirado'
  if (!(artifact.size_in_bytes > 0)) return 'artifact-vazio'
  const isSelfTestRun = Boolean(acceptRunId) && run && String(run.id) === String(acceptRunId) // auto-teste: execução atual, no ramo do PR
  const runOk = run && (run.conclusion === 'success' || isSelfTestRun)
  if (!runOk) return 'execucao-nao-concluida-com-sucesso'
  if (!isSelfTestRun) {
    if (run.head_branch !== 'main') return 'ramo-diferente-de-main'
    if (run.event !== 'workflow_dispatch' && run.event !== 'schedule') return 'evento-nao-confiavel'
    if (!String(run.path ?? '').startsWith(`${BACKUP_WORKFLOW_PATH}@`) && run.path !== BACKUP_WORKFLOW_PATH) return 'workflow-diferente'
    if (!repo || run.head_repository?.full_name !== repo || run.repository?.full_name !== repo) return 'origem-fora-do-repositorio'
  }
  if (!isObj(manifest) || manifest.format !== FORMAT) return 'manifesto-invalido'
  if (manifest.name !== name) return 'manifesto-nome-diverge'
  if (manifest.file !== `${name}.json.gpg`) return 'manifesto-arquivo-diverge'
  if (manifest.sha256 !== fileSha256) return 'hash-diverge'
  if (manifest.size !== fileSize) return 'tamanho-diverge'
  if (!Array.isArray(manifest.recipients) || manifest.recipients.length === 0) return 'sem-destinatario'
  if (!manifest.recipients.every((k) => expectedKeyIds.includes(k))) return 'chave-diferente-da-configurada'
  if (!isObj(manifest.counts) || ESSENTIAL_NON_EMPTY.some((t) => !(manifest.counts[t] > 0))) return 'contagens-invalidas'
  return null
}

// Lê as seis tabelas essenciais com UMA consulta somente leitura (API de gerenciamento do Supabase).
// Uso: node scripts/backup/fetch.mjs <saida.json>
// Env: SUPABASE_BACKUP_TOKEN (secret, token de leitura restrito ao projeto), SUPABASE_PROJECT_REF.
// Nunca imprime dados, corpo de resposta ou token: só contagens.
import { writeFileSync } from 'node:fs'
import { buildBackupQuery, extractBackup } from './lib.mjs'

const out = process.argv[2]
const token = process.env.SUPABASE_BACKUP_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF
const die = (m) => { console.error(`::error::${m}`); process.exit(1) }
if (!out) die('uso: fetch.mjs <saida.json>')
if (!token) die('secret SUPABASE_BACKUP_TOKEN nao configurado')
if (!/^[a-z0-9]{20}$/.test(ref ?? '')) die('variavel SUPABASE_PROJECT_REF ausente ou invalida')

const url = `https://api.supabase.com/v1/projects/${ref}/database/query/read-only`
let lastStatus = 'sem resposta'
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildBackupQuery() }),
      signal: AbortSignal.timeout(90_000),
    })
    lastStatus = `HTTP ${res.status}`
    if (res.ok) {
      const doc = extractBackup(await res.json())
      writeFileSync(out, JSON.stringify(doc), { mode: 0o600 })
      console.log('consulta concluida; contagens:', JSON.stringify(doc.counts))
      process.exit(0)
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 429) break // erro de credencial/permissão: não adianta repetir
  } catch (e) {
    lastStatus = `falha de rede/leitura (${e?.name ?? 'erro'})`
  }
  await new Promise((r) => setTimeout(r, attempt * 5000))
}
die(`consulta ao Supabase falhou (${lastStatus})`)

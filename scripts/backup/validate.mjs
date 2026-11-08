// Valida o JSON do backup (estrutura, contagens, relacionamentos). Imprime só nomes de tabelas e números.
// Uso: node scripts/backup/validate.mjs <backup.json>
import { readFileSync } from 'node:fs'
import { validateBackup } from './lib.mjs'

let doc
try { doc = JSON.parse(readFileSync(process.argv[2], 'utf8')) } catch { console.error('::error::arquivo de backup nao e um JSON valido'); process.exit(1) }
const r = validateBackup(doc)
for (const w of r.warnings) console.log(`::warning::${w}`)
if (!r.ok) { for (const e of r.errors) console.error(`::error::${e}`); process.exit(1) }
console.log('backup valido; linhas por tabela:', JSON.stringify(r.counts))

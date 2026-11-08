// Compara o backup original com o banco restaurado. Imprime só contagens (nunca valores).
// Uso: node scripts/backup/compare.mjs <original.json> <restaurado.json>
import { readFileSync } from 'node:fs'
import { diffOk, diffTables } from './lib.mjs'

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')))
const d = diffTables(a, b)
for (const [t, x] of Object.entries(d)) console.log(`${t}: original=${x.original} restaurado=${x.restored} diferentes=${x.different}`)
if (!diffOk(d)) { console.error('::error::o banco restaurado nao e identico ao backup'); process.exit(1) }
console.log('restauracao identica ao backup')

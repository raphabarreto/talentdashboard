// Criptografa o backup com a chave PÚBLICA e gera o manifesto (só contagens e hash; nada de dados).
// Uso: node scripts/backup/seal.mjs <backup.json> <pasta-saida>
// Env: BACKUP_GPG_PUBLIC_KEY (chave pública ASCII), BACKUP_DATE (opcional, AAAA-MM-DD; padrão: hoje em Brasília)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gpg, listPackets, withPublicKeyring } from './gpg.mjs'
import { artifactNameFor, brasiliaDate, buildManifest, parsePacketKeyIds, validateBackup } from './lib.mjs'

const [input, outDir] = process.argv.slice(2)
const die = (m) => { console.error(`::error::${m}`); process.exit(1) }
if (!input || !outDir) die('uso: seal.mjs <backup.json> <pasta-saida>')

const doc = JSON.parse(readFileSync(input, 'utf8'))
const check = validateBackup(doc)
if (!check.ok) die('backup invalido; nada sera criptografado')

const date = process.env.BACKUP_DATE || brasiliaDate()
const name = artifactNameFor(date)
const fileName = `${name}.json.gpg`
mkdirSync(outDir, { recursive: true })

try {
  withPublicKeyring(process.env.BACKUP_GPG_PUBLIC_KEY, ({ home, fingerprint, keyIds }) => {
    const encrypted = gpg(['--yes', '--trust-model', 'always', '--recipient', fingerprint, '--encrypt', '--output', '-', input], home)
    if (encrypted.length < 100) throw new Error('arquivo criptografado suspeito (muito pequeno)')
    const packets = listPackets(home, encrypted)
    const recipients = [...new Set(parsePacketKeyIds(packets))]
    if (recipients.length === 0 || !recipients.every((k) => keyIds.includes(k))) throw new Error('destinatario do arquivo nao confere com a chave publica')
    writeFileSync(join(outDir, fileName), encrypted)
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(buildManifest({ date, generatedAt: doc.generated_at, fileName, fileBytes: encrypted, recipients, counts: check.counts }), null, 2))
  })
} catch (e) {
  die(`falha ao criptografar: ${e?.message?.slice(0, 120) ?? 'erro'}`)
}
const files = readdirSync(outDir).sort()
if (files.join() !== ['manifest.json', fileName].sort().join()) die('a pasta de saida deve conter somente o arquivo .gpg e o manifesto')
console.log(`arquivo criptografado: ${fileName}; contagens:`, JSON.stringify(check.counts))

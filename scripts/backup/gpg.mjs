// Auxiliares do GPG. Usa um chaveiro temporário só com a chave PÚBLICA (a privada nunca está no GitHub).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEncryptionKeyIds } from './lib.mjs'

// No Windows (Git Bash) o gpg espera caminhos no estilo /c/...; no Linux do GitHub nada muda.
const posix = (p) => (process.platform === 'win32' ? p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/') : p)

export function gpg(args, home, input) {
  return execFileSync('gpg', ['--batch', '--no-tty', '--homedir', posix(home), ...args], { input, stdio: ['pipe', 'pipe', 'pipe'] })
}

export function withPublicKeyring(armoredKey, fn) {
  if (armoredKey?.includes('PRIVATE KEY')) throw new Error('a chave configurada contem parte PRIVADA; use apenas a chave publica')
  if (!armoredKey || !armoredKey.includes('BEGIN PGP PUBLIC KEY BLOCK')) throw new Error('chave publica GPG ausente ou invalida')
  const home = mkdtempSync(join(tmpdir(), 'bkgpg-'))
  chmodSync(home, 0o700)
  try {
    gpg(['--import'], home, armoredKey)
    const colons = gpg(['--list-keys', '--with-colons'], home).toString()
    const fingerprint = colons.split('\n').find((l) => l.startsWith('fpr:'))?.split(':')[9]
    const keyIds = parseEncryptionKeyIds(colons)
    if (!fingerprint || keyIds.length === 0) throw new Error('a chave publica nao tem capacidade de criptografar')
    return fn({ home, fingerprint, keyIds })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

// `gpg --list-packets` sai com erro quando o chaveiro não tem a chave privada (é o nosso caso, de propósito),
// mas mesmo assim imprime os pacotes: lemos a saída padrão.
export function listPackets(home, bytes) {
  try {
    return gpg(['--list-packets'], home, bytes).toString()
  } catch (e) {
    if (e.stdout && e.stdout.length) return e.stdout.toString()
    throw e
  }
}

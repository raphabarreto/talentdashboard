// Auxiliar dos testes: roda um script com um arquivo de entrada defeituoso e devolve a saída (para checar vazamento).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function runWithBadInput(script, content) {
  const dir = mkdtempSync(join(tmpdir(), 'bktest-'))
  try {
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, content)
    const r = spawnSync('node', [script, bad, bad], { encoding: 'utf8' })
    return { status: r.status, output: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

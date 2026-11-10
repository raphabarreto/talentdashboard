// @ts-nocheck - usa APIs do Node (servidor simulado, processos); o projeto nao tem @types/node e o front nao importa este arquivo
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildManifest } from '../../scripts/backup/lib.mjs'
import { gpg } from '../../scripts/backup/gpg.mjs'

const run = promisify(execFile)
const REPO = 'dono/talentdashboard-backups'
const TOKEN = 'ghp_TOKEN_FALSO_PARA_TESTE_123'
const NAME = 'backup-2026-11-10'

type Asset = { id: number; name: string; bytes: Buffer }
type Rel = { id: number; tag_name: string; draft: boolean; immutable?: boolean; assets: Asset[] }
const mock = { releases: [] as Rel[], nextId: 1, isPrivate: true, canPush: true, corrupt: false, failUpload: false, calls: [] as string[] }
let server: Server
let base = ''

const view = (r: Rel) => ({ id: r.id, tag_name: r.tag_name, draft: r.draft, immutable: r.immutable, upload_url: `${base}/uploads/${r.id}/assets{?name,label}`, assets: r.assets.map((a) => ({ id: a.id, name: a.name, size: a.bytes.length })) })

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const url = new URL(req.url!, base)
      const p = url.pathname
      const json = (code: number, data: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
      mock.calls.push(`${req.method} ${p}`)
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, {})
      let m
      if (req.method === 'GET' && p === `/repos/${REPO}`) return json(200, { private: mock.isPrivate, permissions: { push: mock.canPush } })
      if (req.method === 'GET' && p === `/repos/${REPO}/releases`) return json(200, mock.releases.map(view))
      if (req.method === 'POST' && p === `/repos/${REPO}/releases`) {
        const d = JSON.parse(body.toString())
        const r: Rel = { id: mock.nextId++, tag_name: d.tag_name, draft: d.draft, assets: [] }
        mock.releases.push(r)
        return json(201, view(r))
      }
      if (req.method === 'POST' && (m = p.match(/^\/uploads\/(\d+)\/assets$/))) {
        if (mock.failUpload) return json(500, {})
        const r = mock.releases.find((x) => x.id === Number(m[1]))!
        const a: Asset = { id: mock.nextId++, name: url.searchParams.get('name')!, bytes: body }
        r.assets.push(a)
        return json(201, { id: a.id, name: a.name, size: body.length })
      }
      if (req.method === 'GET' && (m = p.match(/^\/repos\/.+\/releases\/assets\/(\d+)$/))) {
        const a = mock.releases.flatMap((r) => r.assets).find((x) => x.id === Number(m[1]))
        if (!a) return json(404, {})
        const out = Buffer.from(a.bytes)
        if (mock.corrupt) out[0] ^= 0xff
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        return res.end(out)
      }
      if (req.method === 'DELETE' && (m = p.match(/^\/repos\/.+\/releases\/(\d+)$/))) {
        mock.releases = mock.releases.filter((x) => x.id !== Number(m[1]))
        res.writeHead(204); return res.end()
      }
      if (req.method === 'PATCH' && (m = p.match(/^\/repos\/.+\/releases\/(\d+)$/))) {
        const r = mock.releases.find((x) => x.id === Number(m[1]))!
        r.draft = false; r.immutable = true
        return json(200, view(r))
      }
      json(404, {})
    })
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => { server.close() })
beforeEach(() => Object.assign(mock, { releases: [], nextId: 1, isPrivate: true, canPush: true, corrupt: false, failUpload: false, calls: [] }))

function makeOut(file: Buffer, over: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bkrel-'))
  const manifest = { ...buildManifest({ date: '2026-11-10', generatedAt: 'x', fileName: `${NAME}.json.gpg`, fileBytes: file, recipients: ['AAAA1111'], counts: { allowed_users: 1, streamers: 2 } }), ...over }
  writeFileSync(join(dir, `${NAME}.json.gpg`), file)
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  return dir
}
const env = (extra: Record<string, string> = {}) => ({ ...process.env, GITHUB_API_URL: base, BACKUPS_REPO: REPO, BACKUPS_REPO_TOKEN: TOKEN, GITHUB_RUN_ID: '777', ...extra })
async function publish(dir: string, extra: Record<string, string> = {}) {
  try {
    const r = await run('node', ['scripts/backup/publish-release.mjs', dir], { env: env(extra) })
    return { code: 0, out: `${r.stdout}${r.stderr}` }
  } catch (e) {
    const x = e as { code: number; stdout: string; stderr: string }
    return { code: x.code, out: `${x.stdout}${x.stderr}` }
  }
}
const file = Buffer.from('conteudo-criptografado-ficticio'.repeat(10))
const noWrites = () => mock.calls.filter((c) => c.startsWith('POST /repos') || c.startsWith('PATCH'))

describe('backup: publicação na Release privada', () => {
  it('cria rascunho, envia, confere o que o GitHub guardou e só então publica', async () => {
    const dir = makeOut(file)
    const r = await publish(dir)
    expect(r.code).toBe(0)
    expect(mock.releases).toHaveLength(1)
    const rel = mock.releases[0]
    expect(rel).toMatchObject({ tag_name: NAME, draft: false, immutable: true })
    expect(rel.assets.map((a) => a.name).sort()).toEqual([`${NAME}.json.gpg`, 'manifest.json'])
    expect(rel.assets.find((a) => a.name.endsWith('.gpg'))!.bytes.equals(file)).toBe(true)
    expect(r.out).not.toContain(TOKEN)
    // a publicação (PATCH) vem depois de todos os envios e conferências
    const iPatch = mock.calls.findIndex((c) => c.startsWith('PATCH'))
    expect(mock.calls.slice(iPatch).some((c) => c.startsWith('POST /uploads'))).toBe(false)
    expect(mock.calls.filter((c) => c.includes('/assets/')).length).toBeGreaterThanOrEqual(2)
    rmSync(dir, { recursive: true, force: true })
  })

  it('se o GitHub guardar algo diferente do enviado, não publica e apaga o rascunho', async () => {
    mock.corrupt = true
    const r = await publish(makeOut(file))
    expect(r.code).toBe(1)
    expect(r.out).toContain('nao confere')
    expect(mock.releases).toHaveLength(0)
    expect(mock.calls.some((c) => c.startsWith('PATCH'))).toBe(false)
  })

  it('falha no envio: apaga o rascunho e termina com erro', async () => {
    mock.failUpload = true
    const r = await publish(makeOut(file))
    expect(r.code).toBe(1)
    expect(mock.releases).toHaveLength(0)
  })

  it('arquivo local que não bate com o manifesto: nada é enviado', async () => {
    const r = await publish(makeOut(file, { sha256: 'ff'.repeat(32) }))
    expect(r.code).toBe(1)
    expect(mock.calls).toHaveLength(0)
  })

  it('recusa repositório não privado ou token sem escrita, sem criar nada', async () => {
    mock.isPrivate = false
    expect((await publish(makeOut(file))).code).toBe(1)
    mock.isPrivate = true; mock.canPush = false
    expect((await publish(makeOut(file))).code).toBe(1)
    expect(noWrites()).toHaveLength(0)
  })

  it('nova tentativa: rascunho de falha anterior é apagado e o backup é publicado', async () => {
    mock.releases.push({ id: 99, tag_name: NAME, draft: true, assets: [{ id: 98, name: 'velho', bytes: Buffer.from('x') }] })
    const r = await publish(makeOut(file))
    expect(r.code).toBe(0)
    expect(mock.releases).toHaveLength(1)
    expect(mock.releases[0]).toMatchObject({ tag_name: NAME, draft: false })
  })

  it('tag do dia já publicada (execução forçada): usa sufixo e não mexe na existente', async () => {
    mock.releases.push({ id: 50, tag_name: NAME, draft: false, immutable: true, assets: [] })
    const r = await publish(makeOut(file))
    expect(r.code).toBe(0)
    expect(mock.releases.map((x) => x.tag_name).sort()).toEqual([NAME, `${NAME}-r777`])
    expect(mock.releases.find((x) => x.id === 50)!.assets).toHaveLength(0)
  })

  it('token errado: falha sem expor o token', async () => {
    const r = await publish(makeOut(file), { BACKUPS_REPO_TOKEN: 'outro_token_secreto' })
    expect(r.code).toBe(1)
    expect(r.out).not.toContain('outro_token_secreto')
  })
})

// A checagem "já existe backup do dia" abre a chave pública com o gpg; sem gpg instalado, estes testes são pulados.
const hasGpg = (() => { try { execFileSync('gpg', ['--version'], { stdio: 'ignore' }); return true } catch { return false } })()
describe.skipIf(!hasGpg)('backup: checagem "já existe backup do dia" nas Releases', () => {
  let publicKey = ''
  let encrypted = Buffer.alloc(0)
  let keyIdHex = ''
  beforeAll(() => {
    const home = mkdtempSync(join(tmpdir(), 'bkgnupg-'))
    try {
      const g = (args: string[], input?: Buffer) => gpg(args, home, input) as Buffer
      g(['--passphrase', '', '--quick-generate-key', 'teste <t@example.test>', 'ed25519', 'cert', '1d'])
      const fpr = g(['--list-keys', '--with-colons']).toString().split('\n').find((l) => l.startsWith('fpr:'))!.split(':')[9]
      g(['--passphrase', '', '--quick-add-key', fpr, 'cv25519', 'encr', '1d'])
      publicKey = g(['--export', '--armor', fpr]).toString()
      encrypted = Buffer.from(g(['--yes', '--trust-model', 'always', '--recipient', fpr, '--encrypt', '--output', '-'], Buffer.from('conteudo ficticio '.repeat(20))))
      const sub = g(['--list-keys', '--with-colons']).toString().split('\n').find((l) => l.startsWith('sub:'))!
      keyIdHex = sub.split(':')[4].toUpperCase()
    } finally { rmSync(home, { recursive: true, force: true }) }
  })

  const check = async (over: { release?: Partial<Rel>; manifest?: Record<string, unknown>; bytes?: Buffer } = {}) => {
    const bytes = over.bytes ?? encrypted
    const manifest = { ...buildManifest({ date: '2026-11-10', generatedAt: 'x', fileName: `${NAME}.json.gpg`, fileBytes: encrypted, recipients: [keyIdHex], counts: { allowed_users: 1, streamers: 2 } }), ...over.manifest }
    mock.releases.push({ id: 1, tag_name: NAME, draft: false, immutable: true, assets: [{ id: 10, name: `${NAME}.json.gpg`, bytes }, { id: 11, name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) }], ...over.release })
    const out = join(mkdtempSync(join(tmpdir(), 'bkout-')), 'check.out')
    writeFileSync(out, '')
    await run('node', ['scripts/backup/check-existing.mjs'], { env: env({ BACKUP_NAME: NAME, BACKUP_GPG_PUBLIC_KEY: publicKey, CHECK_OUTPUT: out }) })
    return readFileSync(out, 'utf8').trim()
  }

  it('Release publicada e íntegra: já existe', async () => expect(await check()).toBe('exists=true'))
  it('sem Release do dia: não existe', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'bkout-')), 'c.out'); writeFileSync(out, '')
    await run('node', ['scripts/backup/check-existing.mjs'], { env: env({ BACKUP_NAME: NAME, BACKUP_GPG_PUBLIC_KEY: publicKey, CHECK_OUTPUT: out }) })
    expect(readFileSync(out, 'utf8').trim()).toBe('exists=false')
  })
  it('rascunho (tentativa que falhou) não conta como backup', async () => expect(await check({ release: { draft: true } })).toBe('exists=false'))
  it('Release não imutável não conta', async () => expect(await check({ release: { immutable: false } })).toBe('exists=false'))
  it('arquivo alterado (hash diferente do manifesto) não conta', async () => expect(await check({ bytes: Buffer.concat([encrypted, Buffer.from('x')]) })).toBe('exists=false'))
  it('criptografado para outra chave não conta', async () => expect(await check({ manifest: { recipients: ['FFFFFFFFFFFFFFFF'] } })).toBe('exists=false'))
  it('Release sem o manifesto não conta', async () => expect(await check({ release: { assets: [] } })).toBe('exists=false'))
})

describe('backup: nenhum artifact no repositório público', () => {
  it('nenhum workflow de backup publica artifacts (upload-artifact)', () => {
    const dir = '.github/workflows'
    for (const f of readdirSync(dir).filter((x) => x.startsWith('backup'))) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/^\s*(-\s*)?uses:\s*actions\/upload-artifact/m)
    }
  })
  it('o backup usa a publicação na Release e o GITHUB_TOKEN não ganha permissão de Actions', () => {
    const y = readFileSync('.github/workflows/backup.yml', 'utf8')
    expect(y).toContain('publish-release.mjs')
    expect(y).not.toMatch(/permissions:[^]*actions:\s*(read|write)/)
  })
})

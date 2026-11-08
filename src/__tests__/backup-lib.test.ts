import { describe, it, expect } from 'vitest'
import {
  TABLES, buildBackupQuery, extractBackup, extractBackupText, validateBackup, diffTables, diffOk, canonical,
  brasiliaDate, artifactNameFor, sha256, buildManifest, evaluateCandidate, parsePacketKeyIds, parseEncryptionKeyIds,
} from '../../scripts/backup/lib.mjs'
import { createFixture } from '../../scripts/backup/fixture.mjs'
import { runWithBadInput } from '../../scripts/backup/test-helpers.mjs'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

describe('backup: consulta', () => {
  it('é uma única instrução somente de leitura com as 6 tabelas e as contagens no mesmo retrato', () => {
    const q = buildBackupQuery()
    for (const t of TABLES) expect(q).toContain(`public.${t}`)
    expect(q.match(/;/g)).toBeNull() // uma instrução só
    expect(q.toLowerCase()).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|create)\b/)
    expect(q).toContain("'counts'")
  })
  it('stream_snapshots fica de fora', () => expect(buildBackupQuery()).not.toContain('stream_snapshots'))
  it('extrai o documento de resposta em lista, objeto ou texto', () => {
    const doc = { a: 1 }
    expect(extractBackup([{ backup: doc }])).toEqual(doc)
    expect(extractBackup({ backup: doc })).toEqual(doc)
    expect(extractBackup([{ backup: JSON.stringify(doc) }])).toEqual(doc)
  })
  it('erro de JSON não vaza trecho do conteúdo', () => {
    expect(() => extractBackup([{ backup: '{"segredo": ???' }])).toThrow(/nao e um JSON valido/)
    try { extractBackup([{ backup: '{"segredo": ???' }]) } catch (e) { expect(String(e)).not.toContain('segredo') }
  })
})

describe('backup: validação', () => {
  it('fixture fictícia é válida', () => {
    const r = validateBackup(createFixture())
    expect(r.ok).toBe(true)
    expect(r.counts.campaign_streamers).toBe(6)
  })
  it('alteração legítima durante a execução não gera falso alarme (contagens vêm do mesmo retrato)', () => {
    const d = createFixture()
    d.tables.streamers.push({ ...d.tables.streamers[0], id: '00000000-0000-4000-8000-0000000000ff', name: 'novo' })
    d.counts.streamers += 1 // o banco gerou documento coerente consigo mesmo
    expect(validateBackup(d).ok).toBe(true)
  })
  it('detecta contagem divergente, tabela essencial vazia e tabela ausente', () => {
    const a = createFixture(); a.counts.streamers = 99
    expect(validateBackup(a).errors.join()).toContain('streamers diverge')
    const b = createFixture(); b.tables.streamers = []; b.counts.streamers = 0
    expect(validateBackup(b).errors.join()).toContain('essencial streamers')
    const c = createFixture(); delete (c.tables as Record<string, unknown>).campaigns
    expect(validateBackup(c).ok).toBe(false)
  })
  it('tabelas não essenciais podem estar vazias (streamer_history vazia é normal)', () => {
    const d = createFixture(); d.tables.streamer_history = []; d.counts.streamer_history = 0
    expect(validateBackup(d).ok).toBe(true)
  })
  it('detecta referência solta, chave repetida e coluna faltando', () => {
    const a = createFixture(); a.tables.campaign_streamers[0].campaign_id = '00000000-0000-4000-8000-00000000dead'
    expect(validateBackup(a).errors.join()).toContain('sem correspondente')
    const b = createFixture(); b.tables.streamers[1].id = b.tables.streamers[0].id
    expect(validateBackup(b).errors.join()).toContain('repetida')
    const c = createFixture(); delete (c.tables.campaigns[0] as Record<string, unknown>).my_commission
    expect(validateBackup(c).errors.join()).toContain('sem colunas esperadas')
  })
  it('mensagens de erro nunca contêm valores do banco', () => {
    const d = createFixture()
    d.tables.campaign_streamers[0].campaign_id = 'ID-SECRETO-123'
    d.tables.streamers[0].name = 'NOME-SECRETO'
    d.tables.allowed_users[0].email = 'pessoa@segredo.test'
    delete (d.tables.campaigns[0] as Record<string, unknown>).company
    const all = JSON.stringify(validateBackup(d))
    for (const s of ['ID-SECRETO', 'NOME-SECRETO', 'segredo.test']) expect(all).not.toContain(s)
  })
})

describe('backup: comparação com o banco restaurado', () => {
  it('idêntico mesmo com fuso, escala de número e ordem de chaves diferentes', () => {
    const a = createFixture()
    const b = clone(a)
    b.tables.streamers[0].created_at = '2026-01-05T09:00:00-03:00' // mesmo instante
    b.tables.campaign_streamers[0].payment = 150.5 // 150.50 no banco
    b.tables.campaigns[0] = Object.fromEntries(Object.entries(b.tables.campaigns[0]).reverse()) as typeof b.tables.campaigns[0]
    expect(diffOk(diffTables(a, b))).toBe(true)
  })
  it('detecta valor alterado, linha perdida e coluna perdida (só números no resultado)', () => {
    const a = createFixture()
    const b = clone(a); b.tables.campaign_streamers[0].payment = 1
    expect(diffTables(a, b).campaign_streamers.different).toBe(1)
    const c = clone(a); c.tables.campaigns.pop()
    expect(diffOk(diffTables(a, c))).toBe(false)
    const d = clone(a); delete (d.tables.campaigns[0] as Record<string, unknown>).my_commission
    expect(diffTables(a, d).campaigns.different).toBe(1)
    expect(JSON.stringify(diffTables(a, b))).not.toContain('streamer_ficticio')
  })
  it('canonical normaliza timestamps com fuso', () => {
    expect(canonical('2026-01-05T09:00:00-03:00')).toBe('2026-01-05T12:00:00.000000Z')
    expect(canonical('2026-01-05T12:00:00.123456+00:00')).toBe('2026-01-05T12:00:00.123456Z')
    expect(canonical('2026-01-05T12:00:00.123456+00:00')).not.toBe(canonical('2026-01-05T12:00:00.123457+00:00'))
    expect(canonical('texto')).toBe('texto')
  })
})

describe('backup: datas e artifact do dia', () => {
  it('usa a data de Brasília (UTC-3)', () => {
    expect(brasiliaDate(new Date('2026-11-08T02:30:00Z'))).toBe('2026-11-07')
    expect(brasiliaDate(new Date('2026-11-08T09:00:00Z'))).toBe('2026-11-08')
    expect(brasiliaDate(new Date('2026-11-08T21:00:00Z'))).toBe('2026-11-08')
    expect(artifactNameFor('2026-11-08')).toBe('backup-2026-11-08')
  })

  const name = 'backup-2026-11-08'
  const bytes = new TextEncoder().encode('conteudo-criptografado-ficticio'.repeat(10))
  const manifest = buildManifest({ date: '2026-11-08', generatedAt: 'x', fileName: `${name}.json.gpg`, fileBytes: bytes, recipients: ['AAAA1111'], counts: { allowed_users: 1, streamers: 3 } })
  const base = () => ({
    name, artifact: { expired: false, size_in_bytes: 500 }, repo: 'dono/repo',
    run: { id: 1, conclusion: 'success', head_branch: 'main', event: 'workflow_dispatch', path: '.github/workflows/backup.yml@refs/heads/main', head_repository: { full_name: 'dono/repo' }, repository: { full_name: 'dono/repo' } } as Record<string, unknown>,
    manifest: clone(manifest), fileSha256: sha256(bytes), fileSize: bytes.length, expectedKeyIds: ['AAAA1111', 'BBBB2222'],
  })
  it('aceita artifact íntegro', () => expect(evaluateCandidate(base())).toBeNull())
  it('não confia só no nome: rejeita cada tipo de defeito', () => {
    const t = (mut: (b: ReturnType<typeof base>) => void) => { const b = base(); mut(b); return evaluateCandidate(b) }
    expect(t((b) => { b.artifact.expired = true })).toBe('expirado')
    expect(t((b) => { b.artifact.size_in_bytes = 0 })).toBe('artifact-vazio')
    expect(t((b) => { b.run.conclusion = 'failure' })).toBe('execucao-nao-concluida-com-sucesso')
    // falso positivo: a chave pública é pública; um terceiro consegue gerar um .gpg "válido" para ela
    expect(t((b) => { b.run.event = 'pull_request' })).toBe('evento-nao-confiavel')
    expect(t((b) => { b.run.path = '.github/workflows/outro.yml@refs/heads/main' })).toBe('workflow-diferente')
    expect(t((b) => { b.run.head_repository = { full_name: 'fork/repo' } })).toBe('origem-fora-do-repositorio')
    expect(t((b) => { b.repo = '' })).toBe('origem-fora-do-repositorio')
    expect(t((b) => { b.run.head_branch = 'outro' })).toBe('ramo-diferente-de-main')
    expect(t((b) => { b.fileSha256 = 'ff' })).toBe('hash-diverge')
    expect(t((b) => { b.fileSize += 1 })).toBe('tamanho-diverge')
    expect(t((b) => { b.manifest.name = 'backup-2000-01-01' })).toBe('manifesto-nome-diverge')
    expect(t((b) => { b.manifest.recipients = ['CCCC3333'] })).toBe('chave-diferente-da-configurada')
    expect(t((b) => { b.manifest.recipients = [] })).toBe('sem-destinatario')
    expect(t((b) => { b.manifest.counts.streamers = 0 })).toBe('contagens-invalidas')
  })
  it('execução em andamento só conta no auto-teste (ACCEPT_RUN_ID)', () => {
    const b = base(); b.run = { ...b.run, id: 7, conclusion: null, event: 'pull_request', head_branch: 'feat/x' }
    expect(evaluateCandidate(b)).toBe('execucao-nao-concluida-com-sucesso')
    expect(evaluateCandidate({ ...b, acceptRunId: '7' })).toBeNull()
  })
  it('manifesto não contém dados, só contagens e hash', () => {
    expect(Object.keys(manifest).sort()).toEqual(['counts', 'date', 'file', 'format', 'generated_at', 'name', 'recipients', 'sha256', 'size', 'tables'])
  })
})

describe('backup: leitura de saída do gpg', () => {
  it('extrai destinatários do arquivo e chaves de criptografia da chave pública', () => {
    expect(parsePacketKeyIds(':pubkey enc packet: version 3, algo 18, keyid 1a2b3c4d5e6f7788\n\tdata: ...')).toEqual(['1A2B3C4D5E6F7788'])
    const colons = ['pub:u:255:22:AAAAAAAAAAAAAAAA:1:::u:::scESC:::::ed25519:::0:', 'sub:u:255:18:BBBBBBBBBBBBBBBB:1::::::e:::::cv25519::', 'sub:r:255:18:CCCCCCCCCCCCCCCC:1::::::e:::::cv25519::'].join('\n')
    expect(parseEncryptionKeyIds(colons)).toEqual(['AAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBB'])
  })
})

describe('backup: precisão e vazamento em logs', () => {
  it('o texto devolvido pela API é gravado como veio (numeric sem arredondar)', () => {
    const exato = '{"counts":{},"tables":{"campaigns":[{"campaign_value":123456789012345.123456789012}]}}'
    expect(extractBackupText([{ backup: exato }])).toBe(exato)
    expect(JSON.stringify(JSON.parse(exato))).not.toBe(exato) // reserializar perderia casas decimais
    expect(buildBackupQuery().endsWith(')::text as backup')).toBe(true)
  })
  it('resposta sem texto do backup é rejeitada', () => {
    expect(() => extractBackupText([{ backup: { a: 1 } }])).toThrow()
    expect(() => extractBackupText([])).toThrow()
  })
  it('erro inesperado de JSON em script não imprime trecho do conteúdo (logs públicos)', () => {
    const r = runWithBadInput('scripts/backup/compare.mjs', 'bad pessoa@segredo.test comissao 12345 json')
    expect(r.status).toBe(1)
    expect(r.output).toContain('detalhes omitidos')
    for (const s of ['segredo.test', 'comissao', '12345']) expect(r.output).not.toContain(s)
  })
  it('fixture com casos de borda é válida e idêntica após ida e volta por JSON', () => {
    const d = createFixture()
    expect(validateBackup(d).ok).toBe(true)
    expect(diffOk(diffTables(d, JSON.parse(JSON.stringify(d))))).toBe(true)
    expect(JSON.stringify(d)).toContain('🎮')
  })
})

// Dados 100% fictícios, no mesmo formato do backup real. Usado nos testes e no auto-teste do CI.
// Uso: node scripts/backup/fixture.mjs <saida.json>
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { TABLES, FORMAT } from './lib.mjs'

const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TS = '2026-01-05T12:00:00+00:00'
// acentos, emoji, aspas duplas e simples, barra invertida e quebra de linha no mesmo texto
const TRICKY = 'Zé "Ñandú" 🎮 O\'Brien \\ barra\nlinha'

export function createFixture() {
  const streamers = [1, 2, 3].map((n) => ({
    id: u(n), name: `streamer_ficticio_${n}`, country: 'BR', avg_viewers: 100 * n, peak_viewers: 300 * n,
    hours_watched: 1000 * n, hours_streamed: 10 * n, game_name: 'Jogo Ficticio', created_at: TS,
    main_category: 'Variedades', last_live_at: n === 3 ? null : TS,
  }))
  // Casos de borda do banco real: acentos, emoji, aspas, barra invertida, quebra de linha, nulos e textos vazios
  streamers.push(
    { id: u(4), name: TRICKY, country: null, avg_viewers: 0, peak_viewers: 0, hours_watched: 0, hours_streamed: 0, game_name: null, created_at: TS, main_category: '', last_live_at: null },
    { id: u(5), name: 'ÁRVORE_Ficticia', country: '', avg_viewers: 2147483647, peak_viewers: 2147483647, hours_watched: 2147483647, hours_streamed: 0, game_name: '', created_at: '2026-03-01T00:00:00.123456+00:00', main_category: null, last_live_at: '2026-03-01T00:00:00.123456+00:00' },
  )
  const campaigns = [1, 2].map((n) => ({
    id: u(100 + n), company: `Empresa Ficticia ${n}`, start_date: '2026-01-01', end_date: '2026-01-31', created_at: TS,
    campaign_value: 1000.5 * n, currency: n === 1 ? 'BRL' : 'USD', my_commission: 200.25 * n,
    payment_date: n === 1 ? '2026-02-10' : null, total_received: n === 1 ? 1000.5 : null,
    commission_percentage: 20, original_amount_usd: n === 2 ? 2001 : null,
  }))
  const campaign_streamers = [
    [201, 101, 'streamer_ficticio_1', 150.5, 'confirmado'], [202, 101, 'streamer_ficticio_2', 99.99, 'contatado'],
    [203, 102, 'streamer_ficticio_1', 0, 'pendente'], [204, 102, 'streamer_ficticio_3', 300, 'recusado'], [205, 102, TRICKY, 0.01, 'nao_respondeu'], [206, 101, 'ÁRVORE_Ficticia', 99999999.99, 'confirmado'],
  ].map(([n, c, name, payment, status]) => ({ id: u(n), campaign_id: u(c), streamer_name: name, payment, payment_date: null, contact_status: status }))
  const prospect_shortlist = ['canal_a', 'canal_b'].map((l) => ({ user_login: l, data: { user_login: l, user_name: l, viewer_count: 5, tags: ['x', 'y'] }, created_at: TS }))
  prospect_shortlist.push({ user_login: 'canal_ünico', data: { emoji: '🎮', texto: "aspas ' \" e barra \\", nested: { a: [1, 2, { b: null }], vazio: {}, lista: [] }, n: 1.5, bool: false, nulo: null }, created_at: TS })
  const allowed_users = [{ email: 'admin@example.test' }, { email: 'Segundo.Usuario+tag@example.test' }]
  const streamer_history = [1, 2].map((n) => ({
    id: u(300 + n), streamer_id: u(n), month: '2025-12', avg_viewers: 90 * n, peak_viewers: 250 * n,
    hours_watched: 900 * n, hours_streamed: 9 * n, created_at: TS,
  }))
  const tables = { allowed_users, streamers, campaigns, campaign_streamers, prospect_shortlist, streamer_history }
  return {
    format: FORMAT, generated_at: TS, tables,
    counts: Object.fromEntries(TABLES.map((t) => [t, tables[t].length])),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2]
  if (!out) { console.error('uso: fixture.mjs <saida.json>'); process.exit(2) }
  // numeric sem limite de casas: o texto precisa atravessar o fluxo sem virar double
  const text = JSON.stringify(createFixture()).replace('"campaign_value":2001,', '"campaign_value":123456789012345.123456789012,')
  if (!text.includes('123456789012345.123456789012')) throw new Error('fixture: substituicao falhou')
  writeFileSync(out, text)
  console.log('fixture ficticia gerada')
}

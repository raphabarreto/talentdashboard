// Dados 100% fictícios, no mesmo formato do backup real. Usado nos testes e no auto-teste do CI.
// Uso: node scripts/backup/fixture.mjs <saida.json>
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { TABLES, FORMAT } from './lib.mjs'

const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TS = '2026-01-05T12:00:00+00:00'

export function createFixture() {
  const streamers = [1, 2, 3].map((n) => ({
    id: u(n), name: `streamer_ficticio_${n}`, country: 'BR', avg_viewers: 100 * n, peak_viewers: 300 * n,
    hours_watched: 1000 * n, hours_streamed: 10 * n, game_name: 'Jogo Ficticio', created_at: TS,
    main_category: 'Variedades', last_live_at: n === 3 ? null : TS,
  }))
  const campaigns = [1, 2].map((n) => ({
    id: u(100 + n), company: `Empresa Ficticia ${n}`, start_date: '2026-01-01', end_date: '2026-01-31', created_at: TS,
    campaign_value: 1000.5 * n, currency: n === 1 ? 'BRL' : 'USD', my_commission: 200.25 * n,
    payment_date: n === 1 ? '2026-02-10' : null, total_received: n === 1 ? 1000.5 : null,
    commission_percentage: 20, original_amount_usd: n === 2 ? 2001 : null,
  }))
  const campaign_streamers = [
    [201, 101, 'streamer_ficticio_1', 150.5, 'confirmado'], [202, 101, 'streamer_ficticio_2', 99.99, 'contatado'],
    [203, 102, 'streamer_ficticio_1', 0, 'pendente'], [204, 102, 'streamer_ficticio_3', 300, 'recusado'],
  ].map(([n, c, name, payment, status]) => ({ id: u(n), campaign_id: u(c), streamer_name: name, payment, payment_date: null, contact_status: status }))
  const prospect_shortlist = ['canal_a', 'canal_b'].map((l) => ({ user_login: l, data: { user_login: l, user_name: l, viewer_count: 5, tags: ['x', 'y'] }, created_at: TS }))
  const allowed_users = [{ email: 'admin@example.test' }]
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
  writeFileSync(out, JSON.stringify(createFixture()))
  console.log('fixture ficticia gerada')
}

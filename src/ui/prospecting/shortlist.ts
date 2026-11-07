import { showToast } from '../../utils'
import { getProspectShortlist, replaceProspectShortlist, addProspectRow } from '../../lib/data'
import type { ProspectStream } from './types'

// Monta um item da Minha Lista a partir do resultado do "Consultar na Twitch" (o canal pode estar offline).
export function prospectFromLookup(user: { login: string; display_name: string; broadcaster_language?: string; game_name?: string }): ProspectStream {
  return {
    user_login: user.login.toLowerCase(),
    user_name: user.display_name,
    viewer_count: 0,
    game_name: user.game_name || '',
    email: null,
    description: '',
    language: (user.broadcaster_language || '').split('-')[0],
  }
}

export function isInShortlist(login: string) {
  const l = login.toLowerCase()
  return shortlist.some(s => s.user_login.toLowerCase() === l)
}

// Acrescenta um item: grava só ele no banco (não regrava a lista inteira, então não apaga nada).
export async function addToShortlist(item: ProspectStream): Promise<'added' | 'exists'> {
  if (isInShortlist(item.user_login)) return 'exists'
  const entry = { ...item, added_at: new Date().toISOString() }
  await addProspectRow({ user_login: entry.user_login, data: { ...entry } })
  shortlist.push(entry)
  localStorage.setItem('prospectShortlist', JSON.stringify(shortlist))
  return 'added'
}

// Lista salva da Prospecção. Importadores leem `shortlist` (binding vivo) e alteram via setShortlist/push.
export let shortlist: ProspectStream[] = JSON.parse(localStorage.getItem('prospectShortlist') || '[]')

export function setShortlist(list: ProspectStream[]) { shortlist = list }

// Salva no banco (fonte principal) e no navegador (reserva se o banco falhar).
export function saveShortlist() {
  const base = Date.now()
  shortlist.forEach((s, i) => { if (!s.added_at) s.added_at = new Date(base + i).toISOString() })
  localStorage.setItem('prospectShortlist', JSON.stringify(shortlist))
  replaceProspectShortlist(shortlist.map(s => ({ user_login: s.user_login, data: { ...s } })))
    .catch(() => showToast('Não foi possível salvar a lista no servidor (salva só neste navegador)'))
}

// Carrega a lista do banco. Se o banco estiver vazio, envia a lista que já existia no navegador.
export async function loadShortlistFromDb(onLoaded: () => void) {
  try {
    const rows = await getProspectShortlist()
    if (rows.length) {
      shortlist = rows.map(r => r.data as unknown as ProspectStream)
        .sort((a, b) => (a.added_at || '').localeCompare(b.added_at || ''))
      localStorage.setItem('prospectShortlist', JSON.stringify(shortlist))
    } else if (shortlist.length) {
      saveShortlist()
    }
    onLoaded()
  } catch { /* sem banco: segue com a lista do navegador */ }
}

// Texto agrupado por país para copiar e colar.
export function formatShortlistForCopy(list: ProspectStream[]): string {
  const line = (r: ProspectStream) => `• ${r.user_name} — https://www.twitch.tv/${r.user_login}`
  const lang = (r: ProspectStream) => (r.language || '').toLowerCase().split('-')[0]
  const br = list.filter(r => lang(r) === 'pt')
  const es = list.filter(r => lang(r) === 'es')
  const other = list.filter(r => lang(r) !== 'pt' && lang(r) !== 'es')
  let out = ''
  if (br.length) out += `🇧🇷 Brazil\n${br.map(line).join('\n')}\n\n`
  if (es.length) out += `🇪🇸 Spain\n${es.map(line).join('\n')}\n\n`
  if (other.length) out += `🌐 Others\n${other.map(line).join('\n')}\n`
  return out.trim()
}


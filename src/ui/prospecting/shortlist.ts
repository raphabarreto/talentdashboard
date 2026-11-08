import { showToast } from '../../utils'
import { getProspectShortlist, addProspectRow, addProspectRows, deleteProspectRow, clearProspectShortlist } from '../../lib/data'
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
  writeLocal()
  return 'added'
}

// O navegador pode bloquear o armazenamento local (janela privada, dados do site bloqueados): nunca derruba o app.
const LOCAL_KEY = 'prospectShortlist'
function readLocal(): ProspectStream[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}
function writeLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(shortlist)) } catch { /* sem armazenamento local: segue só com o banco */ }
}

// Lista salva da Prospecção. Importadores leem `shortlist` (binding vivo) e alteram via setShortlist/push.
export let shortlist: ProspectStream[] = readLocal()

export function setShortlist(list: ProspectStream[]) { shortlist = list }

// Mudanças feitas enquanto a lista ainda está sendo carregada do banco (para não serem perdidas ao chegar).
let loading = false
const addedWhileLoading = new Map<string, ProspectStream>()
const removedWhileLoading = new Set<string>()

function warnServerFailure() { showToast('Não foi possível salvar a lista no servidor (salva só neste navegador)', 'error') }

// Itens acrescentados à lista (já estão em `shortlist`): grava só eles no banco, sem tocar nos demais.
export function persistAdded(items: ProspectStream[]) {
  const base = Date.now()
  items.forEach((s, i) => { if (!s.added_at) s.added_at = new Date(base + i).toISOString() })
  if (loading) items.forEach(s => { addedWhileLoading.set(s.user_login, s); removedWhileLoading.delete(s.user_login) })
  writeLocal()
  addProspectRows(items.map(s => ({ user_login: s.user_login, data: { ...s } }))).catch(warnServerFailure)
}

// Um item removido da lista: apaga só ele do banco.
export function persistRemoved(login: string) {
  if (loading) { removedWhileLoading.add(login); addedWhileLoading.delete(login) }
  writeLocal()
  deleteProspectRow(login).catch(warnServerFailure)
}

// Lista esvaziada pelo usuário (depois da confirmação).
export function persistCleared() {
  if (loading) addedWhileLoading.clear()
  writeLocal()
  clearProspectShortlist().catch(warnServerFailure)
}

// Carrega a lista do banco (fonte principal). Se o banco estiver vazio, envia a lista que já existia no navegador.
export async function loadShortlistFromDb(onLoaded: () => void) {
  loading = true
  try {
    const rows = await getProspectShortlist()
    if (rows.length) {
      const fromDb = rows.map(r => r.data as unknown as ProspectStream).filter(s => !removedWhileLoading.has(s.user_login))
      const known = new Set(fromDb.map(s => s.user_login))
      const extra = [...addedWhileLoading.values()].filter(s => !known.has(s.user_login))
      shortlist = [...fromDb, ...extra].sort((a, b) => (a.added_at || '').localeCompare(b.added_at || ''))
      writeLocal()
    } else if (shortlist.length) {
      persistAdded(shortlist) // primeira vez com banco vazio: só acrescenta, nunca apaga
    }
    onLoaded()
  } catch { /* sem banco: segue com a lista do navegador */ }
  finally { loading = false; addedWhileLoading.clear(); removedWhileLoading.clear() }
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


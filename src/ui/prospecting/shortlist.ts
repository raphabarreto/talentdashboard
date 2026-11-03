import { showToast } from '../../utils'
import { getProspectShortlist, replaceProspectShortlist } from '../../lib/data'
import type { ProspectStream } from './types'

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
  const br = list.filter(r => r.language === 'pt')
  const es = list.filter(r => r.language === 'es')
  const other = list.filter(r => r.language !== 'pt' && r.language !== 'es')
  let out = ''
  if (br.length) out += `🇧🇷 Brazil\n${br.map(line).join('\n')}\n\n`
  if (es.length) out += `🇪🇸 Spain\n${es.map(line).join('\n')}\n\n`
  if (other.length) out += `🌐 Others\n${other.map(line).join('\n')}\n`
  return out.trim()
}

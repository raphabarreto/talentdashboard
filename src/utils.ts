import type { Streamer } from './types'

export const langToCountry: Record<string, string> = {
  pt: 'br', en: 'us', es: 'es', fr: 'fr', de: 'de', it: 'it', ja: 'jp', ko: 'kr', ru: 'ru', zh: 'cn', pl: 'pl', nl: 'nl', sv: 'se'
}

export const countryNames: Record<string, string> = {
  us: 'Estados Unidos', br: 'Brasil', ca: 'Canadá', de: 'Alemanha', fr: 'França', gb: 'Reino Unido', es: 'Espanha', jp: 'Japão',
  kr: 'Coreia do Sul', mx: 'México', ar: 'Argentina', it: 'Itália', au: 'Austrália', in: 'Índia', ru: 'Rússia', cn: 'China',
  se: 'Suécia', pl: 'Polônia', nl: 'Holanda', pt: 'Portugal'
}

export const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export const fmt = (n: number) => n.toLocaleString('pt-BR')
export const fmtCurrency = (n: number) => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
export const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

export function isActive(s: Streamer): boolean {
  if (!s.last_live_at) return false
  return Date.now() - new Date(s.last_live_at).getTime() < 15 * 24 * 60 * 60 * 1000
}

export function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const toast = document.getElementById('toast')!
  const toastMsg = document.getElementById('toast-message')!
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`
  toastMsg.textContent = msg
  toast.classList.remove('translate-y-[200%]')
  toast.classList.add('translate-y-0')
  setTimeout(() => { toast.classList.remove('translate-y-0'); toast.classList.add('translate-y-[200%]') }, 3000)
}

export function confirmAction(text: string, btnText = 'Remover'): Promise<boolean> {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal')!
    document.getElementById('confirmText')!.textContent = text
    document.getElementById('confirmYes')!.textContent = btnText
    modal.classList.remove('hidden')
    const yes = document.getElementById('confirmYes')!
    const no = document.getElementById('confirmNo')!
    const cleanup = () => { modal.classList.add('hidden'); yes.replaceWith(yes.cloneNode(true)); no.replaceWith(no.cloneNode(true)) }
    document.getElementById('confirmYes')!.addEventListener('click', () => { cleanup(); resolve(true) }, { once: true })
    document.getElementById('confirmNo')!.addEventListener('click', () => { cleanup(); resolve(false) }, { once: true })
  })
}

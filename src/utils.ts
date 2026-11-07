import type { Streamer } from './types/index'
import { ACTIVE_STREAMER_DAYS } from './constants'

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

// Remove qualquer caractere que não seja dígito, ponto (milhar) ou vírgula (decimal),
// mantendo apenas uma vírgula decimal. Usado para bloquear letras/símbolos em campos de valor.
export function sanitizeCurrencyInput(value: string): string {
  let sanitized = value.replace(/[^0-9.,]/g, '')
  const firstComma = sanitized.indexOf(',')
  if (firstComma !== -1) {
    sanitized = sanitized.slice(0, firstComma + 1) + sanitized.slice(firstComma + 1).replace(/,/g, '')
  }
  return sanitized
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeout: number
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }) as T
}

export function isActive(s: Streamer): boolean {
  if (!s.last_live_at) return false
  return Date.now() - new Date(s.last_live_at).getTime() < ACTIVE_STREAMER_DAYS * 24 * 60 * 60 * 1000
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

export interface ConfirmOptions {
  title?: string // pergunta curta; sem ela, usa "Tem certeza?"
  danger?: boolean // vermelho + ícone de lixeira (padrão); false = ação neutra (ex.: Sair)
}

// Janela de confirmação única do sistema. Resolve true só ao clicar no botão de ação; Cancelar, Esc e
// clique fora resolvem false. Foco começa em "Cancelar" (ação segura) e fica preso na janela; ao fechar, volta
// para onde estava. Textos entram por textContent (nomes de streamers/campanhas nunca viram HTML).
export function confirmAction(text: string, btnText = 'Remover', options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    const { title = 'Tem certeza?', danger = true } = options
    const modal = document.getElementById('confirmModal')!
    const yes = document.getElementById('confirmYes') as HTMLButtonElement
    const no = document.getElementById('confirmNo') as HTMLButtonElement
    const icon = document.getElementById('confirmIcon')!
    document.getElementById('confirmTitle')!.textContent = title
    document.getElementById('confirmText')!.textContent = text
    yes.textContent = btnText
    icon.classList.toggle('hidden', !danger)
    yes.classList.toggle('bg-red-600', danger)
    yes.classList.toggle('hover:bg-red-700', danger)
    yes.classList.toggle('bg-indigo-600', !danger)
    yes.classList.toggle('hover:bg-indigo-700', !danger)
    const previousFocus = document.activeElement as HTMLElement | null
    modal.classList.remove('hidden')
    no.focus()

    const finish = (answer: boolean) => {
      modal.classList.add('hidden')
      yes.removeEventListener('click', onYes)
      no.removeEventListener('click', onNo)
      modal.removeEventListener('click', onBackdrop)
      document.removeEventListener('keydown', onKey, true)
      previousFocus?.focus?.()
      resolve(answer)
    }
    const onYes = () => finish(true)
    const onNo = () => finish(false)
    const onBackdrop = (e: MouseEvent) => { if (e.target === modal) finish(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); return }
      if (e.key === 'Tab') { // foco preso entre os dois botões
        e.preventDefault()
        ;(document.activeElement === no ? yes : no).focus()
      }
    }
    yes.addEventListener('click', onYes)
    no.addEventListener('click', onNo)
    modal.addEventListener('click', onBackdrop)
    document.addEventListener('keydown', onKey, true)
  })
}

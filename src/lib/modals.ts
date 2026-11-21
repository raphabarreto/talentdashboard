import { confirmAction, showToast } from '../utils'

// Acessibilidade e Esc seguro dos modais (.modal). Funciona observando a classe "hidden", então não
// depende de cada tela abrir/fechar do seu jeito. A janela de confirmação (#confirmModal) cuida de si mesma.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
// Modais em que descartar o que foi digitado merece confirmação.
const GUARD_UNSAVED = ['campaignModal', 'addMultipleModal']
// Botões que ficam desativados enquanto algo está sendo gravado: Esc não fecha a janela nesse momento.
const BUSY_BUTTONS = ['saveMultipleBtn', 'saveCampaignBtn', 'saveAndAddAnotherBtn', 'lookupAddBtn']

type Opened = { prevFocus: HTMLElement | null; snapshot: string }
const opened = new WeakMap<HTMLElement, Opened>()

const allModals = () => [...document.querySelectorAll<HTMLElement>('.modal')].filter(m => m.id !== 'confirmModal')
const isOpen = (m: HTMLElement) => !m.classList.contains('hidden')
export const openModals = () => allModals().filter(isOpen)

export function snapshotModal(modal: HTMLElement): string {
  return [...modal.querySelectorAll<HTMLInputElement>('input, textarea, select')]
    .map(el => `${el.id || el.name}=${el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value}`)
    .join('|')
}

export function isModalBusy(modal: HTMLElement): boolean {
  return BUSY_BUTTONS.some(id => (modal.querySelector(`#${id}`) as HTMLButtonElement | null)?.disabled === true)
}

export function isModalDirty(modal: HTMLElement): boolean {
  const info = opened.get(modal)
  return !!info && GUARD_UNSAVED.includes(modal.id) && snapshotModal(modal) !== info.snapshot
}

function focusables(modal: HTMLElement): HTMLElement[] {
  return [...modal.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
}

function onShown(modal: HTMLElement) {
  const prev = document.activeElement as HTMLElement | null
  opened.set(modal, { prevFocus: prev && !modal.contains(prev) ? prev : null, snapshot: snapshotModal(modal) })
  const first = focusables(modal).find(el => !el.matches('button')) ?? focusables(modal)[0]
  first?.focus()
}

function onHidden(modal: HTMLElement) {
  const info = opened.get(modal)
  opened.delete(modal)
  const active = document.activeElement
  if (info?.prevFocus && info.prevFocus.isConnected && (!active || active === document.body || modal.contains(active))) info.prevFocus.focus()
}

// Esc fecha só a janela de cima; não fecha durante gravação; pede confirmação se há texto não salvo.
export async function handleEscape(): Promise<void> {
  const top = openModals().at(-1)
  if (!top) return
  if (isModalBusy(top)) { showToast('Aguarde o salvamento terminar.', 'error'); return }
  if (isModalDirty(top) && !(await confirmAction('O que você digitou nesta janela não foi salvo.', 'Descartar', { title: 'Descartar alterações?' }))) return
  top.classList.add('hidden')
}

function trapTab(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !document.getElementById('confirmModal')?.classList.contains('hidden')) return
  const top = openModals().at(-1)
  if (!top) return
  const items = focusables(top)
  if (!items.length) { e.preventDefault(); return }
  const first = items[0], last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (!active || !top.contains(active)) { e.preventDefault(); first.focus() }
  else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
}

export function setupModals() {
  allModals().forEach(modal => {
    const box = modal.firstElementChild as HTMLElement | null
    if (box && !box.hasAttribute('role')) {
      box.setAttribute('role', 'dialog')
      box.setAttribute('aria-modal', 'true')
      const title = box.querySelector<HTMLElement>('h3')
      if (title) {
        if (!title.id) title.id = `${modal.id}Title`
        box.setAttribute('aria-labelledby', title.id)
      }
    }
    let wasOpen = isOpen(modal)
    new MutationObserver(() => {
      const now = isOpen(modal)
      if (now === wasOpen) return
      wasOpen = now
      now ? onShown(modal) : onHidden(modal)
    }).observe(modal, { attributes: true, attributeFilter: ['class'] })
  })
  document.addEventListener('keydown', trapTab)
}

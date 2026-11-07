import { describe, it, expect, beforeEach } from 'vitest'
import { confirmAction } from '../utils'

function mountModal() {
  document.body.innerHTML = `
    <button id="opener">abrir</button>
    <div id="confirmModal" class="modal hidden">
      <div role="alertdialog">
        <div id="confirmIcon"></div><h2 id="confirmTitle"></h2><p id="confirmText"></p>
        <button id="confirmNo">Cancelar</button><button id="confirmYes" class="bg-red-600">Remover</button>
      </div>
    </div>`
}
const modal = () => document.getElementById('confirmModal')!
const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

describe('confirmAction', () => {
  beforeEach(mountModal)

  it('mostra título, mensagem e botão, e começa com foco em Cancelar', () => {
    void confirmAction('Tem certeza de que deseja remover Ana da sua lista?', 'Remover', { title: 'Remover streamer?' })
    expect(modal().classList.contains('hidden')).toBe(false)
    expect(document.getElementById('confirmTitle')!.textContent).toBe('Remover streamer?')
    expect(document.getElementById('confirmText')!.textContent).toContain('Ana')
    expect(document.activeElement?.id).toBe('confirmNo')
  })

  it('confirma só ao clicar no botão de ação', async () => {
    const p = confirmAction('x')
    document.getElementById('confirmYes')!.click()
    expect(await p).toBe(true)
    expect(modal().classList.contains('hidden')).toBe(true)
  })

  it('Cancelar, Esc e clique fora resolvem false', async () => {
    let p = confirmAction('x'); document.getElementById('confirmNo')!.click(); expect(await p).toBe(false)
    p = confirmAction('x'); key('Escape'); expect(await p).toBe(false)
    p = confirmAction('x'); modal().click(); expect(await p).toBe(false)
  })

  it('clique dentro da janela não cancela', async () => {
    const p = confirmAction('x')
    document.getElementById('confirmTitle')!.click()
    expect(modal().classList.contains('hidden')).toBe(false)
    document.getElementById('confirmNo')!.click()
    expect(await p).toBe(false)
  })

  it('nomes entram como texto, nunca como HTML', () => {
    void confirmAction('<img src=x onerror=alert(1)>')
    expect(document.getElementById('confirmText')!.querySelector('img')).toBeNull()
  })

  it('devolve o foco a quem abriu e não acumula ouvintes entre usos', async () => {
    const opener = document.getElementById('opener') as HTMLButtonElement
    opener.focus()
    let p = confirmAction('x'); key('Escape'); await p
    expect(document.activeElement).toBe(opener)
    p = confirmAction('x'); document.getElementById('confirmYes')!.click(); expect(await p).toBe(true)
  })

  it('ação neutra (danger:false) não usa vermelho', () => {
    void confirmAction('x', 'Sair', { title: 'Deseja sair?', danger: false })
    expect(document.getElementById('confirmYes')!.classList.contains('bg-red-600')).toBe(false)
    expect(document.getElementById('confirmIcon')!.classList.contains('hidden')).toBe(true)
  })
})

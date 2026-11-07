import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/auth', () => ({ signOut: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { placeLookupBar } from '../events/navigation'

beforeEach(() => {
  document.body.innerHTML = `
    <button class="nav-link" data-view="overview"></button>
    <button class="nav-link border-indigo-500" data-view="prospecting"></button>
    <div id="lookupSlot-overview"><div id="lookupBar"></div></div>
    <div id="lookupSlot-campaigns"></div>
    <div id="lookupSlot-prospecting"></div>`
})

const parentOfBar = () => document.getElementById('lookupBar')!.parentElement!.id

describe('campo "Consultar Twitch" acompanha a aba', () => {
  it('vai para o espaço da aba indicada', () => {
    placeLookupBar('campaigns')
    expect(parentOfBar()).toBe('lookupSlot-campaigns')
  })

  it('sem argumento, usa a aba marcada no menu', () => {
    placeLookupBar()
    expect(parentOfBar()).toBe('lookupSlot-prospecting')
  })

  it('aba sem espaço: o campo fica onde está', () => {
    placeLookupBar('inexistente')
    expect(parentOfBar()).toBe('lookupSlot-overview')
  })
})

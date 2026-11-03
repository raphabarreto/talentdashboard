import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { auth: {} } }))

import { isEmailAllowed } from '../auth'

describe('isEmailAllowed', () => {
  const list = ['a@x.com', 'b@x.com']
  it('aceita e-mail da lista', () => expect(isEmailAllowed('a@x.com', list)).toBe(true))
  it('rejeita e-mail fora da lista', () => expect(isEmailAllowed('z@x.com', list)).toBe(false))
  it('rejeita vazio/indefinido', () => {
    expect(isEmailAllowed('', [''])).toBe(false)
    expect(isEmailAllowed(undefined, list)).toBe(false)
  })
})

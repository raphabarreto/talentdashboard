import { describe, it, expect } from 'vitest'
import { getReferenceDate } from '../ui/campaigns'

describe('getReferenceDate', () => {
  it('deve usar payment_date quando a campanha já foi paga', () => {
    const campaign = { start_date: '2026-04-01', payment_date: '2026-07-23' }
    expect(getReferenceDate(campaign)).toBe('2026-07-23')
  })

  it('deve usar start_date como fallback quando não há payment_date', () => {
    const campaign = { start_date: '2026-04-01', payment_date: null }
    expect(getReferenceDate(campaign)).toBe('2026-04-01')
  })

  it('deve retornar null quando não há nenhuma data', () => {
    const campaign = { start_date: '', payment_date: null }
    expect(getReferenceDate(campaign)).toBeNull()
  })
})

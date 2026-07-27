import { describe, it, expect } from 'vitest'
import { campaignSchema } from '../lib/validators'

// my_commission é um valor preenchido manualmente pelo usuário
// (não é calculado a partir de outros campos, e total_paid não existe mais).
describe('my_commission (valor manual)', () => {
  it('deve aceitar my_commission informado manualmente', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      my_commission: 1500,
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(true)
  })

  it('deve permitir my_commission independente do total_received', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 600,
      my_commission: 250, // valor manual, não precisa ter relação matemática com total_received
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(true)
    expect(result.data?.my_commission).toBe(250)
  })

  it('deve usar 0 como default quando my_commission não é informado', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(true)
    expect(result.data?.my_commission).toBe(0)
  })

  it('deve rejeitar my_commission negativo', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      my_commission: -100,
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(false)
  })
})

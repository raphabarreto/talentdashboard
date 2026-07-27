import { describe, it, expect } from 'vitest'
import { campaignSchema } from '../lib/validators'

// my_commission agora é um valor preenchido manualmente pelo usuário,
// não é mais calculado automaticamente (total_received - total_paid) nem via 80/20.
describe('my_commission (valor manual)', () => {
  it('deve aceitar my_commission informado manualmente', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      total_paid: 7200,
      my_commission: 1500,
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(true)
  })

  it('deve permitir my_commission independente da diferença entre total_received e total_paid', () => {
    const campaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 600,
      total_paid: 500,
      my_commission: 250, // valor manual, não precisa ser 600 - 500
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
      total_paid: 7200,
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
      total_paid: 7200,
      my_commission: -100,
      currency: 'BRL' as const,
      payment_date: null,
    }

    const result = campaignSchema.safeParse(campaign)
    expect(result.success).toBe(false)
  })
})

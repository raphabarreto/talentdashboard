import { describe, it, expect } from 'vitest'
import { campaignSchema, streamerSchema } from '../validators'

describe('Campaign Validation', () => {
  it('should validate correct campaign data', () => {
    const validCampaign = {
      company: 'OperaGX',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      total_paid: 7200,
      currency: 'BRL' as const,
      payment_date: null,
    }
    
    const result = campaignSchema.safeParse(validCampaign)
    expect(result.success).toBe(true)
  })

  it('should reject campaign with empty company', () => {
    const invalidCampaign = {
      company: '',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: 9000,
      total_paid: 7200,
      currency: 'BRL' as const,
      payment_date: null,
    }
    
    const result = campaignSchema.safeParse(invalidCampaign)
    expect(result.success).toBe(false)
  })

  it('should reject end_date before start_date', () => {
    const invalidCampaign = {
      company: 'Test',
      start_date: '2026-06-30',
      end_date: '2026-06-01',
      total_received: 9000,
      total_paid: 7200,
      currency: 'BRL' as const,
      payment_date: null,
    }
    
    const result = campaignSchema.safeParse(invalidCampaign)
    expect(result.success).toBe(false)
  })

  it('should reject negative amounts', () => {
    const invalidCampaign = {
      company: 'Test',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      total_received: -100,
      total_paid: 7200,
      currency: 'BRL' as const,
      payment_date: null,
    }
    
    const result = campaignSchema.safeParse(invalidCampaign)
    expect(result.success).toBe(false)
  })
})

describe('Streamer Validation', () => {
  it('should validate correct streamer data', () => {
    const validStreamer = {
      name: 'gaules',
      country: 'BR',
      avg_viewers: 50000,
      peak_viewers: 100000,
      hours_watched: 1000000,
      hours_streamed: 200,
    }
    
    const result = streamerSchema.safeParse(validStreamer)
    expect(result.success).toBe(true)
  })

  it('should reject streamer with empty name', () => {
    const invalidStreamer = {
      name: '',
      country: 'BR',
    }
    
    const result = streamerSchema.safeParse(invalidStreamer)
    expect(result.success).toBe(false)
  })
})

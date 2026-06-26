import { describe, it, expect } from 'vitest'

// Helper functions para testar
function calculateCommission(totalReceived: number, totalPaid: number): number {
  return totalReceived - totalPaid
}

function calculate80Percent(total: number): number {
  return Math.round(total * 0.8 * 100) / 100
}

describe('Commission Calculations', () => {
  it('should calculate commission correctly', () => {
    const totalReceived = 9000
    const totalPaid = 7200
    const commission = calculateCommission(totalReceived, totalPaid)
    
    expect(commission).toBe(1800)
  })

  it('should calculate 80% for streamers correctly', () => {
    const totalReceived = 9000
    const streamersPart = calculate80Percent(totalReceived)
    
    expect(streamersPart).toBe(7200)
  })

  it('should handle zero values', () => {
    const commission = calculateCommission(0, 0)
    expect(commission).toBe(0)
  })

  it('should handle cases where total_paid is zero', () => {
    const totalReceived = 5000
    const commission = calculateCommission(totalReceived, 0)
    
    expect(commission).toBe(5000)
  })

  it('should calculate correctly for USD campaigns', () => {
    const totalReceived = 1000 // USD
    const totalPaid = 800
    const commission = calculateCommission(totalReceived, totalPaid)
    
    expect(commission).toBe(200)
  })

  it('should round 80% calculation correctly', () => {
    const total = 1000
    const streamersPart = calculate80Percent(total)
    
    expect(streamersPart).toBe(800)
  })

  it('should handle decimal values', () => {
    const totalReceived = 9500.50
    const totalPaid = 7600.40
    const commission = calculateCommission(totalReceived, totalPaid)
    
    expect(commission).toBeCloseTo(1900.10, 2)
  })
})

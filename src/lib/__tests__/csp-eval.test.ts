import { describe, it, expect, vi } from 'vitest'
import { streamerSchema } from '../validators'

// A CSP sem 'unsafe-eval' registra violacao se algo chamar new Function().
describe('Zod sem eval', () => {
  it('valida dados sem chamar new Function()', () => {
    const spy = vi.spyOn(globalThis, 'Function').mockImplementation((() => {
      throw new Error('eval proibido')
    }) as unknown as FunctionConstructor)
    try {
      const r = streamerSchema.safeParse({ name: 'ana', country: 'br', avg_viewers: 1, peak_viewers: 2 })
      expect(r.success).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

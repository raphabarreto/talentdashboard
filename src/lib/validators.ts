import { z } from 'zod'

// Evita o teste de `new Function()` do Zod (JIT), que violaria a CSP sem 'unsafe-eval'.
// O Zod usa o caminho interpretado, sem diferença para o usuário.
z.config({ jitless: true })

// Streamer validation
export const streamerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  country: z.string().default(''),
  avg_viewers: z.number().int().min(0).default(0),
  peak_viewers: z.number().int().min(0).default(0),
  hours_watched: z.number().int().min(0).default(0),
  hours_streamed: z.number().int().min(0).default(0),
})

// Campaign validation
export const campaignSchema = z.object({
  company: z.string().min(1, 'Empresa é obrigatória'),
  start_date: z.string().refine((date) => {
    const d = new Date(date)
    return !isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030
  }, 'Data de início inválida'),
  end_date: z.string().refine((date) => {
    const d = new Date(date)
    return !isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030
  }, 'Data de fim inválida'),
  total_received: z.number().min(0, 'Valor total deve ser positivo').default(0),
  my_commission: z.number().min(0, 'Comissão deve ser positiva').default(0),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  payment_date: z.string().nullable().default(null),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'Data de fim não pode ser antes da data de início',
  path: ['end_date'],
}).refine((data) => {
  if (!data.payment_date) return true
  return new Date(data.payment_date) >= new Date(data.start_date)
}, {
  message: 'Data de pagamento não pode ser antes da data de início',
  path: ['payment_date'],
}).refine((data) => {
  if (!data.payment_date) return true
  return new Date(data.payment_date) >= new Date(data.end_date)
}, {
  message: 'Data de pagamento não pode ser antes da data de fim da campanha',
  path: ['payment_date'],
})

import { z } from "https://esm.sh/zod@4.6.7"

// UUID v4 do Postgres/Supabase (gen_random_uuid())
const uuidSchema = z.string().uuid({ message: "ID inválido" })

export const updateLastLiveSchema = z.object({
  streamer_id: uuidSchema,
  last_live_at: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "last_live_at deve ser uma data válida",
  }),
})

const MAX_LOGINS = 100
const twitchLoginSchema = z.string().trim().min(1).max(25)

export const twitchProxyActionSchema = z.enum([
  "users",
  "user",
  "streams",
  "search_categories",
  "streams_by_game",
  "last_video",
  "lookup",
])

export const twitchProxyParamsSchema = z.object({
  action: twitchProxyActionSchema,
  logins: z.string().optional(),
  username: twitchLoginSchema.optional(),
  usernames: z.string().optional(),
  query: z.string().trim().min(1).max(100).optional(),
  game_id: z.string().trim().regex(/^\d{1,20}$/).optional(),
  first: z.string().regex(/^\d{1,4}$/).optional(),
  language: z.string().trim().regex(/^[a-zA-Z-]{1,10}$/).optional(),
  user_id: z.string().trim().regex(/^\d{1,20}$/).optional(),
}).superRefine((data, ctx) => {
  const requiredByAction: Record<string, string[]> = {
    users: ["logins"],
    user: ["username"],
    streams: ["usernames"],
    search_categories: ["query"],
    last_video: ["user_id"],
    lookup: ["username"],
  }
  // A Twitch aceita no máximo 100 logins por consulta: acima disso a chamada falharia com erro genérico.
  for (const field of ["logins", "usernames"] as const) {
    const count = data[field]?.split(",").filter(Boolean).length ?? 0
    if (count > MAX_LOGINS) ctx.addIssue({ code: "custom", message: `Máximo de ${MAX_LOGINS} nomes por consulta`, path: [field] })
  }
  const required = requiredByAction[data.action]
  if (required) {
    for (const field of required) {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({ code: "custom", message: `Missing ${field}`, path: [field] })
      }
    }
  }
})

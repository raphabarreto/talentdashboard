import { z } from "https://esm.sh/zod@3.23.8"

// UUID v4 do Postgres/Supabase (gen_random_uuid())
const uuidSchema = z.string().uuid({ message: "ID inválido" })

export const updateLastLiveSchema = z.object({
  streamer_id: uuidSchema,
  last_live_at: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "last_live_at deve ser uma data válida",
  }),
})

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
  const required = requiredByAction[data.action]
  if (required) {
    for (const field of required) {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${field}`, path: [field] })
      }
    }
  }
})

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g

export function extractEmail(description: string): string | null {
  const matches = description.match(EMAIL_REGEX)
  return matches?.[0] || null
}

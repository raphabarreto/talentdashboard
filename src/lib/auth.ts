import { supabase } from './supabase'

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '').split(',')

export function isEmailAllowed(email: string | undefined | null, allowed: string[] = ALLOWED_EMAILS) {
  return !!email && allowed.includes(email)
}

// Só devolve sessão de e-mail permitido. Quem não está na lista é deslogado,
// evitando o loop login.html <-> home.
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (session && !isEmailAllowed(session.user?.email)) {
    await supabase.auth.signOut()
    return null
  }
  return session
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

export function onAuthChange(callback: (loggedIn: boolean) => void) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const loggedIn = !!session && isEmailAllowed(session.user?.email)
    callback(loggedIn)
  })
}

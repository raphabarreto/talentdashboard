import { supabase } from './supabase'

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '').split(',')

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!ALLOWED_EMAILS.includes(data.user?.email || '')) {
    await supabase.auth.signOut()
    throw new Error('Email não autorizado.')
  }
  return data
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
    const loggedIn = !!session && ALLOWED_EMAILS.includes(session.user?.email || '')
    callback(loggedIn)
  })
}

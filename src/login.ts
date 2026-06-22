import { signInWithGoogle, getSession } from './lib/auth'

// Se já tá logado, redireciona
getSession().then(session => {
  if (session) window.location.href = '/'
})

document.getElementById('googleBtn')?.addEventListener('click', async () => {
  try {
    await signInWithGoogle()
  } catch (err: unknown) {
    const errorEl = document.getElementById('error')!
    errorEl.textContent = err instanceof Error ? err.message : 'Erro ao fazer login.'
    errorEl.classList.remove('hidden')
  }
})

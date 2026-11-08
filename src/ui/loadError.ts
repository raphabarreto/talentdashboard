// Tela de falha do carregamento inicial: em vez de ficar "carregando" para sempre, explica e permite tentar de novo.
export function showLoadError(onRetry: () => void) {
  const overlay = document.getElementById('loading-overlay')
  if (!overlay) return
  overlay.classList.remove('hidden')
  overlay.innerHTML = ''
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.className = 'max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-8 text-center shadow-lg'
  const title = document.createElement('p')
  title.className = 'text-lg font-bold text-white mb-2'
  title.textContent = 'Não foi possível carregar os dados'
  const text = document.createElement('p')
  text.className = 'text-sm text-slate-400 mb-6'
  text.textContent = 'Verifique sua conexão e tente novamente. Nenhum dado foi alterado.'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'loadRetryBtn'
  btn.className = 'px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors'
  btn.textContent = 'Tentar novamente'
  btn.addEventListener('click', () => { btn.disabled = true; btn.textContent = 'Carregando...'; onRetry() })
  box.append(title, text, btn)
  overlay.appendChild(box)
}

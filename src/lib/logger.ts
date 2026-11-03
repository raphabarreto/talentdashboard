import * as Sentry from '@sentry/browser'

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

export function log(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  if (level === 'error') {
    console.error(prefix, message, context || '')
    // Enviar para Sentry em produção
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      // Preserva o erro original (com stack) quando houver; a mensagem do log vai junto como contexto.
      const original = context?.error instanceof Error ? context.error : null
      Sentry.captureException(original ?? new Error(message), { extra: { ...context, log_message: message } })
    }
  } else if (level === 'warn') {
    console.warn(prefix, message, context || '')
  } else {
    console.log(prefix, message, context || '')
  }
}

export function logError(error: unknown, context: string, extra?: LogContext) {
  const message = error instanceof Error ? error.message : String(error)
  log('error', `${context}: ${message}`, { ...extra, error })
}

// Loading state helper
export function setButtonLoading(button: HTMLButtonElement, loading: boolean, originalText?: string) {
  if (loading) {
    button.disabled = true
    button.dataset.originalText = button.textContent || ''
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...'
  } else {
    button.disabled = false
    button.textContent = originalText || button.dataset.originalText || 'Salvar'
    delete button.dataset.originalText
  }
}

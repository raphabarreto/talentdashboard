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
      Sentry.captureException(new Error(message), { extra: context })
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

export function logInfo(message: string, context?: LogContext) {
  log('info', message, context)
}

export function logWarn(message: string, context?: LogContext) {
  log('warn', message, context)
}

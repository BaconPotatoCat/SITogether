// Logger for Next.js (server-side only)
// Browser-side logs go to console only; server-side logs write to /app/logs/frontend-app.log

// Prevent webpack from bundling this module on the client-side
const isServer = typeof window === 'undefined'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fs: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let path: any

if (isServer) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fs = require('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  path = require('path')
}

let LOG_DIR = '/app/logs'
let LOG_FILE = isServer ? path.join(LOG_DIR, 'frontend-app.log') : ''

// Ensure log directory exists (server-side only)
if (isServer) {
  // Use original console if available (to avoid recursion with logging-bridge)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalConsole = (global as any).__originalConsole || console

  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  } catch {
    // Fallback for non-container/local runs
    const fallback = path.join(process.cwd(), 'logs')
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true })
      }
      LOG_DIR = fallback
      LOG_FILE = path.join(LOG_DIR, 'frontend-app.log')
      originalConsole.warn('Frontend logger fallback to local logs directory:', LOG_DIR)
    } catch (err) {
      originalConsole.error('Failed to initialize frontend log directory:', err)
    }
  }
}

function getTimestamp() {
  return new Date().toISOString()
}

function log(level: string, message: string, meta?: Record<string, unknown>) {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    source: 'frontend',
    ...(meta ? { meta } : {}),
  }

  // Use original console if available (to avoid recursion with logging-bridge)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalConsole = (global as any).__originalConsole || console

  // Server-side: write to file
  if (isServer) {
    const line = JSON.stringify(logEntry) + '\n'
    try {
      fs.appendFileSync(LOG_FILE, line)
    } catch (err) {
      originalConsole.error('Failed to write frontend log:', err)
    }
  }

  // Always log to console for visibility
  const consoleMethod =
    level === 'error'
      ? originalConsole.error
      : level === 'warn'
        ? originalConsole.warn
        : originalConsole.log
  consoleMethod(`[${level.toUpperCase()}]`, message, meta || '')
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  logFilePath: LOG_FILE,
}

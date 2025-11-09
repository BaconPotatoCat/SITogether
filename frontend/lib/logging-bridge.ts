// Global console to logger bridge for Next.js
// In non-test environments, route console.log/warn/error to the JSON logger
// while still echoing to the original console for visibility.
// Only logs on server-side; client-side logs remain in browser console.
// Does NOT run in Edge Runtime (middleware) - only in Node.js runtime (API routes, SSR).

import { logger } from './logger'
import { config } from '../utils/config'

const isServer = typeof window === 'undefined'
const isTest = config.isTest

// Check if we're in Edge Runtime (middleware) vs Node.js runtime
// Edge Runtime doesn't have process.version
const isEdgeRuntime = isServer && typeof process === 'undefined'

// Convert any argument to a string representation (safe JSON if possible)
function stringifyArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || arg.message || String(arg)
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

// Sanitize a log string to prevent log injection / terminal escape abuse
// - Strip CR/LF to keep each log entry single-line in files
// - Remove other ASCII control characters (0x00-0x1F except TAB) and DEL (0x7F)
// - Collapse excessive whitespace
function sanitizeLogString(str: string): string {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const code = ch.charCodeAt(0)
    if (ch === '\n' || ch === '\r') {
      if (out.length === 0 || out[out.length - 1] !== ' ') out += ' '
      continue
    }
    if ((code >= 0 && code <= 31 && code !== 9) || code === 127) continue
    out += ch
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

function buildSanitizedMessage(args: unknown[]): string {
  return sanitizeLogString(args.map(stringifyArg).join(' '))
}

// Only patch console in Node.js runtime (not Edge runtime)
if (!isTest && isServer && !isEdgeRuntime) {
  // Save original console methods BEFORE importing logger to prevent recursion
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  // Make original methods available to logger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).__originalConsole = original

  console.log = (...args: unknown[]) => {
    const message = buildSanitizedMessage(args)
    try {
      logger.info(message)
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.log(message)
  }

  console.warn = (...args: unknown[]) => {
    const message = buildSanitizedMessage(args)
    try {
      logger.warn(message)
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.warn(message)
  }

  console.error = (...args: unknown[]) => {
    const message = buildSanitizedMessage(args)
    try {
      logger.error(message)
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.error(message)
  }
}

export {}

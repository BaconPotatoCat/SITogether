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
    try {
      logger.info(args.map(stringifyArg).join(' '))
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.log(...args)
  }

  console.warn = (...args: unknown[]) => {
    try {
      logger.warn(args.map(stringifyArg).join(' '))
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.warn(...args)
  }

  console.error = (...args: unknown[]) => {
    try {
      logger.error(args.map(stringifyArg).join(' '))
    } catch {
      // Ignore logger failures to prevent breaking the application
    }
    original.error(...args)
  }
}

export {}

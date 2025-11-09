// Global console to logger bridge
// In non-test environments, route console.log/warn/error to the JSON logger
// while still echoing to the original console for local visibility.
const config = require('./config');

// Convert any argument to a string representation (safe JSON if possible)
function stringifyArg(arg) {
  if (arg instanceof Error) return arg.stack || arg.message || String(arg);
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch (_) {
      return String(arg);
    }
  }
  return String(arg);
}

// Sanitize a log string to prevent log injection / terminal escape abuse
// - Strip CR/LF to keep each log entry single-line in files
// - Remove other ASCII control characters (0x00-0x1F except TAB) and DEL (0x7F)
// - Collapse excessive whitespace
function sanitizeLogString(str) {
  if (typeof str !== 'string') return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    // Normalize CR/LF to space
    if (ch === '\n' || ch === '\r') {
      if (out.length === 0 || out[out.length - 1] !== ' ') out += ' ';
      continue;
    }
    // Skip ASCII control characters except TAB (9) and skip DEL (127)
    if ((code >= 0 && code <= 31 && code !== 9) || code === 127) continue;
    out += ch;
  }
  // Collapse multiple spaces and trim
  return out.replace(/ {2,}/g, ' ').trim();
}

function buildSanitizedMessage(args) {
  return sanitizeLogString(args.map(stringifyArg).join(' '));
}

if (!config.isTest) {
  // Save original console methods BEFORE importing logger to prevent recursion
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  // Make original methods available to logger
  global.__originalConsole = original;

  // Now import logger after saving originals
  const logger = require('./logger');

  console.log = (...args) => {
    const message = buildSanitizedMessage(args);
    try {
      logger.info(message);
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.log(message);
  };

  console.warn = (...args) => {
    const message = buildSanitizedMessage(args);
    try {
      logger.warn(message);
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.warn(message);
  };

  console.error = (...args) => {
    const message = buildSanitizedMessage(args);
    try {
      logger.error(message);
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.error(message);
  };
}

module.exports = {};

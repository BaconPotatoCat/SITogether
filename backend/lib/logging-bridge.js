// Global console to logger bridge
// In non-test environments, route console.log/warn/error to the JSON logger
// while still echoing to the original console for local visibility.
const config = require('./config');

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
    try {
      logger.info(args.map(stringifyArg).join(' '));
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.log(...args);
  };

  console.warn = (...args) => {
    try {
      logger.warn(args.map(stringifyArg).join(' '));
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.warn(...args);
  };

  console.error = (...args) => {
    try {
      logger.error(args.map(stringifyArg).join(' '));
    } catch (_) {
      // Ignore logger failures to prevent breaking the application
    }
    original.error(...args);
  };
}

module.exports = {};

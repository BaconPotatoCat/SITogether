const fs = require('fs');
const path = require('path');

// Log directory and file name (always write inside the container at /app/logs)
let LOG_DIR = '/app/logs';
let LOG_FILE = path.join(LOG_DIR, 'backend-app.log');

// Use original console if available (to avoid recursion with logging-bridge)
const originalConsole = global.__originalConsole || console;

// Ensure log directory exists
try {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(LOG_DIR)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  // Fallback for non-container/local runs: ensure a local logs directory
  const fallback = path.join(__dirname, '../logs');
  try {
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    LOG_DIR = fallback;
    LOG_FILE = path.join(LOG_DIR, 'app.log');
    originalConsole.warn('Logger fallback to local logs directory:', LOG_DIR);
  } catch (err) {
    originalConsole.error('Failed to initialize log directory:', err);
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(logEntry) + '\n';
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) {
      originalConsole.error('Failed to write log:', err);
    }
  });
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  logFilePath: LOG_FILE,
};

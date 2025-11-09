const { PrismaClient } = require('@prisma/client');
const config = require('./config');

const globalForPrisma = globalThis;

// Disable verbose SQL query logging to avoid leaking sensitive SQL details into logs.
// Keep only warn/error in production; include info in development if needed.
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.isDevelopment ? ['info', 'warn', 'error'] : ['warn', 'error'],
  });

if (!config.isProduction) globalForPrisma.prisma = prisma;

module.exports = prisma;

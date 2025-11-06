const { PrismaClient } = require('@prisma/client');
const config = require('./config');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

if (!config.isProduction) globalForPrisma.prisma = prisma;

module.exports = prisma;

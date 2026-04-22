import { PrismaClient } from '@prisma/client'

// Global singleton to survive Next.js hot-module replacement in development.
// In production each worker process holds a single instance by module cache.
const globalForPrisma = global as unknown as { crmPrisma: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.crmPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.crmPrisma = prisma
}

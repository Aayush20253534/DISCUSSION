import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export function createDatabase(connectionString) {
  if (!connectionString) {
    return { configured: false, ping: async () => false, close: async () => {} }
  }
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 5000,
  })
  const prisma = new PrismaClient({ adapter, log: [] })
  return {
    prisma,
    configured: true,
    async ping() {
      await prisma.$queryRaw`SELECT 1`
      return true
    },
    close: () => prisma.$disconnect(),
  }
}

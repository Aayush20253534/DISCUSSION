import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export function createDatabase(connectionString) {
  if (!connectionString) {
    return {
      configured: false,
      ping: async () => false,
      close: async () => {},
    }
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 60000,
    query_timeout: 15000,
  })

  const prisma = new PrismaClient({
    adapter,
    log: [],
    transactionOptions: {
      maxWait: 10000,
      timeout: 15000,
    },
  })

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
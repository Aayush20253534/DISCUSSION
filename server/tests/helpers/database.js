import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Real PostgreSQL SQL/constraints through Prisma and pg, in a disposable WASM engine.
// Never reads DATABASE_URL or connects to the developer's Neon database.
export async function testDatabase() {
  const engine = await PGlite.create()
  const migrations = new URL('../../prisma/migrations/', import.meta.url)
  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await engine.exec(await readFile(new URL(`${entry.name}/migration.sql`, migrations), 'utf8'))
  }
  const socket = new PGLiteSocketServer({
    db: engine,
    port: 0,
    host: '127.0.0.1',
    maxConnections: 5,
  })
  await socket.start()
  // PGlite has one underlying connection; keep transactions on that connection.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`,
      max: 1,
    }),
    log: [],
  })
  return {
    prisma,
    configured: true,
    ping: async () => {
      await prisma.$queryRaw`SELECT 1`
      return true
    },
    async close() {
      await prisma.$disconnect()
      await socket.stop()
      await engine.close()
    },
  }
}

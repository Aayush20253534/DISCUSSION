import './src/config/load-env.js'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation/validation can run without credentials. The migration wrapper
  // requires DIRECT_URL and never migrates against this offline placeholder.
  datasource: {
    url: process.env.DIRECT_URL || 'postgresql://offline:offline@localhost:5432/offline',
  },
})

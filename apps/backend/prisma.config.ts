import path from 'node:path'
import { loadEnvironment } from '@net/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 不再自动加载环境变量，使用统一的 loadEnvironment 加载
const rootDir = path.resolve(__dirname, '../..')
loadEnvironment({ basePath: rootDir })

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  // Prisma 7: datasource URL 必须在这里配置
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // Prisma 7: generator 配置也需要在这里
  generators: {
    client: {
      provider: 'prisma-client-js',
    },
  },
})

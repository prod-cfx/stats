import path from 'node:path'
// 部署环境无 workspace 别名，使用相对路径确保可解析
import { loadEnvironment } from '../../packages/config/src'
import { defineConfig } from 'prisma/config'
import { applyQuantifyEnvOverrides } from './src/config/quantify-env'

// Prisma 7 不再自动加载环境变量，统一使用 loadEnvironment 加载
const rootDir = path.resolve(__dirname, '../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

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
  // Prisma 7: generator 配置也需要在这里声明
  generators: {
    client: {
      provider: 'prisma-client-js',
    },
  },
})

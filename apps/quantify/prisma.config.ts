import path from 'node:path'
import { loadEnvironment } from '@net/config'
import { defineConfig } from 'prisma/config'
import { applyQuantifyEnvOverrides } from './src/config/quantify-env'

// Prisma 7 涓嶅啀鑷姩鍔犺浇鐜鍙橀噺锛屼娇鐢ㄧ粺涓€鐨?loadEnvironment 鍔犺浇
const rootDir = path.resolve(__dirname, '../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  // Prisma 7: datasource URL 蹇呴』鍦ㄨ繖閲岄厤缃?
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // Prisma 7: generator 閰嶇疆涔熼渶瑕佸湪杩欓噷
  generators: {
    client: {
      provider: 'prisma-client-js',
    },
  },
})

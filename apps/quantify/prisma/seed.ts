// Prisma 7: 鏄惧紡鍔犺浇鐜鍙橀噺锛圥risma 7 涓嶅啀鑷姩鍔犺浇锛?
import * as path from 'node:path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { applyQuantifyEnvOverrides } from '../src/config/quantify-env'
import { createEnvAccessor } from '../src/common/env/env.accessor'

// 浣跨敤缁熶竴鐨?loadEnvironment 鍔犺浇鐜鍙橀噺
const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

// 浣跨敤缁熶竴鐨勭幆澧冨彉閲忚闂櫒
const env = createEnvAccessor()

const dbUrl = env.str('DATABASE_URL')
if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('鉂?DATABASE_URL 鏈厤缃垨浠嶄负鍗犱綅绗︺€傝鍦?.env.*.local 涓缃湁鏁堢殑鏁版嵁搴撹繛鎺ュ瓧绗︿覆銆?)
  process.exit(1)
}
const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function seedAiProviderKeys() {
  const rawKey = process.env.UNIAPI_API_KEY
  const apiKey = rawKey?.trim()

  // 鍏煎 .env.* 涓殑鍗犱綅绗?__SET_IN_env.local__锛屼互鍙婄┖鐧藉€?
  if (!apiKey || apiKey === '__SET_IN_env.local__') {
    console.warn(
      '[seed] 妫€娴嬪埌鏈厤缃?UNIAPI_API_KEY锛堟垨浠嶄负鍗犱綅绗?__SET_IN_env.local__锛夛紝璺宠繃 AiProviderKey(uniapi/default) 鍒濆鍖栥€傝鍦ㄦ湰鍦?.env.<env>.local 涓厤缃?UNIAPI_API_KEY 鍚庨噸鏂拌繍琛?seed銆?,
    )
    return
  }

  console.log('[seed] 寮€濮嬪垵濮嬪寲 AI 渚涘簲鍟嗛厤缃? uniapi/default...')

  interface AiProviderKeyDelegate {
    upsert: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    aiProviderKey?: AiProviderKeyDelegate
  }

  if (!client.aiProviderKey || typeof client.aiProviderKey.upsert !== 'function') {
    console.warn(
      '[seed] 褰撳墠 Prisma Client 涓嶅寘鍚?aiProviderKey 濮旀墭锛屽彲鑳芥槸 schema 涓庤縼绉绘湭鍚屾锛岃烦杩?AiProviderKey 鍒濆鍖栥€?,
    )
    return
  }

  await client.aiProviderKey.upsert({
    where: {
      providerCode_name: {
        providerCode: 'uniapi',
        name: 'default',
      },
    },
    update: {
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
    create: {
      providerCode: 'uniapi',
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      name: 'default',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
  })

  console.log('[seed] AI 渚涘簲鍟嗛厤缃?uniapi/default 鍒濆鍖栧畬鎴?)
}

async function main() {
  console.log('寮€濮嬪～鍏呯瀛愭暟鎹?..')

  await seedAiProviderKeys()

  console.log('绉嶅瓙鏁版嵁濉厖瀹屾垚')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    // Prisma 7: 鍏抽棴杩炴帴姹?
    await pool.end()
  })
  .catch(async (e) => {
    console.error('绉嶅瓙鏁版嵁濉厖澶辫触:', e)
    await prisma.$disconnect()
    // Prisma 7: 鍏抽棴杩炴帴姹?
    await pool.end()
    process.exit(1)
  })

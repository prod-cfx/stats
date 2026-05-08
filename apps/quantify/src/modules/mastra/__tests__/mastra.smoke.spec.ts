// Smoke 测试用真实 LLM 调用：当前阶段 Mastra 不随全量单测默认启用。
//
// 关键约束：本文件**不能**在顶部静态 import MastraService / @mastra/core，
// 因为 jest unit run 默认不 transform ESM transitive deps（如 p-map@7+）。
// 顶层 import 会让 jest 把整个文件标记为 numRuntimeErrorTestSuites。
// 解决：用 require() 延迟到测试体内，配合 describe.skip 时 require 永远不执行。
const SMOKE_ENABLED = process.env.QUANTIFY_MASTRA_SMOKE_ENABLED === 'true' && !!process.env.QUANTIFY_UNIAPI_API_KEY
const describeSmoke = SMOKE_ENABLED ? describe : describe.skip

describeSmoke('MastraService smoke (requires QUANTIFY_UNIAPI_API_KEY in env)', () => {
  it('真实凭证下 createAgent + agent.generate 返回非空文本', async () => {
    // 延迟 require，避免无 key 环境下加载 ESM-only deps 触发 jest 解析错误

    const { ConfigService } = require('@nestjs/config') as typeof import('@nestjs/config')
    const { MastraService } = require('../mastra.service') as typeof import('../mastra.service')

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'mastra.default') {
          return {
            apiKey: process.env.QUANTIFY_UNIAPI_API_KEY,
            baseUrl: process.env.QUANTIFY_UNIAPI_BASE_URL ?? 'https://api.uniapi.io',
            defaultModel: process.env.QUANTIFY_UNIAPI_DEFAULT_MODEL ?? 'gpt-4o-mini',
            envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
          }
        }
        if (key === 'app.appEnv') return 'development'
        return undefined
      }),
    } as unknown as InstanceType<typeof ConfigService>

    const service = new MastraService(configService)
    service.onModuleInit()

    const agent = service.createAgent({
      id: 'smoke',
      name: 'smoke',
      instructions: 'Reply with the single word "pong".',
    })

    const result = await agent.generate(
      [{ role: 'user', content: 'ping' }],
      { maxSteps: 1 },
    ) as { text?: string }

    expect(result.text).toBeTruthy()
  }, 30_000)
})

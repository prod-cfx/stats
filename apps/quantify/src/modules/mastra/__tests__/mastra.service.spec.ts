// Mock SDK 依赖：理由同 mastra.config.spec.ts（避免 ESM transitive 依赖崩溃）
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({
    chat: jest.fn(() => ({ provider: 'mock-openai' })),
  })),
}))

jest.mock('@mastra/core/agent', () => ({
  Agent: class MockAgent {
    public id: string
    public name: string
    public instructions: string

    constructor(opts: { id: string; name: string; instructions: string }) {
      this.id = opts.id
      this.name = opts.name
      this.instructions = opts.instructions
    }
  },
}))

import { ConfigService } from '@nestjs/config'

import { MastraUnsupportedProviderException } from '../exceptions/mastra-unsupported-provider.exception'
import { MastraService } from '../mastra.service'

interface ConfigStubMap {
  'mastra.default'?: {
    apiKey?: string
    baseUrl?: string
    defaultModel?: string
    envKeyName?: string
  }
  'app.appEnv'?: string
}

function buildService(stub: ConfigStubMap): MastraService {
  const configService = {
    get: jest.fn((key: string) => stub[key as keyof ConfigStubMap]),
  } as unknown as ConfigService
  return new MastraService(configService)
}

describe('MastraService', () => {
  describe('onModuleInit', () => {
    it.each(['production', 'staging'])(
      'appEnv=%s 缺 apiKey 时抛 Error 阻止启动',
      (appEnv) => {
        const service = buildService({
          'mastra.default': {
            apiKey: undefined,
            baseUrl: 'https://api.uniapi.io',
            defaultModel: 'gpt-4o-mini',
            envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
          },
          'app.appEnv': appEnv,
        })
        expect(() => service.onModuleInit()).toThrow(/missing.*refusing to start/)
      },
    )

    it('appEnv=development 缺 apiKey 仅 warn，不抛', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: undefined,
          baseUrl: 'https://api.uniapi.io',
          defaultModel: 'gpt-4o-mini',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
        'app.appEnv': 'development',
      })
      expect(() => service.onModuleInit()).not.toThrow()
    })

    it('apiKey 齐全时不抛', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          baseUrl: 'https://api.uniapi.io',
          defaultModel: 'gpt-4o-mini',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
        'app.appEnv': 'production',
      })
      expect(() => service.onModuleInit()).not.toThrow()
    })

    it('mastra.default 配置完全缺失时回退默认值（envKeyName/defaultModel）', () => {
      const service = buildService({
        'app.appEnv': 'development',
      })
      expect(() => service.onModuleInit()).not.toThrow()
      const cfg = service.getRuntimeConfig('default')
      expect(cfg.envKeyName).toBe('QUANTIFY_UNIAPI_API_KEY')
      expect(cfg.defaultModel).toBe('gpt-4o-mini')
    })
  })

  describe('getRuntimeConfig', () => {
    it('default 返回缓存配置', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          baseUrl: 'https://api.uniapi.io',
          defaultModel: 'gpt-4o-mini',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
      })
      service.onModuleInit()
      expect(service.getRuntimeConfig('default')).toMatchObject({
        apiKey: 'rt-key',
        defaultModel: 'gpt-4o-mini',
      })
    })

    it('strategy-codegen 抛 MastraUnsupportedProviderException（Phase 1 死分支）', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
      })
      service.onModuleInit()
      // 'strategy-codegen' 类型上合法（属于 ProviderCode 联合类型），但 Phase 1 仅实现 'default'
      expect(() => service.getRuntimeConfig('strategy-codegen'))
        .toThrow(MastraUnsupportedProviderException)
    })

    it('未知 providerCode 抛 MastraUnsupportedProviderException', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
      })
      service.onModuleInit()
      // @ts-expect-error 故意传非法值
      expect(() => service.getRuntimeConfig('bogus'))
        .toThrow(MastraUnsupportedProviderException)
    })
  })

  describe('createAgent', () => {
    it('providerCode=strategy-codegen 抛 MastraUnsupportedProviderException', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
      })
      service.onModuleInit()
      expect(() => service.createAgent({
        id: 'a', name: 'a', instructions: 'x',
        providerCode: 'strategy-codegen',
      })).toThrow(MastraUnsupportedProviderException)
    })

    it('合法参数返回 Agent 实例', () => {
      const service = buildService({
        'mastra.default': {
          apiKey: 'rt-key',
          baseUrl: 'https://api.uniapi.io',
          defaultModel: 'gpt-4o-mini',
          envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
        },
      })
      service.onModuleInit()
      const agent = service.createAgent({ id: 'a', name: 'a', instructions: 'x' })
      expect(agent).toBeDefined()
      expect(agent.id).toBe('a')
    })
  })
})

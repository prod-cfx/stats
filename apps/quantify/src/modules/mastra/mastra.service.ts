import type { Agent } from '@mastra/core/agent'
import type { OnModuleInit } from '@nestjs/common'
import type { CreateAgentConfig, MastraProviderRuntimeConfig, ProviderCode } from './mastra.config'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 ConfigService
import { ConfigService } from '@nestjs/config'

import { MastraUnsupportedProviderException } from './exceptions/mastra-unsupported-provider.exception'
import { createAgent } from './mastra.config'

interface MastraDefaultProviderConfigShape {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  envKeyName?: string
}

const DEFAULT_PROVIDER: ProviderCode = 'default'
const FALLBACK_DEFAULT_MODEL = 'gpt-4o-mini'
const FALLBACK_ENV_KEY_NAME = 'QUANTIFY_UNIAPI_API_KEY'

/**
 * Mastra 基础设施 Service（Phase 1 脚手架）。
 *
 * 公开 API：
 * - getRuntimeConfig(providerCode?): 拿当前 provider 的 runtime 配置
 * - createAgent(agentConfig): 工厂方法，每次调用返回新 Agent 实例
 *
 * 启动期校验：
 * - prod/staging 缺 apiKey → 抛 plain Error（让 NestFactory.create 拒绝并退出进程，
 *   AllExceptionsFilter 在 onModuleInit 阶段未挂上，DomainException 也只是被当成 Error）
 * - dev 缺 apiKey → 仅 warn，允许本地开发
 */
@Injectable()
export class MastraService implements OnModuleInit {
  private readonly logger = new Logger(MastraService.name)
  private runtimeConfigs!: Map<ProviderCode, MastraProviderRuntimeConfig>

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const defaultCfg = this.configService.get<MastraDefaultProviderConfigShape>('mastra.default')
    this.runtimeConfigs = new Map<ProviderCode, MastraProviderRuntimeConfig>([
      [DEFAULT_PROVIDER, {
        apiKey: defaultCfg?.apiKey,
        baseUrl: defaultCfg?.baseUrl,
        defaultModel: defaultCfg?.defaultModel ?? FALLBACK_DEFAULT_MODEL,
        envKeyName: defaultCfg?.envKeyName ?? FALLBACK_ENV_KEY_NAME,
      }],
    ])

    if (this.runtimeConfigs.get(DEFAULT_PROVIDER)?.apiKey) {
      this.logger.log('[Mastra] 运行时配置已加载（provider=default）')
      return
    }

    const appEnv = this.configService.get<string>('app.appEnv') ?? 'development'
    if (appEnv === 'production' || appEnv === 'staging') {
      // 用 plain Error：bootstrap 阶段 AllExceptionsFilter 未挂载，
      // 用 DomainException 也只是被当 Error 吃掉退出。conventions §7
      // 的 DomainException 范围是"业务异常"，启动失败不在此列。
      throw new Error(
        `[Mastra] missing ${FALLBACK_ENV_KEY_NAME} in env=${appEnv}; refusing to start`,
      )
    }
    this.logger.warn(
      `[Mastra] 未配置 ${FALLBACK_ENV_KEY_NAME}，AI 功能不可用（dev 降级）`,
    )
  }

  getRuntimeConfig(providerCode: ProviderCode = DEFAULT_PROVIDER): MastraProviderRuntimeConfig {
    if (providerCode !== DEFAULT_PROVIDER) {
      throw new MastraUnsupportedProviderException({ providerCode })
    }
    const cfg = this.runtimeConfigs.get(providerCode)
    if (!cfg) {
      throw new MastraUnsupportedProviderException({ providerCode })
    }
    return cfg
  }

  createAgent(agentConfig: CreateAgentConfig): Agent {
    // 单一防线：getRuntimeConfig 内部校验 providerCode 合法性
    const runtimeConfig = this.getRuntimeConfig(agentConfig.providerCode)
    return createAgent(runtimeConfig, agentConfig)
  }
}

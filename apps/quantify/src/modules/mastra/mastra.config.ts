import type { ToolsInput } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { Agent } from '@mastra/core/agent'

import { MastraProviderMissingCredentialException } from './exceptions/mastra-provider-missing-credential.exception'

export type ProviderCode = 'default' | 'strategy-codegen'

export interface MastraProviderRuntimeConfig {
  apiKey: string | undefined
  baseUrl: string | undefined
  defaultModel: string
  envKeyName: string
}

export interface CreateAgentConfig {
  id: string
  name: string
  instructions: string
  tools?: ToolsInput
  model?: string
  providerCode?: ProviderCode
  // 运行时显式覆盖凭证；为 null/undefined 时回退到 runtimeConfig
  apiKey?: string | null
  apiBaseUrl?: string | null
}

/**
 * 为单次 Mastra Agent 调用创建实例。
 *
 * 设计要点：
 * - 凭证显式注入：禁止 createOpenAI 隐式回退 process.env.OPENAI_API_KEY，避免误用
 * - 凭证缺失立即抛 DomainException（带 ErrorCode）；不延迟到 generate 时 401 才发现
 * - 每次调用返回新 Agent，不缓存（业务侧 instructions/tools 通常每轮变化）
 */
export function createAgent(
  runtimeConfig: MastraProviderRuntimeConfig,
  agentConfig: CreateAgentConfig,
): Agent {
  const modelId = agentConfig.model ?? runtimeConfig.defaultModel
  const apiKey = agentConfig.apiKey ?? runtimeConfig.apiKey
  const apiBaseUrl = agentConfig.apiBaseUrl ?? runtimeConfig.baseUrl

  if (!apiKey) {
    throw new MastraProviderMissingCredentialException({
      providerCode: agentConfig.providerCode ?? 'default',
      expectedEnv: runtimeConfig.envKeyName,
      modelId,
    })
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: apiBaseUrl ?? undefined,
  })

  return new Agent({
    id: agentConfig.id,
    name: agentConfig.name,
    instructions: agentConfig.instructions,
    model: openai.chat(modelId),
    tools: agentConfig.tools ?? {},
  })
}

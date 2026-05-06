// Mock SDK 依赖：@mastra/core 与 @ai-sdk/openai 的 transitive ESM 子依赖（p-map@7+）
// 在 jest 默认 transform 设置下不可加载；mock 替换可保持单测纯净 + 高速
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
    public model: unknown
    public tools: unknown

    constructor(opts: { id: string; name: string; instructions: string; model: unknown; tools: unknown }) {
      this.id = opts.id
      this.name = opts.name
      this.instructions = opts.instructions
      this.model = opts.model
      this.tools = opts.tools
    }
  },
}))

import * as openaiSdk from '@ai-sdk/openai'

import { MastraProviderMissingCredentialException } from '../exceptions/mastra-provider-missing-credential.exception'
import {
  createAgent,
  type MastraProviderRuntimeConfig,
} from '../mastra.config'

const baseRuntime: MastraProviderRuntimeConfig = {
  apiKey: 'rt-key',
  baseUrl: 'https://api.uniapi.io',
  defaultModel: 'gpt-4o-mini',
  envKeyName: 'QUANTIFY_UNIAPI_API_KEY',
}

describe('createAgent', () => {
  const createOpenAiMock = openaiSdk.createOpenAI as unknown as jest.Mock

  beforeEach(() => {
    createOpenAiMock.mockClear()
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('runtime 与 agent 都没 apiKey → 抛 MastraProviderMissingCredentialException', () => {
    expect(() => createAgent(
      { ...baseRuntime, apiKey: undefined },
      { id: 'a', name: 'a', instructions: 'x' },
    )).toThrow(MastraProviderMissingCredentialException)
    expect(createOpenAiMock).not.toHaveBeenCalled()
  })

  it('agent.apiKey 优先于 runtime.apiKey', () => {
    createAgent(baseRuntime, {
      id: 'a', name: 'a', instructions: 'x',
      apiKey: 'agent-key',
    })
    expect(createOpenAiMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'agent-key' }),
    )
  })

  it('agent.apiBaseUrl 优先于 runtime.baseUrl', () => {
    createAgent(baseRuntime, {
      id: 'a', name: 'a', instructions: 'x',
      apiBaseUrl: 'https://override.example.com',
    })
    expect(createOpenAiMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://override.example.com' }),
    )
  })

  it('runtime apiKey 不为空、agent 未传 → 用 runtime apiKey', () => {
    createAgent(baseRuntime, { id: 'a', name: 'a', instructions: 'x' })
    expect(createOpenAiMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'rt-key' }),
    )
  })

  it('不读 process.env.OPENAI_API_KEY（防止 SDK 隐式回退）', () => {
    process.env.OPENAI_API_KEY = 'should-not-be-used'
    expect(() => createAgent(
      { ...baseRuntime, apiKey: undefined },
      { id: 'a', name: 'a', instructions: 'x' },
    )).toThrow(MastraProviderMissingCredentialException)
    expect(createOpenAiMock).not.toHaveBeenCalled()
  })

  it('正常路径返回 Agent 实例（含 id/name/instructions）', () => {
    const agent = createAgent(baseRuntime, {
      id: 'agent-1', name: 'AgentOne', instructions: 'be terse',
    })
    expect(agent).toBeDefined()
    expect((agent as unknown as { id: string }).id).toBe('agent-1')
    expect((agent as unknown as { name: string }).name).toBe('AgentOne')
  })
})

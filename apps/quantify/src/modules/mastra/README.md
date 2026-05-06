# Mastra 基础设施模块

## 状态

**Phase 1 脚手架** — 已接入 NestJS DI，但**当前没有业务消费方**。

后续迁移路线：

- Phase 2：把 `apps/quantify/src/modules/llm-strategies/llm-orchestrated-engine-v3.service.ts` 主循环切到 Mastra Agent
- Phase 2：把 `apps/quantify/src/modules/llm-strategy-codegen/` 中的 planner / clarification / conversation LLM 调用切到 Mastra Agent
- Phase 3：把 `apps/quantify/src/modules/ai/llm-v3-tools.executor.ts` 中的 4 个数据工具迁移为 Mastra `createTool`

## 用法（业务模块迁移参考）

```ts
import { Injectable } from '@nestjs/common'
import { MastraService } from '@/modules/mastra/mastra.service'

@Injectable()
export class SomeBusinessService {
  constructor(private readonly mastra: MastraService) {}

  async run(userInput: string) {
    const agent = this.mastra.createAgent({
      id: 'some-agent',
      name: 'someAgent',
      instructions: '...',
      tools: { /* 业务自己构造 */ },
    })
    return agent.generate([{ role: 'user', content: userInput }], { maxSteps: 3 })
  }
}
```

## 关键设计决策

### `@Global()` 模块

预留 Phase 2 多消费方场景，避免后续每次迁移都要改 module imports。当前虽然只有自己消费，但参考项目 `apps/backend` 已验证此模式。

### 通用 `createAgent` 工厂

`MastraService.createAgent(agentConfig)` 不绑业务，所有调用方按需传入 `instructions` / `tools` / `model`。这把"凭证管理 + provider 选择"统一在基础设施层，避免每个迁移者各写一份。

### 单 provider 实现，多 provider API 形状

API 接受 `providerCode` 参数（缺省 `'default'`）。Phase 1 仅实现 `default`（读 `QUANTIFY_UNIAPI_*` env），其他 `providerCode` 抛 `MastraUnsupportedProviderException`。

**Phase 2 加 `strategy-codegen` provider 时改两处：**
1. `apps/quantify/src/config/configuration.ts` 的 `mastraConfig` namespace 加 `strategyCodegen` 子键
2. `MastraService.onModuleInit` 把它加进 `runtimeConfigs` Map；移除 `getRuntimeConfig` 里的 `MastraUnsupportedProviderException` 早返回

### 凭证显式注入

`createAgent` 内部 `createOpenAI({ apiKey, baseURL })` 必须显式传入；**禁止**让 SDK 隐式读 `process.env.OPENAI_API_KEY`。这是为了：

- 调试错误明确：缺凭证时立即抛 `MastraProviderMissingCredentialException` 带 ErrorCode，而不是延迟到 generate 时 401
- 运维可观测：env 名清晰列在异常 args 里，方便定位

### Bootstrap fail-fast 用 plain Error

`onModuleInit` 阶段 `AllExceptionsFilter` 尚未挂载，抛 `DomainException` 也只是被当作普通 Error 吃掉退出。直接 `throw new Error(...)` 简单清楚。这**不违反** `ruler/conventions.md §7` —— 该规则的范围是"业务异常"，bootstrap 失败不在其列。

## env 复用

Phase 1 复用 `QUANTIFY_UNIAPI_API_KEY` / `QUANTIFY_UNIAPI_BASE_URL` / `QUANTIFY_UNIAPI_DEFAULT_MODEL`。`MastraService` 与 `AiService` 平行读取同一组 env 互不影响。

迁移阶段如果需要灰度（同一调用点同时跑两条路径用不同 key 测对比），再开独立 `MASTRA_*` env 不迟。

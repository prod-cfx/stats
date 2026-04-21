# Remove Static Backtest Symbol Whitelists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `allowedSymbols` 这条错误路线，让回测 symbol 只来自 published snapshot truth，并由后端动态校验 symbol 是否可回测，再由前端展示中英文可读错误。

**Architecture:** 后端删除 `capabilities` 中的 symbol 白名单语义，新增统一的 `backtest symbol availability` 动态校验服务，并让 `symbols/check` 与 `create-job` 共享这套逻辑。前端不再基于 capability 白名单拦截 symbol，只从 snapshot 读取回测真相，并根据结构化错误码展示中文/英文用户提示。

**Tech Stack:** NestJS、Prisma、PostgreSQL、Jest、Next.js、TypeScript、i18next

---

## 文件结构与职责

### quantify / backtesting
- Modify: `apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts`
  - 删除 `BacktestCapabilitiesResponseDto.allowedSymbols`，新增/调整动态 symbol 校验错误 DTO 依赖。
- Modify: `apps/quantify/src/modules/backtesting/backtest-capability-config.ts`
  - 删除 `allowedSymbols` 配置解析与 legacy fallback。
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
  - `capabilities` 仅返回通用能力（如 timeframe），不再裁决 symbol。
- Modify: `apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts`
  - 删除对 `allowed_symbols` 的读取假设。
- Create: `apps/quantify/src/modules/backtesting/services/backtest-symbol-availability.service.ts`
  - 统一动态 symbol 校验入口，供 `symbols/check` 与 `create-job` 共用。
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.ts`
  - 改成调用统一 symbol availability service。
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts`
  - 提供动态 symbol/provider/data 可用性判断所需的读取逻辑。
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
  - `symbols/check` / `create-job` 统一走 snapshot truth + availability service。
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
  - `create-job` 最终执行前使用同一 availability service 做最终确认。
- Modify: `apps/quantify/src/modules/backtesting/dto/check-backtest-symbol.dto.ts`
  - 若当前 DTO 不够承载 snapshot-truth 驱动的校验参数，则补足。
- Modify: `apps/quantify/src/modules/backtesting/backtesting.module.ts`
  - 注册新的 availability service。
- Modify: `apps/quantify/src/modules/backtesting/services/__tests__/backtest-capabilities.service.spec.ts`
  - 覆盖删除 `allowedSymbols` 后的新 capabilities 语义。
- Create: `apps/quantify/src/modules/backtesting/services/__tests__/backtest-symbol-availability.service.spec.ts`
  - 覆盖动态 symbol 校验。
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.spec.ts`
  - 保护 `symbols/check` 使用统一动态逻辑。
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts`
  - 保护 create-job 最终校验。
- Modify: `apps/quantify/e2e/backtesting/backtesting.e2e-spec.ts`
  - 覆盖 snapshot-truth symbol + dynamic validation 主链路。

### quantify / schema / migration
- Modify: `apps/quantify/prisma/schema/backtesting_capabilities.prisma`
  - 删除 `allowedSymbols` 字段。
- Create: `apps/quantify/prisma/schema/migrations/<timestamp>_remove_backtest_capability_allowed_symbols/migration.sql`
  - 直接删除 `backtest_capability_configs.allowed_symbols`。

### front
- Modify: `apps/front/src/lib/backtesting-api.ts`
  - 删除 `BacktestCapabilities.allowedSymbols`，补错误码/错误元数据类型。
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
  - 删除 `allowedSymbols` 相关拦截；payload symbol 只来自 snapshot。
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
  - 不再基于 capability symbol 白名单阻断回测。
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - capability 仅保留通用能力；错误提示接入新错误码。
- Modify: `apps/front/src/components/ai-quant/ai-quant-error-stage.ts`
  - 增加新的 backtest symbol 动态错误码到用户可读信息映射。
- Modify: `apps/front/public/locales/zh/*.json`（按项目当前 i18n 文件组织）
  - 增加中文错误文案。
- Modify: `apps/front/public/locales/en/*.json`
  - 增加英文错误文案。
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`
  - 覆盖删除 `allowedSymbols` 后的 payload builder 行为。
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts*`（按现有测试文件落点）
  - 覆盖新的错误提示与 symbol-check 流程。

### contracts
- Modify: `packages/api-contracts/src/generated/quantify.ts`
  - regenerate，移除 `allowedSymbols`，纳入新的响应结构。
- Modify: `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`
  - 保护 contract 漂移。

---

### Task 1: 删除 `allowedSymbols` 的后端能力模型

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtest-capability-config.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts`
- Test: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts`

- [ ] **Step 1: 写 failing capabilities 测试，确认返回结果不再包含 symbol 白名单**

```ts
it('returns only generic backtest capabilities and never symbol whitelists', async () => {
  const repository = {
    findActiveConfig: jest.fn().mockResolvedValue({
      allowedBaseTimeframes: ['1h', '4h'],
      allowedSymbols: ['BTCUSDT'],
    }),
  }
  const service = new BacktestCapabilitiesService(repository as any)

  await expect(service.getCapabilities('req-1')).resolves.toEqual({
    allowedBaseTimeframes: ['1h', '4h'],
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/services/backtest-capabilities.service.spec.ts --runInBand
```

Expected:
- FAIL，因为当前实现仍会处理 `allowedSymbols`

- [ ] **Step 3: 删除 DTO 与 service 中的 `allowedSymbols` 语义**

```ts
// apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts
export class BacktestCapabilitiesResponseDto {
  @ApiProperty({ type: [String] })
  allowedBaseTimeframes!: string[]
}
```

```ts
// apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts
export interface BacktestCapabilitiesDto {
  allowedBaseTimeframes: string[]
}

const result = normalizeBacktestCapabilityConfig(config)
if (!result) {
  throw this.createUnavailableError('invalid_active_config')
}

return {
  allowedBaseTimeframes: result.allowedBaseTimeframes,
}
```

```ts
// apps/quantify/src/modules/backtesting/backtest-capability-config.ts
export function normalizeBacktestCapabilityConfig(config: Record<string, unknown>) {
  const allowedBaseTimeframes = normalizeConfiguredBacktestCapabilityTimeframes(
    config.allowedBaseTimeframes,
  )
  if (!allowedBaseTimeframes) {
    return null
  }
  return { allowedBaseTimeframes }
}
```

- [ ] **Step 4: 更新 repository / 旧 helper，使其不再依赖 `allowed_symbols`**

```ts
// 任何 capability config 读取只保留 generic capability 字段
const row = await prisma.backtestCapabilityConfig.findFirst({
  where: { isActive: true },
  orderBy: { updatedAt: 'desc' },
})
return row
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/services/backtest-capabilities.service.spec.ts --runInBand
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts apps/quantify/src/modules/backtesting/backtest-capability-config.ts apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts
git commit -m "refactor: remove symbol whitelists from backtest capabilities"
```

---

### Task 2: 新增统一的动态 symbol 校验服务

**Files:**
- Create: `apps/quantify/src/modules/backtesting/services/backtest-symbol-availability.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtesting.module.ts`
- Test: `apps/quantify/src/modules/backtesting/services/__tests__/backtest-symbol-availability.service.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.spec.ts`

- [ ] **Step 1: 写 failing availability service 测试**

```ts
it('treats snapshot symbol as supported when provider can resolve it dynamically', async () => {
  const marketData = {
    ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
  }
  const service = new BacktestSymbolAvailabilityService(marketData as any)

  await expect(service.check({
    exchange: 'okx',
    marketType: 'spot',
    symbol: 'ORDIUSDT',
    baseTimeframe: '1h',
  })).resolves.toEqual({ supported: true })
})

it('returns a structured reason when symbol is unavailable', async () => {
  const marketData = {
    ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({
      supported: false,
      reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
      args: { symbol: 'ORDIUSDT' },
    }),
  }
  const service = new BacktestSymbolAvailabilityService(marketData as any)

  await expect(service.check({
    exchange: 'okx',
    marketType: 'spot',
    symbol: 'ORDIUSDT',
    baseTimeframe: '1h',
  })).resolves.toEqual({
    supported: false,
    reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
    args: { symbol: 'ORDIUSDT' },
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/services/__tests__/backtest-symbol-availability.service.spec.ts --runInBand
```

Expected:
- FAIL，因为 service 还不存在

- [ ] **Step 3: 实现统一 availability service**

```ts
@Injectable()
export class BacktestSymbolAvailabilityService {
  constructor(private readonly marketDataService: BacktestMarketDataService) {}

  async check(input: {
    exchange: string
    marketType: 'spot' | 'perp'
    symbol: string
    baseTimeframe: string
  }): Promise<
    | { supported: true }
    | { supported: false; reasonCode: string; args?: Record<string, unknown> }
  > {
    return this.marketDataService.ensureBacktestSymbolAvailable(input)
  }
}
```

- [ ] **Step 4: 改造 `symbols/check`，让它只走动态校验服务**

```ts
// backtest-symbol-support.service.ts
return this.symbolAvailability.check({
  exchange,
  marketType,
  symbol,
  baseTimeframe: '1h',
})
```

并保持接口返回统一状态：
- supported
- not_supported / structured error

- [ ] **Step 5: 在 module 中注册 service**

```ts
providers: [
  BacktestSymbolAvailabilityService,
  BacktestSymbolSupportService,
]
```

- [ ] **Step 6: 运行测试确认通过**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/services/__tests__/backtest-symbol-availability.service.spec.ts src/modules/backtesting/services/backtest-symbol-support.service.spec.ts --runInBand
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/backtesting/services/backtest-symbol-availability.service.ts apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.ts apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts apps/quantify/src/modules/backtesting/backtesting.module.ts apps/quantify/src/modules/backtesting/services/__tests__/backtest-symbol-availability.service.spec.ts apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.spec.ts
git commit -m "feat: add dynamic backtest symbol availability checks"
```

---

### Task 3: 让 create-job 按 snapshot truth 做最终确认

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
- Test: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts`
- Test: `apps/quantify/e2e/backtesting/backtesting.e2e-spec.ts`

- [ ] **Step 1: 写 failing create-job 测试，确认最终仍会动态校验 symbol**

```ts
it('checks snapshot-bound symbol availability before creating a backtest job', async () => {
  const availability = {
    check: jest.fn().mockResolvedValue({ supported: true }),
  }
  const service = createJobsService({ availability })

  await service.createJob(input, 'user-1')

  expect(availability.check).toHaveBeenCalledWith(expect.objectContaining({
    symbol: 'ORDIUSDT',
    exchange: 'okx',
    marketType: 'spot',
    baseTimeframe: '1h',
  }))
})
```

- [ ] **Step 2: 写 failing create-job 测试，确认不支持时返回结构化业务错误**

```ts
await expect(service.createJob(input, 'user-1')).rejects.toMatchObject({
  message: 'backtesting.symbol_unavailable',
})
```

- [ ] **Step 3: 运行测试确认失败**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/jobs/backtest-jobs.service.spec.ts --runInBand
```

Expected:
- FAIL，因为 create-job 尚未接入统一 availability service

- [ ] **Step 4: 在 create-job 里调用统一动态校验**

```ts
const snapshotTruth = extractSnapshotTruth(strategy)
const availability = await this.symbolAvailability.check(snapshotTruth)
if (!availability.supported) {
  throw new DomainException('backtesting.symbol_unavailable', {
    code: ErrorCode.BAD_REQUEST,
    status: HttpStatus.BAD_REQUEST,
    args: availability.args,
  })
}
```

- [ ] **Step 5: 保证 `symbols/check` 与 `create-job` 共用同一逻辑，而不是复制**

检查并删除 duplicated checks，统一注入 `BacktestSymbolAvailabilityService`。

- [ ] **Step 6: 跑单测 + e2e**

Run:
```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/modules/backtesting/jobs/backtest-jobs.service.spec.ts --runInBand
pnpm --filter @net/quantify exec jest --config ./jest-e2e.json e2e/backtesting/backtesting.e2e-spec.ts --runInBand
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/backtesting/backtesting.controller.ts apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts apps/quantify/e2e/backtesting/backtesting.e2e-spec.ts
git commit -m "feat: enforce snapshot-truth symbol validation before backtest job creation"
```

---

### Task 4: 定义结构化错误码与中英文提示

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- Modify: `apps/front/src/components/ai-quant/ai-quant-error-stage.ts`
- Modify: `apps/front/src/lib/backtesting-api.ts`
- Modify: `apps/front/public/locales/zh/*.json`
- Modify: `apps/front/public/locales/en/*.json`
- Test: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts*`

- [ ] **Step 1: 定义错误码映射测试**

```ts
it('renders a user-readable zh message for BACKTEST_SYMBOL_UNAVAILABLE', () => {
  expect(renderBacktestError('BACKTEST_SYMBOL_UNAVAILABLE', { symbol: 'ORDIUSDT' }, 'zh'))
    .toContain('当前策略标的 ORDIUSDT 暂不支持回测')
})

it('renders a user-readable en message for BACKTEST_SYMBOL_UNAVAILABLE', () => {
  expect(renderBacktestError('BACKTEST_SYMBOL_UNAVAILABLE', { symbol: 'ORDIUSDT' }, 'en'))
    .toContain('Backtesting is not available for ORDIUSDT yet')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/front && npx jest --config ./jest.config.ts src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts* --runInBand
```

Expected:
- FAIL，因为错误码映射还没补齐

- [ ] **Step 3: 定义推荐错误码集合并接入前端映射**

后端统一使用：
- `BACKTEST_SNAPSHOT_REQUIRED`
- `BACKTEST_SNAPSHOT_SYMBOL_MISSING`
- `BACKTEST_SYMBOL_UNAVAILABLE`
- `BACKTEST_SYMBOL_REFRESH_FAILED`
- `BACKTEST_MARKET_DATA_UNAVAILABLE`
- `BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE`

前端 `ai-quant-error-stage.ts` 根据 code + args 渲染文案。

- [ ] **Step 4: 增加 zh/en 文案**

中文示例：
```json
{
  "aiQuant": {
    "messages": {
      "backtestSymbolUnavailable": "当前策略标的 {{symbol}} 暂不支持回测，请先确认该标的的历史行情能力是否已接入。"
    }
  }
}
```

英文示例：
```json
{
  "aiQuant": {
    "messages": {
      "backtestSymbolUnavailable": "Backtesting is not available for {{symbol}} yet. Please confirm that historical market data for this symbol has been enabled."
    }
  }
}
```

- [ ] **Step 5: 跑前端测试确认通过**

Run:
```bash
cd apps/front && npx jest --config ./jest.config.ts src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts* --runInBand
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/backtesting/backtesting.controller.ts apps/front/src/components/ai-quant/ai-quant-error-stage.ts apps/front/src/lib/backtesting-api.ts apps/front/public/locales/zh apps/front/public/locales/en
git commit -m "feat: show localized dynamic backtest availability errors"
```

---

### Task 5: 删除前端对白名单 symbol 的依赖

**Files:**
- Modify: `apps/front/src/lib/backtesting-api.ts`
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`
- Test: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts*`

- [ ] **Step 1: 写 failing payload builder / page tests**

```ts
it('does not reject snapshot symbol just because capabilities lack allowedSymbols', () => {
  expect(() => buildBacktestPayload({
    marketType: 'spot',
    symbol: 'ORDIUSDT',
    baseTimeframe: '1h',
    capabilities: { allowedBaseTimeframes: ['1h'] },
    stateTimeframes: [],
    initialCash: 10000,
    leverage: null,
    execution: { slippageBps: 5, feeBps: 2, priceSource: 'close' },
    strategy: { id: 'strategy-1', publishedSnapshotId: 'snapshot-1' },
    range: { preset: '7D' },
  })).not.toThrow()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/front && npx jest --config ./jest.config.ts src/components/ai-quant/backtest-payload-builder.test.ts src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts* --runInBand
```

Expected:
- FAIL，因为代码仍依赖旧 capability symbol 语义

- [ ] **Step 3: 删除 `allowedSymbols` 类型与引用**

```ts
export interface BacktestCapabilities {
  allowedBaseTimeframes: string[]
}
```

并清理前端所有 `allowedSymbols` 读取逻辑。

- [ ] **Step 4: 页面改为只读 snapshot truth + 调动态校验接口**

要求：
- symbol 只来自 snapshot
- 页面不再先做白名单判断
- 失败提示完全来自后端结构化错误

- [ ] **Step 5: 运行前端测试确认通过**

Run:
```bash
cd apps/front && npx jest --config ./jest.config.ts src/components/ai-quant/backtest-payload-builder.test.ts src/app/[lng]/ai-quant/ai-quant-page-backtest*.test.ts* --runInBand
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/front/src/lib/backtesting-api.ts apps/front/src/components/ai-quant/backtest-payload-builder.ts apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/backtest-payload-builder.test.ts
git commit -m "refactor: remove frontend dependency on backtest symbol whitelists"
```

---

### Task 6: 删除数据库中的 `allowed_symbols`

**Files:**
- Modify: `apps/quantify/prisma/schema/backtesting_capabilities.prisma`
- Create: `apps/quantify/prisma/schema/migrations/<timestamp>_remove_backtest_capability_allowed_symbols/migration.sql`
- Test: `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`
- Modify: `packages/api-contracts/src/generated/quantify.ts`

- [ ] **Step 1: 写 failing contract/schema assertions**

```ts
expect(source).not.toContain('allowedSymbols')
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
pnpm --filter @net/backend exec jest --config ./jest-unit.json src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts --runInBand
```

Expected:
- FAIL，因为 generated contract 仍包含旧字段

- [ ] **Step 3: 删除 schema 字段并编写 migration**

```prisma
model BacktestCapabilityConfig {
  id                    String   @id @default(cuid())
  allowedBaseTimeframes Json     @map("allowed_base_timeframes")
  isActive              Boolean  @default(true) @map("is_active")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@index([isActive, updatedAt], map: "idx_backtest_capability_configs_active_updated")
  @@map("backtest_capability_configs")
}
```

Migration SQL:
```sql
ALTER TABLE "backtest_capability_configs"
DROP COLUMN IF EXISTS "allowed_symbols";
```

- [ ] **Step 4: regenerate contract 并更新测试**

Run:
```bash
npx nx run quantify:swagger
node scripts/generate-quantify-contracts.mjs
pnpm --filter @net/backend exec jest --config ./jest-unit.json src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts --runInBand
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/prisma/schema/backtesting_capabilities.prisma apps/quantify/prisma/schema/migrations packages/api-contracts/src/generated/quantify.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
git commit -m "refactor: delete backtest allowedSymbols capability direction"
```

---

## Self-Review

### Spec coverage
- 删除 `allowedSymbols` 路线：Task 1 + Task 5 + Task 6
- snapshot truth 作为 symbol 来源：Task 3 + Task 5
- 后端动态校验：Task 2 + Task 3
- 中英文用户提示：Task 4
- `symbols/check` / `create-job` 共用逻辑：Task 2 + Task 3

### Placeholder scan
- 无 `TODO` / `TBD`
- 每个任务均给出明确文件、代码片段、命令与期望结果

### Type consistency
- `BacktestCapabilities` 最终仅保留 `allowedBaseTimeframes`
- 动态错误码由后端结构化输出，前端统一映射
- `BacktestSymbolAvailabilityService` 是唯一 symbol 准入逻辑源


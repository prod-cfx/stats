# Strategy Plaza Public Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public beta strategy plaza so users can browse 6 official OKX demo strategies, run one directly into a `running` AI Quant strategy, or edit one through the existing AI Quant conversation flow.

**Architecture:** Add a user-facing `strategy-plaza` module in `apps/quantify` that owns official template metadata, OKX demo-account validation, run idempotency, and edit-session seeding. Update `apps/front` to load plaza templates from the backend instead of local mock presets, then wire run/edit buttons to the new API while preserving existing login intent behavior.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict mode, Next.js 16, React 19, Vitest/Jest, OpenAPI-generated `@ai/api-contracts`, `dx` commands.

---

## File Structure

Backend files:

- Create `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts` for template and response domain types.
- Create `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts` for the six public beta template definitions.
- Create `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts` for list/detail API response DTOs.
- Create `apps/quantify/src/modules/strategy-plaza/dto/run-strategy-plaza-template.dto.ts` for `runRequestId`.
- Create `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-edit-session.response.dto.ts` for edit-session responses.
- Create `apps/quantify/src/modules/strategy-plaza/exceptions/*.exception.ts` for typed domain failures.
- Create `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.ts` for read-only template lookup and response mapping.
- Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.ts` for OKX demo API key validation and deployment.
- Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.ts` for AI Quant conversation seeding.
- Create `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.ts` for public endpoints.
- Create `apps/quantify/src/modules/strategy-plaza/strategy-plaza.module.ts` and import it from `apps/quantify/src/modules/app.module.ts`.
- Modify `apps/quantify/src/modules/exchange-accounts/repositories/exchange-account.repository.ts` to expose latest OKX demo account lookup.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts` only if extra provider exports are needed for edit-session creation.
- Modify `apps/quantify/src/modules/account-strategy-view/account-strategy-view.module.ts` only if run service needs an exported provider already present there.

Frontend files:

- Create `apps/front/src/lib/api-strategy-plaza-domain.ts` for API types and requests.
- Modify `apps/front/src/lib/api.ts` to export strategy plaza APIs and types.
- Modify `apps/front/src/components/ai-quant/intent-storage.ts` to support strategy plaza run/edit intents.
- Modify `apps/front/src/components/ai-quant/StrategyPlaza.tsx` to render API templates instead of local mock presets.
- Modify `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx` to load templates and call run/edit APIs.
- Modify `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx` to consume edit-session intent and open the seeded conversation.
- Modify `apps/front/src/app/[lng]/account/AccountPageClient.tsx` only if API-key binding needs to resume a pending plaza run after save.

Test files:

- Create `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`.
- Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts`.
- Create `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`.
- Create `apps/front/src/lib/api-strategy-plaza-domain.test.ts`.
- Create `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`.
- Create `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx`.

---

## Implementation Tasks

### Task 1: Backend Template Domain And DTOs

**Files:**

- Create: `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/dto/run-strategy-plaza-template.dto.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-edit-session.response.dto.ts`
- Test: `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`

- [ ] **Step 1: Write the template service failing test**

Create `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`:

```ts
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

describe('OfficialStrategyPlazaTemplateService', () => {
  const service = new OfficialStrategyPlazaTemplateService()

  it('returns exactly the six public beta templates in display order', () => {
    const templates = service.list()

    expect(templates.map(item => item.id)).toEqual([
      'ma-cross',
      'bollinger-reversion',
      'grid-range',
      'rsi-reversal',
      'breakout-follow',
      'macd-cross',
    ])
    expect(templates.every(item => item.exchange === 'okx')).toBe(true)
    expect(templates.every(item => item.environment === 'demo')).toBe(true)
    expect(templates.every(item => item.status === 'live')).toBe(true)
  })

  it('exposes fixed run parameters without user override fields', () => {
    const template = service.getRequired('macd-cross')

    expect(template.runConfig).toMatchObject({
      exchange: 'okx',
      symbol: expect.any(String),
      marketType: expect.stringMatching(/^(spot|perp)$/),
      timeframe: expect.any(String),
      positionPct: expect.any(Number),
    })
    expect(Object.keys(template.runConfig)).toEqual([
      'exchange',
      'marketType',
      'symbol',
      'timeframe',
      'positionPct',
      'leverage',
      'publishedSnapshotId',
      'deploymentExecutionConfig',
    ])
  })
})
```

- [ ] **Step 2: Run the failing backend unit test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
```

Expected: FAIL because `official-strategy-plaza-template.service.ts` does not exist.

- [ ] **Step 3: Add template domain types**

Create `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`:

```ts
export type StrategyPlazaTemplateId =
  | 'ma-cross'
  | 'bollinger-reversion'
  | 'grid-range'
  | 'rsi-reversal'
  | 'breakout-follow'
  | 'macd-cross'

export type StrategyPlazaMarketType = 'spot' | 'perp'
export type StrategyPlazaRiskLevel = 'low' | 'medium' | 'high'
export type StrategyPlazaTemplateStatus = 'live' | 'hidden'

export interface OfficialStrategyPlazaRunConfig {
  exchange: 'okx'
  marketType: StrategyPlazaMarketType
  symbol: string
  timeframe: string
  positionPct: number
  leverage: number | null
  publishedSnapshotId: string
  deploymentExecutionConfig: {
    leverage?: number | null
    priceSource?: string | null
    orderType?: string | null
    timeInForce?: string | null
  }
}

export interface OfficialStrategyPlazaEditSeed {
  initialMessage: string
  guideConfig?: {
    exchange?: 'okx'
    symbol?: string
    timeframe?: string
    positionPct?: number
  }
}

export interface OfficialStrategyPlazaTemplate {
  id: StrategyPlazaTemplateId
  name: string
  description: string
  logicDescription: string
  tags: string[]
  riskLevel: StrategyPlazaRiskLevel
  scenario: string
  exchange: 'okx'
  environment: 'demo'
  status: StrategyPlazaTemplateStatus
  displayOrder: number
  runConfig: OfficialStrategyPlazaRunConfig
  editSeed: OfficialStrategyPlazaEditSeed
  displayMetrics: {
    label: 'official_sample_backtest'
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
  }
}
```

- [ ] **Step 4: Add the six official template constants**

Create `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts`:

```ts
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'

export const OFFICIAL_STRATEGY_PLAZA_TEMPLATES: OfficialStrategyPlazaTemplate[] = [
  {
    id: 'ma-cross',
    name: 'MA 均线交叉',
    description: '短均线上穿长均线做多，跌回长均线下方退出。',
    logicDescription: '使用 20/60 均线判断趋势方向，适合趋势初期跟随。',
    tags: ['趋势跟随', '均线', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势行情',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 10,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT-SWAP 15m，创建一个 MA 20/60 均线交叉趋势跟随策略，仓位 10%，2 倍杠杆。',
      guideConfig: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m', positionPct: 10 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
  {
    id: 'bollinger-reversion',
    name: '布林带均值回归',
    description: '价格触及布林带外轨后等待回归，中轨附近止盈。',
    logicDescription: '使用 20 周期、2 倍标准差布林带识别偏离和回归。',
    tags: ['均值回归', '布林带', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '震荡偏离后回归',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 20,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ETH-USDT-SWAP',
      timeframe: '15m',
      positionPct: 8,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-bollinger-reversion-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT-SWAP 15m，创建布林带均值回归策略，触及外轨后回归中轨止盈，仓位 8%，2 倍杠杆。',
      guideConfig: { exchange: 'okx', symbol: 'ETH-USDT-SWAP', timeframe: '15m', positionPct: 8 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
  {
    id: 'grid-range',
    name: '网格区间',
    description: '在震荡区间内低买高卖，适合方向不明显的行情。',
    logicDescription: '使用固定区间和网格间距执行现货低买高卖。',
    tags: ['网格', '现货', 'OKX 模拟盘'],
    riskLevel: 'low',
    scenario: '区间震荡',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 30,
    runConfig: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTC-USDT',
      timeframe: '15m',
      positionPct: 10,
      leverage: null,
      publishedSnapshotId: 'official-plaza-grid-range-v1-snapshot',
      deploymentExecutionConfig: { leverage: null, priceSource: 'last', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT 现货 15m，创建网格区间策略，在震荡区间内低买高卖，单次仓位 10%。',
      guideConfig: { exchange: 'okx', symbol: 'BTC-USDT', timeframe: '15m', positionPct: 10 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
  {
    id: 'rsi-reversal',
    name: 'RSI 超买超卖',
    description: 'RSI 低位买入，高位退出，适合短周期反转。',
    logicDescription: '使用 RSI 14，低于 30 视为超卖，高于 70 视为超买。',
    tags: ['RSI', '反转', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '短周期反转',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 40,
    runConfig: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETH-USDT',
      timeframe: '15m',
      positionPct: 8,
      leverage: null,
      publishedSnapshotId: 'official-plaza-rsi-reversal-v1-snapshot',
      deploymentExecutionConfig: { leverage: null, priceSource: 'last', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 14 超买超卖策略，RSI 低于 30 买入，高于 70 卖出，仓位 8%。',
      guideConfig: { exchange: 'okx', symbol: 'ETH-USDT', timeframe: '15m', positionPct: 8 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
  {
    id: 'breakout-follow',
    name: '突破追踪',
    description: '价格突破近期区间后跟随趋势，跌回区间则退出。',
    logicDescription: '使用近期高点突破作为入场信号，适合波动扩张。',
    tags: ['突破', '趋势', 'OKX 模拟盘'],
    riskLevel: 'high',
    scenario: '波动扩张',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 50,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '5m',
      positionPct: 8,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-breakout-follow-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT-SWAP 5m，创建突破追踪策略，突破近期高点跟随，跌回区间退出，仓位 8%，2 倍杠杆。',
      guideConfig: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '5m', positionPct: 8 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
  {
    id: 'macd-cross',
    name: 'MACD 金叉死叉',
    description: 'MACD 金叉做多，死叉退出，适合趋势确认。',
    logicDescription: '使用 MACD 12/26/9 判断趋势动能变化。',
    tags: ['MACD', '动能', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势确认',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 60,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ETH-USDT-SWAP',
      timeframe: '15m',
      positionPct: 8,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-macd-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT-SWAP 15m，创建 MACD 12/26/9 金叉死叉策略，金叉做多，死叉退出，仓位 8%，2 倍杠杆。',
      guideConfig: { exchange: 'okx', symbol: 'ETH-USDT-SWAP', timeframe: '15m', positionPct: 8 },
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  },
]
```

- [ ] **Step 5: Add DTOs**

Create `apps/quantify/src/modules/strategy-plaza/dto/run-strategy-plaza-template.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class RunStrategyPlazaTemplateDto {
  @ApiProperty({ description: '幂等运行请求 ID' })
  @IsString()
  @MinLength(8)
  runRequestId!: string
}
```

Create `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`:

```ts
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class StrategyPlazaTemplateResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  description!: string

  @ApiProperty()
  logicDescription!: string

  @ApiProperty({ type: [String] })
  tags!: string[]

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  riskLevel!: 'low' | 'medium' | 'high'

  @ApiProperty()
  scenario!: string

  @ApiProperty({ enum: ['okx'] })
  exchange!: 'okx'

  @ApiProperty({ enum: ['demo'] })
  environment!: 'demo'

  @ApiProperty({ enum: ['spot', 'perp'] })
  marketType!: 'spot' | 'perp'

  @ApiProperty()
  symbol!: string

  @ApiProperty()
  timeframe!: string

  @ApiProperty()
  positionPct!: number

  @ApiPropertyOptional({ nullable: true })
  leverage!: number | null

  @ApiProperty({ enum: ['live', 'hidden'] })
  status!: 'live' | 'hidden'

  @ApiProperty()
  displayOrder!: number

  @ApiProperty({
    type: 'object',
    properties: {
      label: { type: 'string', enum: ['official_sample_backtest'] },
      returnPct: { type: 'number', nullable: true },
      winRatePct: { type: 'number', nullable: true },
      maxDrawdownPct: { type: 'number', nullable: true },
    },
  })
  displayMetrics!: OfficialStrategyPlazaTemplate['displayMetrics']

  constructor(template: OfficialStrategyPlazaTemplate) {
    this.id = template.id
    this.name = template.name
    this.description = template.description
    this.logicDescription = template.logicDescription
    this.tags = template.tags
    this.riskLevel = template.riskLevel
    this.scenario = template.scenario
    this.exchange = template.exchange
    this.environment = template.environment
    this.marketType = template.runConfig.marketType
    this.symbol = template.runConfig.symbol
    this.timeframe = template.runConfig.timeframe
    this.positionPct = template.runConfig.positionPct
    this.leverage = template.runConfig.leverage
    this.status = template.status
    this.displayOrder = template.displayOrder
    this.displayMetrics = template.displayMetrics
  }
}
```

Create `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-edit-session.response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'

export class StrategyPlazaEditSessionResponseDto {
  @ApiProperty()
  sessionId!: string

  @ApiProperty()
  templateId!: string

  @ApiProperty()
  initialMessage!: string
}
```

- [ ] **Step 6: Add the template service**

Create `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaTemplateNotFoundException } from '../exceptions/strategy-plaza-template-not-found.exception'

@Injectable()
export class OfficialStrategyPlazaTemplateService {
  list() {
    return [...OFFICIAL_STRATEGY_PLAZA_TEMPLATES]
      .filter(item => item.status === 'live')
      .sort((left, right) => left.displayOrder - right.displayOrder)
  }

  getRequired(id: string) {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === id)
    if (!template || template.status !== 'live') {
      throw new StrategyPlazaTemplateNotFoundException({ templateId: id })
    }
    return template
  }
}
```

- [ ] **Step 7: Add the first exception used by the service**

Create `apps/quantify/src/modules/strategy-plaza/exceptions/strategy-plaza-template-not-found.exception.ts`:

```ts
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaTemplateNotFoundException extends DomainException {
  constructor(args: { templateId: string }) {
    super('strategy_plaza.template_not_found', {
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args,
    })
  }
}
```

Create `apps/quantify/src/modules/strategy-plaza/exceptions/index.ts`:

```ts
export * from './strategy-plaza-template-not-found.exception'
```

- [ ] **Step 8: Run the template service test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add apps/quantify/src/modules/strategy-plaza
git commit -m "feat: add official strategy plaza templates" -m "Refs: #881"
```

### Task 2: Backend Run Service And OKX Demo Account Lookup

**Files:**

- Modify: `apps/quantify/src/modules/exchange-accounts/repositories/exchange-account.repository.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/exceptions/strategy-plaza-okx-demo-api-key-required.exception.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.ts`
- Test: `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts`

- [ ] **Step 1: Write the run service failing tests**

Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts`:

```ts
import { StrategyPlazaOkxDemoApiKeyRequiredException } from '../exceptions'
import { StrategyPlazaRunService } from './strategy-plaza-run.service'

describe('StrategyPlazaRunService', () => {
  const template = {
    id: 'ma-cross',
    name: 'MA 均线交叉',
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
  } as any

  function buildService(overrides?: {
    account?: { id: string; name: string } | null
    deployResult?: unknown
  }) {
    return new StrategyPlazaRunService(
      { getRequired: jest.fn().mockReturnValue(template) } as any,
      {
        findLatestOkxDemoAccountForUser: jest.fn().mockResolvedValue(overrides?.account ?? { id: 'acct-okx-demo', name: 'OKX Demo' }),
      } as any,
      {
        deployStrategy: jest.fn().mockResolvedValue(overrides?.deployResult ?? { id: 'strategy-1', status: 'running' }),
      } as any,
    )
  }

  it('requires an OKX demo API key before running', async () => {
    const service = buildService({ account: null })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).rejects.toBeInstanceOf(StrategyPlazaOkxDemoApiKeyRequiredException)
  })

  it('deploys with template-owned parameters only', async () => {
    const service = buildService()

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })

    const accountStrategyService = (service as any).accountStrategyViewService
    expect(accountStrategyService.deployStrategy).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'MA 均线交叉',
      deployRequestId: 'plaza:ma-cross:run-123456',
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      exchangeAccountId: 'acct-okx-demo',
      exchangeAccountName: 'OKX Demo',
      mode: 'TESTNET',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    })
  })
})
```

- [ ] **Step 2: Run the failing run service test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts
```

Expected: FAIL because `StrategyPlazaRunService` does not exist.

- [ ] **Step 3: Add OKX demo account lookup**

Modify `apps/quantify/src/modules/exchange-accounts/repositories/exchange-account.repository.ts`:

```ts
  async findLatestOkxDemoAccountForUser(userId: string): Promise<Pick<ExchangeAccount, 'id' | 'name'> | null> {
    const client = this.txHost.tx
    return client.exchangeAccount.findFirst({
      where: {
        userId,
        exchangeId: 'okx',
        isTestnet: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    })
  }
```

- [ ] **Step 4: Add OKX demo API key exception**

Create `apps/quantify/src/modules/strategy-plaza/exceptions/strategy-plaza-okx-demo-api-key-required.exception.ts`:

```ts
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOkxDemoApiKeyRequiredException extends DomainException {
  constructor(args: { userId: string }) {
    super('strategy_plaza.okx_demo_api_key_required', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}
```

Modify `apps/quantify/src/modules/strategy-plaza/exceptions/index.ts`:

```ts
export * from './strategy-plaza-okx-demo-api-key-required.exception'
export * from './strategy-plaza-template-not-found.exception'
```

- [ ] **Step 5: Add the run service**

Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { AccountStrategyViewService } from '@/modules/account-strategy-view/services/account-strategy-view.service'
import { ExchangeAccountRepository } from '@/modules/exchange-accounts/repositories/exchange-account.repository'
import { StrategyPlazaOkxDemoApiKeyRequiredException } from '../exceptions'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

@Injectable()
export class StrategyPlazaRunService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly exchangeAccounts: ExchangeAccountRepository,
    private readonly accountStrategyViewService: AccountStrategyViewService,
  ) {}

  async runTemplate(input: {
    userId: string
    templateId: string
    runRequestId: string
  }) {
    const template = this.templates.getRequired(input.templateId)
    const account = await this.exchangeAccounts.findLatestOkxDemoAccountForUser(input.userId)
    if (!account) {
      throw new StrategyPlazaOkxDemoApiKeyRequiredException({ userId: input.userId })
    }

    return this.accountStrategyViewService.deployStrategy({
      userId: input.userId,
      name: template.name,
      deployRequestId: `plaza:${template.id}:${input.runRequestId}`,
      publishedSnapshotId: template.runConfig.publishedSnapshotId,
      exchangeAccountId: account.id,
      exchangeAccountName: account.name,
      mode: 'TESTNET',
      deploymentExecutionConfig: template.runConfig.deploymentExecutionConfig,
    })
  }
}
```

- [ ] **Step 6: Run the run service test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/quantify/src/modules/strategy-plaza apps/quantify/src/modules/exchange-accounts/repositories/exchange-account.repository.ts
git commit -m "feat: add strategy plaza run service" -m "Refs: #881"
```

### Task 3: Backend Controller, Module Wiring, And Edit Session

**Files:**

- Create: `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.ts`
- Create: `apps/quantify/src/modules/strategy-plaza/strategy-plaza.module.ts`
- Modify: `apps/quantify/src/modules/app.module.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
- Test: `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`

- [ ] **Step 1: Export the codegen caller identity service**

Modify `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`:

```ts
  exports: [CallerIdentityService, CodegenConversationService],
```

- [ ] **Step 2: Write controller tests**

Create `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`:

```ts
import { StrategyPlazaController } from './strategy-plaza.controller'

describe('StrategyPlazaController', () => {
  const template = { id: 'ma-cross' } as any

  function buildController() {
    return new StrategyPlazaController(
      {
        list: jest.fn().mockReturnValue([template]),
        getRequired: jest.fn().mockReturnValue(template),
      } as any,
      { runTemplate: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'running' }) } as any,
      { startEditSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', templateId: 'ma-cross', initialMessage: 'seed' }) } as any,
      { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') } as any,
    )
  }

  it('lists public templates without auth', () => {
    const controller = buildController()

    const result = controller.list()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ma-cross')
  })

  it('runs a template for the authenticated user', async () => {
    const controller = buildController()

    await controller.run('ma-cross', { runRequestId: 'run-123456' }, 'Bearer token', undefined)

    expect((controller as any).runService.runTemplate).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })
  })

  it('starts edit session for the authenticated user', async () => {
    const controller = buildController()

    await controller.editSession('ma-cross', 'Bearer token', undefined)

    expect((controller as any).editSessionService.startEditSession).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
    })
  })
})
```

- [ ] **Step 3: Run the failing controller test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
```

Expected: FAIL because `strategy-plaza.controller.ts` does not exist.

- [ ] **Step 4: Add edit-session service**

Create `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { CodegenConversationService } from '@/modules/llm-strategy-codegen/services/codegen-conversation.service'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

@Injectable()
export class StrategyPlazaEditSessionService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly codegenConversationService: CodegenConversationService,
  ) {}

  async startEditSession(input: { userId: string; templateId: string }) {
    const template = this.templates.getRequired(input.templateId)
    const session = await this.codegenConversationService.startSession({
      initialMessage: template.editSeed.initialMessage,
      guideConfig: template.editSeed.guideConfig,
    }, input.userId)

    return {
      sessionId: session.id,
      templateId: template.id,
      initialMessage: template.editSeed.initialMessage,
    }
  }
}
```

- [ ] **Step 5: Add controller**

Create `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.ts`:

```ts
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { RunStrategyPlazaTemplateDto } from '../dto/run-strategy-plaza-template.dto'
import { StrategyPlazaEditSessionResponseDto } from '../dto/strategy-plaza-edit-session.response.dto'
import { StrategyPlazaTemplateResponseDto } from '../dto/strategy-plaza-template.response.dto'
import { OfficialStrategyPlazaTemplateService } from '../services/official-strategy-plaza-template.service'
import { StrategyPlazaEditSessionService } from '../services/strategy-plaza-edit-session.service'
import { StrategyPlazaRunService } from '../services/strategy-plaza-run.service'

@ApiTags('strategy-plaza')
@ApiExtraModels(StrategyPlazaTemplateResponseDto, RunStrategyPlazaTemplateDto, StrategyPlazaEditSessionResponseDto)
@Controller('strategy-plaza/templates')
export class StrategyPlazaController {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly runService: StrategyPlazaRunService,
    private readonly editSessionService: StrategyPlazaEditSessionService,
    private readonly callerIdentityService: CallerIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '查询策略广场官方模板列表' })
  @ApiOkResponse({ type: [StrategyPlazaTemplateResponseDto] })
  list(): StrategyPlazaTemplateResponseDto[] {
    return this.templates.list().map(item => new StrategyPlazaTemplateResponseDto(item))
  }

  @Get(':id')
  @ApiOperation({ summary: '查询策略广场官方模板详情' })
  @ApiOkResponse({ type: StrategyPlazaTemplateResponseDto })
  detail(@Param('id') id: string): StrategyPlazaTemplateResponseDto {
    return new StrategyPlazaTemplateResponseDto(this.templates.getRequired(id))
  }

  @Post(':id/run')
  @ApiOperation({ summary: '运行策略广场官方模板' })
  async run(
    @Param('id') id: string,
    @Body() dto: RunStrategyPlazaTemplateDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ) {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.runService.runTemplate({ userId, templateId: id, runRequestId: dto.runRequestId })
  }

  @Post(':id/edit-session')
  @ApiOperation({ summary: '基于策略广场官方模板创建编辑会话' })
  @ApiOkResponse({ type: StrategyPlazaEditSessionResponseDto })
  async editSession(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<StrategyPlazaEditSessionResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.editSessionService.startEditSession({ userId, templateId: id })
  }
}
```

- [ ] **Step 6: Add module and import it**

Create `apps/quantify/src/modules/strategy-plaza/strategy-plaza.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { AccountStrategyViewModule } from '@/modules/account-strategy-view/account-strategy-view.module'
import { ExchangeAccountsModule } from '@/modules/exchange-accounts/exchange-accounts.module'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { StrategyPlazaController } from './controllers/strategy-plaza.controller'
import { OfficialStrategyPlazaTemplateService } from './services/official-strategy-plaza-template.service'
import { StrategyPlazaEditSessionService } from './services/strategy-plaza-edit-session.service'
import { StrategyPlazaRunService } from './services/strategy-plaza-run.service'

@Module({
  imports: [AccountStrategyViewModule, ExchangeAccountsModule, LlmStrategyCodegenModule],
  controllers: [StrategyPlazaController],
  providers: [
    OfficialStrategyPlazaTemplateService,
    StrategyPlazaRunService,
    StrategyPlazaEditSessionService,
  ],
})
export class StrategyPlazaModule {}
```

Modify `apps/quantify/src/modules/exchange-accounts/exchange-accounts.module.ts`:

```ts
  exports: [ExchangeAccountRepository, ExchangeAccountsService],
```

Modify `apps/quantify/src/modules/app.module.ts`:

```ts
import { StrategyPlazaModule } from './strategy-plaza/strategy-plaza.module'
```

Add `StrategyPlazaModule` in the imports list after `StrategyTemplatesModule`.

- [ ] **Step 7: Run controller test and build**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
dx build quantify --dev
```

Expected: both PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add apps/quantify/src/modules apps/quantify/src/modules/app.module.ts
git commit -m "feat: expose strategy plaza api" -m "Refs: #881"
```

### Task 4: Frontend API Client And Types

**Files:**

- Create: `apps/front/src/lib/api-strategy-plaza-domain.ts`
- Modify: `apps/front/src/lib/api.ts`
- Test: `apps/front/src/lib/api-strategy-plaza-domain.test.ts`

- [ ] **Step 1: Write frontend API tests**

Create `apps/front/src/lib/api-strategy-plaza-domain.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStrategyPlazaRunRequestId,
  fetchStrategyPlazaTemplates,
  runStrategyPlazaTemplate,
  startStrategyPlazaEditSession,
} from './api-strategy-plaza-domain'

describe('strategy plaza API domain', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches strategy plaza templates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'ma-cross' }] }), { status: 200 }))

    const result = await fetchStrategyPlazaTemplates()

    expect(result).toEqual([{ id: 'ma-cross' }])
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/strategy-plaza/templates'), expect.objectContaining({ method: 'GET' }))
  })

  it('runs a template with only runRequestId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'strategy-1' } }), { status: 200 }))

    await runStrategyPlazaTemplate('ma-cross', 'run-123456')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/strategy-plaza/templates/ma-cross/run'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ runRequestId: 'run-123456' }),
      }),
    )
  })

  it('starts edit session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: { sessionId: 'session-1' } }), { status: 200 }))

    const result = await startStrategyPlazaEditSession('ma-cross')

    expect(result).toEqual({ sessionId: 'session-1' })
  })

  it('creates stable run request ids with plaza prefix', () => {
    expect(createStrategyPlazaRunRequestId()).toMatch(/^plaza-run-/)
  })
})
```

- [ ] **Step 2: Run failing API test**

Run:

```bash
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
```

Expected: FAIL because `api-strategy-plaza-domain.ts` does not exist.

- [ ] **Step 3: Add strategy plaza API client**

Create `apps/front/src/lib/api-strategy-plaza-domain.ts`:

```ts
import type { AccountAiQuantStrategyDetail } from './api'
import { API_BASE_URL, ApiError, apiCall, optionalAuthHeaders, requireAuthHeaders, unwrapResponse } from './api-access'

export interface StrategyPlazaTemplate {
  id: string
  name: string
  description: string
  logicDescription: string
  tags: string[]
  riskLevel: 'low' | 'medium' | 'high'
  scenario: string
  exchange: 'okx'
  environment: 'demo'
  marketType: 'spot' | 'perp'
  symbol: string
  timeframe: string
  positionPct: number
  leverage: number | null
  status: 'live' | 'hidden'
  displayOrder: number
  displayMetrics: {
    label: 'official_sample_backtest'
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
  }
}

export interface StrategyPlazaEditSessionResponse {
  sessionId: string
  templateId: string
  initialMessage: string
}

async function parseStrategyPlazaJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    const message = json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
      ? json.message
      : fallbackMessage
    const code = json && typeof json === 'object' && 'error' in json
      ? String((json as { error?: { code?: unknown } }).error?.code ?? 'STRATEGY_PLAZA_REQUEST_FAILED')
      : 'STRATEGY_PLAZA_REQUEST_FAILED'
    throw new ApiError(message, code, response.status, json)
  }

  return unwrapResponse<T>(json as T | { data?: T; message?: string })
}

export function createStrategyPlazaRunRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `plaza-run-${crypto.randomUUID()}`
  }
  return `plaza-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function fetchStrategyPlazaTemplates(): Promise<StrategyPlazaTemplate[]> {
  return apiCall(async () => {
    const response = await fetch(`${API_BASE_URL}/strategy-plaza/templates`, {
      method: 'GET',
      headers: optionalAuthHeaders(),
    })
    return parseStrategyPlazaJson<StrategyPlazaTemplate[]>(response, '获取策略广场失败')
  }, 'FETCH_STRATEGY_PLAZA_TEMPLATES')
}

export async function runStrategyPlazaTemplate(
  templateId: string,
  runRequestId: string,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    const response = await fetch(`${API_BASE_URL}/strategy-plaza/templates/${encodeURIComponent(templateId)}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...requireAuthHeaders(),
      },
      body: JSON.stringify({ runRequestId }),
    })
    return parseStrategyPlazaJson<AccountAiQuantStrategyDetail>(response, '运行策略失败')
  }, 'RUN_STRATEGY_PLAZA_TEMPLATE')
}

export async function startStrategyPlazaEditSession(templateId: string): Promise<StrategyPlazaEditSessionResponse> {
  return apiCall(async () => {
    const response = await fetch(`${API_BASE_URL}/strategy-plaza/templates/${encodeURIComponent(templateId)}/edit-session`, {
      method: 'POST',
      headers: requireAuthHeaders(),
    })
    return parseStrategyPlazaJson<StrategyPlazaEditSessionResponse>(response, '创建策略编辑会话失败')
  }, 'START_STRATEGY_PLAZA_EDIT_SESSION')
}
```

- [ ] **Step 4: Export API symbols**

Modify `apps/front/src/lib/api.ts`:

```ts
export {
  createStrategyPlazaRunRequestId,
  fetchStrategyPlazaTemplates,
  runStrategyPlazaTemplate,
  startStrategyPlazaEditSession,
  type StrategyPlazaEditSessionResponse,
  type StrategyPlazaTemplate,
} from './api-strategy-plaza-domain'
```

- [ ] **Step 5: Run frontend API test**

Run:

```bash
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/front/src/lib/api-strategy-plaza-domain.ts apps/front/src/lib/api-strategy-plaza-domain.test.ts apps/front/src/lib/api.ts
git commit -m "feat: add strategy plaza frontend api" -m "Refs: #881"
```

### Task 5: Frontend Strategy Plaza Rendering And Run/Edit Actions

**Files:**

- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/intent-storage.ts`
- Test: `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx`

- [ ] **Step 1: Add strategy plaza intent type**

Modify `apps/front/src/components/ai-quant/intent-storage.ts`:

```ts
export type QuantReturnIntent =
  | { type: 'run', strategyId: string, ts?: number }
  | { type: 'edit', strategyId: string, ts?: number }
  | { type: 'plaza-run', templateId: string, ts?: number }
  | { type: 'plaza-edit', templateId: string, ts?: number }
  | { type: 'chat', draft: string, ts?: number }

export type QuantReturnIntentInput =
  | { type: 'run', strategyId: string }
  | { type: 'edit', strategyId: string }
  | { type: 'plaza-run', templateId: string }
  | { type: 'plaza-edit', templateId: string }
  | { type: 'chat', draft: string }
```

- [ ] **Step 2: Write StrategyPlaza rendering test**

Create `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`:

```tsx
import type { StrategyPlazaTemplate } from '@/lib/api'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StrategyPlaza } from './StrategyPlaza'

describe('StrategyPlaza API templates', () => {
  const templates: StrategyPlazaTemplate[] = [{
    id: 'ma-cross',
    name: 'MA 均线交叉',
    description: '短均线上穿长均线做多',
    logicDescription: 'MA 20/60 趋势跟随',
    tags: ['趋势跟随', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势行情',
    exchange: 'okx',
    environment: 'demo',
    marketType: 'perp',
    symbol: 'BTC-USDT-SWAP',
    timeframe: '15m',
    positionPct: 10,
    leverage: 2,
    status: 'live',
    displayOrder: 10,
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  }]

  it('renders backend templates without fake performance metrics', () => {
    render(<StrategyPlaza templates={templates} loading={false} onRunStrategy={vi.fn()} onEditStrategy={vi.fn()} />)

    expect(screen.getByText('MA 均线交叉')).toBeInTheDocument()
    expect(screen.getByText('OKX 模拟盘')).toBeInTheDocument()
    expect(screen.getByText('BTC-USDT-SWAP / 15m')).toBeInTheDocument()
    expect(screen.queryByText('+12.5%')).not.toBeInTheDocument()
  })

  it('emits run and edit actions with template id', () => {
    const onRunStrategy = vi.fn()
    const onEditStrategy = vi.fn()
    render(<StrategyPlaza templates={templates} loading={false} onRunStrategy={onRunStrategy} onEditStrategy={onEditStrategy} />)

    fireEvent.click(screen.getByRole('button', { name: /运行/ }))
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }))

    expect(onRunStrategy).toHaveBeenCalledWith('ma-cross')
    expect(onEditStrategy).toHaveBeenCalledWith('ma-cross')
  })
})
```

- [ ] **Step 3: Run failing StrategyPlaza test**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
```

Expected: FAIL because `StrategyPlaza` still expects local preset callbacks.

- [ ] **Step 4: Update StrategyPlaza component signature**

Modify `apps/front/src/components/ai-quant/StrategyPlaza.tsx` so its props are:

```tsx
import type { StrategyPlazaTemplate } from '@/lib/api'

interface StrategyPlazaProps {
  templates: StrategyPlazaTemplate[]
  loading: boolean
  error?: string | null
  onRunStrategy: (templateId: string) => void
  onEditStrategy: (templateId: string) => void
  subtitle?: string
}
```

Render from `templates.map(item => ...)`, and use this summary block:

```tsx
<div className="mt-4 rounded-xl bg-[color:var(--cf-bg)] px-3 py-2 text-xs text-[color:var(--cf-muted)]">
  <div className="font-semibold text-[color:var(--cf-text-strong)]">
    {item.symbol} / {item.timeframe}
  </div>
  <div className="mt-1">
    OKX 模拟盘 · {item.marketType === 'perp' ? '永续' : '现货'} · 仓位 {item.positionPct}%{item.leverage ? ` · ${item.leverage}x` : ''}
  </div>
</div>
```

Remove `PRESET_DISPLAY_DATA` and remove display of hard-coded `returnRate` and `winRate`.

- [ ] **Step 5: Update PlazaPageClient**

Modify `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`:

```tsx
import {
  createStrategyPlazaRunRequestId,
  fetchStrategyPlazaTemplates,
  runStrategyPlazaTemplate,
  startStrategyPlazaEditSession,
} from '@/lib/api'
```

Add state:

```tsx
const [templates, setTemplates] = useState<StrategyPlazaTemplate[]>([])
const [loadingTemplates, setLoadingTemplates] = useState(true)
const [templateError, setTemplateError] = useState<string | null>(null)
const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null)
```

Load templates:

```tsx
useEffect(() => {
  let cancelled = false
  setLoadingTemplates(true)
  fetchStrategyPlazaTemplates()
    .then(items => {
      if (!cancelled) setTemplates(items)
    })
    .catch(error => {
      if (!cancelled) setTemplateError(error instanceof Error ? error.message : t('aiQuant.strategyPlazaLoadFailed'))
    })
    .finally(() => {
      if (!cancelled) setLoadingTemplates(false)
    })
  return () => {
    cancelled = true
  }
}, [t])
```

Run action:

```tsx
const runTemplate = async (templateId: string) => {
  if (!session) {
    setIntent({ type: 'plaza-run', templateId })
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}`)
    return
  }
  setRunningTemplateId(templateId)
  try {
    const strategy = await runStrategyPlazaTemplate(templateId, createStrategyPlazaRunRequestId())
    router.push(`/${lng}/account/ai-quant/strategy/${strategy.id}`)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === 'strategy_plaza.okx_demo_api_key_required') {
      setIntent({ type: 'plaza-run', templateId })
      router.push(`/${lng}/account?tab=ai-quant#exchange-api`)
      return
    }
    setTemplateError(error instanceof Error ? error.message : t('aiQuant.strategyPlazaRunFailed'))
  } finally {
    setRunningTemplateId(null)
  }
}
```

Edit action:

```tsx
const editTemplate = async (templateId: string) => {
  if (!session) {
    setIntent({ type: 'plaza-edit', templateId })
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}`)
    return
  }
  const editSession = await startStrategyPlazaEditSession(templateId)
  setIntent({ type: 'chat', draft: editSession.initialMessage })
  router.push(`/${lng}/ai-quant`)
}
```

Pass props:

```tsx
<StrategyPlaza
  templates={templates}
  loading={loadingTemplates || Boolean(runningTemplateId)}
  error={templateError}
  subtitle={t('aiQuant.strategyPlazaSubtitle')}
  onRunStrategy={runTemplate}
  onEditStrategy={editTemplate}
/>
```

- [ ] **Step 6: Run StrategyPlaza tests**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/front/src/components/ai-quant/StrategyPlaza.tsx apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx apps/front/src/components/ai-quant/intent-storage.ts
git commit -m "feat: render strategy plaza from api" -m "Refs: #881"
```

### Task 6: Login Intent Resume And OKX Binding Resume

**Files:**

- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`
- Modify: `apps/front/src/components/account/ExchangeApiSection.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx`

- [ ] **Step 1: Write plaza intent resume test**

Create `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiQuantPlazaPageClient } from './PlazaPageClient'

vi.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: { userId: 'user-1' }, isLoading: false }),
}))

vi.mock('@/components/ai-quant/intent-storage', () => ({
  clearIntent: vi.fn(),
  getIntent: vi.fn(() => ({ type: 'plaza-edit', templateId: 'ma-cross', ts: Date.now() })),
  setIntent: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  fetchStrategyPlazaTemplates: vi.fn().mockResolvedValue([]),
  startStrategyPlazaEditSession: vi.fn().mockResolvedValue({ sessionId: 'session-1', templateId: 'ma-cross', initialMessage: 'seed' }),
  runStrategyPlazaTemplate: vi.fn(),
  createStrategyPlazaRunRequestId: vi.fn(() => 'plaza-run-1'),
}))

describe('AiQuantPlazaPageClient intent resume', () => {
  it('resumes plaza edit intent after login', async () => {
    const api = await import('@/lib/api')

    render(<AiQuantPlazaPageClient />)

    await waitFor(() => {
      expect(api.startStrategyPlazaEditSession).toHaveBeenCalledWith('ma-cross')
    })
  })
})
```

- [ ] **Step 2: Run failing intent resume test**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
```

Expected: FAIL because plaza intent resume is not implemented.

- [ ] **Step 3: Resume plaza intents in PlazaPageClient**

Modify `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`:

```tsx
useEffect(() => {
  if (!session) return
  const intent = getIntent(INTENT_TTL_MS)
  if (!intent) return
  if (intent.type !== 'plaza-run' && intent.type !== 'plaza-edit') return

  clearIntent()
  if (intent.type === 'plaza-run') {
    void runTemplate(intent.templateId)
    return
  }
  void editTemplate(intent.templateId)
}, [session])
```

Define `INTENT_TTL_MS` in the file:

```ts
const INTENT_TTL_MS = 10 * 60 * 1000
```

- [ ] **Step 4: Resume pending plaza run after OKX API key save**

Modify `apps/front/src/components/account/ExchangeApiSection.tsx` after a successful `save(exchangeId)`:

```tsx
if (exchangeId === 'okx') {
  const rawRedirect = new URLSearchParams(window.location.search).get('redirect')
  if (rawRedirect) {
    window.location.href = rawRedirect
    return
  }
}
```

When redirect support is not already present in the route, plaza run should send users to:

```tsx
router.push(`/${lng}/account?tab=ai-quant&redirect=${encodeURIComponent(`/${lng}/ai-quant/plaza`)}#exchange-api`)
```

- [ ] **Step 5: Run plaza intent tests**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx apps/front/src/components/account/ExchangeApiSection.tsx
git commit -m "feat: resume strategy plaza intents" -m "Refs: #881"
```

### Task 7: Backend Verification, Contracts, And Full Frontend Regression

**Files:**

- Generated: `packages/api-contracts/src/generated/quantify.ts`
- Modify only if generated exports require it: `packages/api-contracts/src/index.ts`

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-run.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
```

Expected: all PASS.

- [ ] **Step 3: Build backend and contracts**

Run:

```bash
dx build quantify --dev
dx build contracts --dev
```

Expected: both PASS. If contracts generation changes `packages/api-contracts/src/generated/quantify.ts`, include it in the final commit.

- [ ] **Step 4: Run minimum E2E health check**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/health
```

Expected: PASS.

- [ ] **Step 5: Run frontend unit suite for changed area**

Run:

```bash
dx test unit front
```

Expected: PASS.

- [ ] **Step 6: Commit verification or generated contracts**

If contracts changed:

```bash
git add packages/api-contracts/src/generated/quantify.ts packages/api-contracts/src/index.ts
git commit -m "chore: update strategy plaza api contracts" -m "Refs: #881"
```

If no files changed, do not create an empty commit.

---

## Notes For Execution

- The six official `publishedSnapshotId` values in constants must exist in the target environment before the run endpoint is used. If they do not exist, add a small seed step in the implementation branch that creates deterministic official codegen sessions and snapshots with those IDs, then verify `AccountStrategyViewService.deployStrategy()` can load them.
- Do not accept market, symbol, position, leverage, or timeframe from the frontend run request.
- Do not restore hard-coded mock return rate or win rate cards.
- Do not design the invite-code login mechanism in this implementation.
- Keep all commits on branch `codex/docs/881-strategy-plaza-public-beta-design` or a new `codex/feat/881-*` branch.

---

## Self-Review

Spec coverage:

- 6 official templates: Task 1.
- OKX demo-only run: Task 2 and Task 3.
- Run without user parameter override: Task 2 and Task 4.
- Edit through AI Quant conversation: Task 3 and Task 5.
- Unauthenticated browse with login intent: Task 5 and Task 6.
- No fake metrics: Task 5.
- Tests and verification: Task 7.

Placeholder scan:

- No task contains unfinished markers or unspecified file paths.
- Commands use `dx` from the repository root.

Type consistency:

- Backend template IDs are shared through `StrategyPlazaTemplateId`.
- Frontend uses `StrategyPlazaTemplate.id` as the only action identifier.
- Run request body contains only `runRequestId`.

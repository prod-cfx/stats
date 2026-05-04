# Quant Trading Execution Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared automatic trading execution core and route grid runtime, signal execution, and position closing through it without regressing the six working strategy plaza strategies.

**Architecture:** Add a focused `trading-execution` module between automatic strategy callers and `TradingService`. The module resolves exchange constraints, normalizes order inputs, gates reduce-only/close intents by position state, then submits through the existing trading service. Callers keep their persistence and state-machine responsibilities.

**Tech Stack:** NestJS modules/services, TypeScript discriminated unions, Jest unit tests, existing `dx` commands, existing `TradingService`, OKX/Binance/Hyperliquid exchange clients.

---

## File Structure

- Create `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`
  - Owns `OrderIntent`, `TradingExecutionResult`, constraints, normalized order, and source enums.
- Create `apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.ts`
  - Generates exchange-compatible `clientOrderId` values for all automatic execution callers.
- Create `apps/quantify/src/modules/trading-execution/services/order-normalizer.service.ts`
  - Applies tick size, lot size, minimum quantity, contract value, and symbol normalization.
- Create `apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.ts`
  - Blocks reduce-only/close orders without matching positions.
- Create `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`
  - Orchestrates constraints resolution, normalization, admission, and final submission.
- Create `apps/quantify/src/modules/trading-execution/trading-execution.module.ts`
  - Exports `TradingExecutionService`.
- Create test files under `apps/quantify/src/modules/trading-execution/services/*.spec.ts`.
- Modify `apps/quantify/src/modules/trading/core/types.ts`
  - Add `UnifiedInstrumentConstraints`.
- Modify `apps/quantify/src/modules/trading/core/interface.ts`
  - Add optional `fetchInstrumentConstraints(symbol: string)`.
- Modify `apps/quantify/src/modules/trading/exchanges/okx-client.ts`
  - Expose OKX instrument constraints, with strict perpetual constraint requirements.
- Modify `apps/quantify/src/modules/trading/trading.service.ts`
  - Add `getInstrumentConstraints(...)` and keep `placeOrder(...)` behavior intact.
- Modify `apps/quantify/src/modules/trading/trading.module.ts`
  - Export dependency support needed by `TradingExecutionModule`.
- Modify `apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts`
  - Import `TradingExecutionModule`.
- Modify `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
  - Replace direct `TradingService.placeOrder()` for planned grid orders with `TradingExecutionService.executeIntent()`.
- Modify `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.ts`
  - Resolve OKX constraints before planning/persisting grid orders and project contract constraints into grid config.
- Modify `apps/quantify/src/modules/strategy-signals/strategy-signals-execution.module.ts`
  - Import `TradingExecutionModule`.
- Modify `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
  - Replace the final direct submit hop with execution core while preserving execution stages and ledger flow.
- Modify `apps/quantify/src/modules/positions/positions.module.ts`
  - Import `TradingExecutionModule`.
- Modify `apps/quantify/src/modules/positions/positions.service.ts`
  - Route close-position market orders through execution core.
- Modify existing unit specs for grid, signal executor, positions, and OKX client.

## Task 1: Trading Constraint Types and TradingService Query

**Files:**
- Modify: `apps/quantify/src/modules/trading/core/types.ts`
- Modify: `apps/quantify/src/modules/trading/core/interface.ts`
- Modify: `apps/quantify/src/modules/trading/trading.service.ts`
- Modify: `apps/quantify/src/modules/trading/exchanges/okx-client.ts`
- Test: `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts`

- [ ] **Step 1: Add a failing OKX constraint test**

Add this test to `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts` near the existing OKX instrument-spec tests:

```ts
it('returns OKX perp instrument constraints for execution admission', async () => {
  const requests: Array<{ pathname: string; search: string }> = []
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    requests.push({ pathname: url.pathname, search: url.search })
    if (url.pathname === '/api/v5/public/instruments') {
      return okJson({
        data: [{
          instId: 'BTC-USDT-SWAP',
          ctVal: '0.01',
          lotSz: '1',
          tickSz: '0.1',
          minSz: '1',
        }],
      })
    }
    return okJson({ code: '0', data: [] })
  }) as jest.Mock

  const constraints = await createClient({ marketType: 'perp' }).fetchInstrumentConstraints?.('BTC/USDT:PERP')

  expect(constraints).toEqual({
    exchangeId: 'okx',
    marketType: 'perp',
    symbol: 'BTC/USDT:PERP',
    rawSymbol: 'BTC-USDT-SWAP',
    priceTickSize: '0.1',
    quantityStepSize: '1',
    minQuantity: '1',
    contractValue: '0.01',
    clientOrderId: {
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    },
    raw: expect.objectContaining({ instId: 'BTC-USDT-SWAP' }),
  })
  expect(requests.some(request => request.pathname === '/api/v5/public/instruments')).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts -t "returns OKX perp instrument constraints"
```

Expected: FAIL because `fetchInstrumentConstraints` and `UnifiedInstrumentConstraints` do not exist.

- [ ] **Step 3: Add the shared constraint type**

In `apps/quantify/src/modules/trading/core/types.ts`, add:

```ts
export interface ClientOrderIdConstraints {
  maxLength: number
  pattern: string
}

export interface UnifiedInstrumentConstraints {
  exchangeId: ExchangeId
  marketType: MarketType
  symbol: string
  rawSymbol: string
  priceTickSize?: string | null
  quantityStepSize?: string | null
  minQuantity?: string | null
  contractValue?: string | null
  clientOrderId: ClientOrderIdConstraints
  raw: unknown
}
```

- [ ] **Step 4: Add the optional exchange-client method**

In `apps/quantify/src/modules/trading/core/interface.ts`, import `UnifiedInstrumentConstraints` and add:

```ts
fetchInstrumentConstraints?: (symbol: string) => Promise<UnifiedInstrumentConstraints>
```

- [ ] **Step 5: Implement OKX constraints**

In `apps/quantify/src/modules/trading/exchanges/okx-client.ts`:

1. Extend `OkxInstrumentSpecItem` with:

```ts
minSz?: string
```

2. Add this public method inside `OkxClient`:

```ts
async fetchInstrumentConstraints(symbol: string): Promise<UnifiedInstrumentConstraints> {
  const instId = this.toInstrumentId(symbol, this.marketType)
  const instrumentSpec = await this.getInstrumentSpec(instId)
  if (this.marketType === 'perp' && (!instrumentSpec?.ctVal || !instrumentSpec.lotSz || !instrumentSpec.tickSz)) {
    throw new ExchangeError(`OKX instrument constraints incomplete for ${instId}`)
  }

  return {
    exchangeId: 'okx',
    marketType: this.marketType,
    symbol,
    rawSymbol: instId,
    priceTickSize: instrumentSpec?.tickSz ?? null,
    quantityStepSize: instrumentSpec?.lotSz ?? null,
    minQuantity: instrumentSpec?.minSz ?? null,
    contractValue: instrumentSpec?.ctVal ?? null,
    clientOrderId: {
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    },
    raw: instrumentSpec ?? { instId },
  }
}
```

3. Update the import from trading types to include `UnifiedInstrumentConstraints`.

- [ ] **Step 6: Add TradingService constraint query**

In `apps/quantify/src/modules/trading/trading.service.ts`, import `UnifiedInstrumentConstraints` and add:

```ts
async getInstrumentConstraints(
  userId: string,
  exchangeId: ExchangeId,
  marketType: MarketType,
  symbol: string,
  exchangeAccountId?: string,
): Promise<UnifiedInstrumentConstraints> {
  const account = exchangeAccountId
    ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
    : await this.accountStore.getAccountConfig(userId, exchangeId)
  if (!account) {
    throw new TradingAccountNotFoundException({ userId, exchangeId })
  }
  this.ensureMarketTypeSupported(exchangeId, marketType, account)

  const client = this.exchangeFactory.createClient(exchangeId, marketType, account)
  if (!client.fetchInstrumentConstraints) {
    throw new ExchangeOperationFailedException({
      operation: 'fetch instrument constraints',
      exchangeId,
      reason: `Instrument constraints are not implemented for ${exchangeId}:${marketType}`,
    })
  }

  try {
    return await client.fetchInstrumentConstraints(symbol)
  }
  catch (error) {
    if (error instanceof ExchangeError) {
      throw new ExchangeOperationFailedException({ operation: 'fetch instrument constraints', exchangeId, reason: error.message })
    }
    throw new ExchangeOperationFailedException({
      operation: 'fetch instrument constraints',
      exchangeId,
      reason: (error as Error).message,
    })
  }
}
```

- [ ] **Step 7: Run the focused OKX test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts -t "returns OKX perp instrument constraints"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/trading/core/types.ts apps/quantify/src/modules/trading/core/interface.ts apps/quantify/src/modules/trading/trading.service.ts apps/quantify/src/modules/trading/exchanges/okx-client.ts apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts
git commit -F - <<'MSG'
feat: 暴露交易所订单约束查询

变更说明：
- 新增统一 instrument constraints 类型
- 为 OKX 暴露 tick/lot/contract/clientOrderId 约束
- 在 TradingService 增加约束查询入口

Refs: #955
MSG
```

## Task 2: Execution Core Types, Client Order Id, and Normalization

**Files:**
- Create: `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.spec.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/order-normalizer.service.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/order-normalizer.service.spec.ts`

- [ ] **Step 1: Write failing client-order-id tests**

Create `apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.spec.ts`:

```ts
import { ClientOrderIdFactoryService } from './client-order-id-factory.service'

describe('ClientOrderIdFactoryService', () => {
  it('generates OKX-compatible ids from arbitrary source ids', () => {
    const service = new ClientOrderIdFactoryService()

    const id = service.create({
      exchangeId: 'okx',
      source: 'grid',
      sourceId: 'g-cmoqyqixx08zs4qqs1b8pfv3o',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(id).toBe('ggcmoqyqixx08zs4qqs1b8pfv3o')
    expect(id).toHaveLength(30)
    expect(id).toMatch(/^[A-Za-z0-9]+$/u)
  })

  it('keeps ids within the exchange max length', () => {
    const service = new ClientOrderIdFactoryService()

    const id = service.create({
      exchangeId: 'okx',
      source: 'signal',
      sourceId: '0123456789abcdefghijklmnopqrstuvwxyz-extra',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(id).toBe('s0123456789abcdefghijklmnopqrstu')
    expect(id).toHaveLength(32)
  })
})
```

- [ ] **Step 2: Write failing normalizer tests**

Create `apps/quantify/src/modules/trading-execution/services/order-normalizer.service.spec.ts`:

```ts
import { OrderNormalizerService } from './order-normalizer.service'
import type { OrderIntent, TradingExecutionConstraints } from '../types/trading-execution.types'

const constraints: TradingExecutionConstraints = {
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  rawSymbol: 'BTC-USDT-SWAP',
  priceTickSize: '0.1',
  quantityStepSize: '1',
  minQuantity: '1',
  contractValue: '0.01',
  clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
  raw: {},
}

const intent: OrderIntent = {
  source: 'grid',
  sourceId: 'planned-open-long',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.123,
  price: 79283.33333333333,
  role: 'open_long',
  timeInForce: 'GTC',
  tdMode: 'cross',
}

describe('OrderNormalizerService', () => {
  it('normalizes price, quantity and client order id from constraints', () => {
    const service = new OrderNormalizerService()

    const normalized = service.normalize(intent, constraints, 'gplannedopenlong')

    expect(normalized.request).toEqual(expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      price: 79283.3,
      amount: 0.12,
      timeInForce: 'GTC',
      tdMode: 'cross',
      clientOrderId: 'gplannedopenlong',
    }))
    expect(normalized.normalizedPrice).toBe('79283.3')
    expect(normalized.normalizedAmount).toBe('0.12')
    expect(normalized.exchangeSize).toBe('12')
  })

  it('rejects quantity below minimum exchange size', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize({ ...intent, amount: 0.001 }, constraints, 'gsmall'))
      .toThrow('trading_execution_quantity_below_minimum')
  })
})
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.spec.ts apps/quantify/src/modules/trading-execution/services/order-normalizer.service.spec.ts
```

Expected: FAIL because the module files do not exist.

- [ ] **Step 4: Create execution core types**

Create `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`:

```ts
import type { CreateOrderInput, ExchangeId, MarketType, OrderSide, OrderType, TimeInForce, TradeMode, UnifiedInstrumentConstraints, UnifiedOrder } from '@/modules/trading/core/types'

export type OrderIntentSource = 'grid' | 'signal' | 'position_tool'
export type OrderIntentRole = 'spot_buy' | 'spot_sell' | 'open_long' | 'open_short' | 'close_long' | 'close_short'

export interface OrderIntent {
  source: OrderIntentSource
  sourceId: string
  userId: string
  exchangeAccountId?: string | null
  exchangeId: ExchangeId
  marketType: MarketType
  symbol: string
  side: OrderSide
  type: OrderType
  amount: number
  price?: number
  timeInForce?: TimeInForce
  role?: OrderIntentRole | null
  reduceOnly?: boolean
  tdMode?: TradeMode
  metadata?: Record<string, unknown>
}

export type TradingExecutionConstraints = UnifiedInstrumentConstraints

export interface NormalizedOrderIntent {
  request: CreateOrderInput
  normalizedPrice?: string
  normalizedAmount: string
  exchangeSize: string
  clientOrderId: string
  constraints: TradingExecutionConstraints
}

export type TradingExecutionResult =
  | { status: 'submitted'; intent: OrderIntent; normalized: NormalizedOrderIntent; order: UnifiedOrder }
  | { status: 'waiting_constraints'; intent: OrderIntent; reason: string; error?: unknown }
  | { status: 'waiting_position'; intent: OrderIntent; reason: string }
  | { status: 'rejected'; intent: OrderIntent; reason: string; normalized?: NormalizedOrderIntent }
  | { status: 'submit_failed'; intent: OrderIntent; normalized: NormalizedOrderIntent; reason: string; error: unknown }
  | { status: 'reconcile_required'; intent: OrderIntent; reason: string; order?: UnifiedOrder; error?: unknown }
```

- [ ] **Step 5: Implement client-order-id factory**

Create `apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.ts`:

```ts
import type { ExchangeId } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import type { OrderIntentSource } from '../types/trading-execution.types'

interface CreateClientOrderIdInput {
  exchangeId: ExchangeId
  source: OrderIntentSource
  sourceId: string
  maxLength: number
  pattern: string
}

const SOURCE_PREFIX: Record<OrderIntentSource, string> = {
  grid: 'g',
  signal: 's',
  position_tool: 'p',
}

@Injectable()
export class ClientOrderIdFactoryService {
  create(input: CreateClientOrderIdInput): string {
    const prefix = SOURCE_PREFIX[input.source]
    const alphanumeric = `${prefix}${input.sourceId}`.replace(/[^a-z0-9]/gi, '')
    const truncated = alphanumeric.slice(0, input.maxLength)
    const pattern = new RegExp(input.pattern, 'u')
    if (!pattern.test(truncated) || truncated.length === 0) {
      throw new Error('trading_execution_invalid_client_order_id')
    }
    return truncated
  }
}
```

- [ ] **Step 6: Implement order normalizer**

Create `apps/quantify/src/modules/trading-execution/services/order-normalizer.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type { NormalizedOrderIntent, OrderIntent, TradingExecutionConstraints } from '../types/trading-execution.types'

@Injectable()
export class OrderNormalizerService {
  normalize(intent: OrderIntent, constraints: TradingExecutionConstraints, clientOrderId: string): NormalizedOrderIntent {
    const normalizedPrice = intent.type === 'limit'
      ? this.normalizePrice(intent.price, constraints)
      : undefined
    const normalizedAmount = this.normalizeAmount(intent.amount, constraints)
    const request = {
      symbol: intent.symbol,
      marketType: intent.marketType,
      side: intent.side,
      type: intent.type,
      amount: Number(normalizedAmount),
      price: normalizedPrice === undefined ? undefined : Number(normalizedPrice),
      timeInForce: intent.timeInForce,
      reduceOnly: intent.reduceOnly,
      tdMode: intent.tdMode,
      clientOrderId,
    }

    return {
      request,
      normalizedPrice,
      normalizedAmount,
      exchangeSize: this.toExchangeSize(normalizedAmount, constraints),
      clientOrderId,
      constraints,
    }
  }

  private normalizePrice(value: number | undefined, constraints: TradingExecutionConstraints): string {
    if (value === undefined) throw new Error('trading_execution_limit_price_required')
    const tick = this.positiveDecimal(constraints.priceTickSize, 'trading_execution_missing_price_tick')
    return this.decimal(value).div(tick).toDecimalPlaces(0).mul(tick).toFixed()
  }

  private normalizeAmount(value: number, constraints: TradingExecutionConstraints): string {
    const step = this.positiveDecimal(constraints.quantityStepSize, 'trading_execution_missing_quantity_step')
    const normalized = this.decimal(value).div(step).floor().mul(step)
    const min = constraints.minQuantity ? this.decimal(constraints.minQuantity) : null
    const exchangeSize = this.decimal(this.toExchangeSize(normalized.toFixed(), constraints))
    if (min && exchangeSize.lt(min)) throw new Error('trading_execution_quantity_below_minimum')
    if (!normalized.isPositive()) throw new Error('trading_execution_quantity_below_minimum')
    return normalized.toFixed()
  }

  private toExchangeSize(amount: string, constraints: TradingExecutionConstraints): string {
    if (constraints.marketType !== 'perp' || !constraints.contractValue) return amount
    const contractValue = this.positiveDecimal(constraints.contractValue, 'trading_execution_missing_contract_value')
    return this.decimal(amount).div(contractValue).toFixed()
  }

  private positiveDecimal(value: string | null | undefined, errorCode: string): Prisma.Decimal {
    if (!value) throw new Error(errorCode)
    const decimal = this.decimal(value)
    if (!decimal.isPositive()) throw new Error(errorCode)
    return decimal
  }

  private decimal(value: string | number): Prisma.Decimal {
    return new Prisma.Decimal(value)
  }
}
```

- [ ] **Step 7: Run tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.spec.ts apps/quantify/src/modules/trading-execution/services/order-normalizer.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.ts apps/quantify/src/modules/trading-execution/services/client-order-id-factory.service.spec.ts apps/quantify/src/modules/trading-execution/services/order-normalizer.service.ts apps/quantify/src/modules/trading-execution/services/order-normalizer.service.spec.ts
git commit -F - <<'MSG'
feat: 新增量化执行内核参数规整

变更说明：
- 定义统一 OrderIntent 与执行结果类型
- 新增通用 clientOrderId 生成器
- 新增交易所约束驱动的订单规整服务

Refs: #955
MSG
```

## Task 3: Admission Gate and TradingExecutionService

**Files:**
- Create: `apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.spec.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`
- Create: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts`
- Create: `apps/quantify/src/modules/trading-execution/trading-execution.module.ts`

- [ ] **Step 1: Write admission gate tests**

Create `apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.spec.ts`:

```ts
import { OrderAdmissionGateService } from './order-admission-gate.service'
import type { OrderIntent } from '../types/trading-execution.types'

const baseIntent: OrderIntent = {
  source: 'grid',
  sourceId: 'order-1',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.1,
  price: 79200,
  role: 'close_short',
  reduceOnly: true,
}

describe('OrderAdmissionGateService', () => {
  it('waits when a close-short intent has no short position', () => {
    const service = new OrderAdmissionGateService()

    const result = service.evaluate(baseIntent, [])

    expect(result).toEqual({ ok: false, status: 'waiting_position', reason: 'missing_closable_short_position' })
  })

  it('allows a close-short intent with a matching short position', () => {
    const service = new OrderAdmissionGateService()

    const result = service.evaluate(baseIntent, [{
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'short',
      size: 0.2,
      entryPrice: 80000,
      unrealizedPnl: 0,
      raw: {},
    }])

    expect(result).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Write TradingExecutionService tests**

Create `apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts` with tests for `waiting_constraints`, `waiting_position`, and `submitted`:

```ts
import { TradingExecutionService } from './trading-execution.service'
import { ClientOrderIdFactoryService } from './client-order-id-factory.service'
import { OrderAdmissionGateService } from './order-admission-gate.service'
import { OrderNormalizerService } from './order-normalizer.service'
import type { OrderIntent } from '../types/trading-execution.types'

const intent: OrderIntent = {
  source: 'grid',
  sourceId: 'planned-open-long',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.1,
  price: 79200,
  role: 'open_long',
  timeInForce: 'GTC',
  tdMode: 'cross',
}

function createTradingService() {
  return {
    getInstrumentConstraints: jest.fn().mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    }),
    getPositions: jest.fn().mockResolvedValue([]),
    placeOrder: jest.fn().mockResolvedValue({
      id: 'exchange-order-1',
      clientOrderId: 'gplannedopenlong',
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      price: 79200,
      amount: 0.1,
      filled: 0,
      status: 'open',
      createdAt: Date.parse('2026-05-04T00:00:00.000Z'),
      raw: { ordId: 'exchange-order-1' },
    }),
  }
}

describe('TradingExecutionService', () => {
  it('submits a normalized order after constraints and admission pass', async () => {
    const tradingService = createTradingService()
    const service = new TradingExecutionService(
      tradingService as never,
      new ClientOrderIdFactoryService(),
      new OrderNormalizerService(),
      new OrderAdmissionGateService(),
    )

    const result = await service.executeIntent(intent)

    expect(result.status).toBe('submitted')
    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'perp', expect.objectContaining({
      clientOrderId: 'gplannedopenlong',
      price: 79200,
      amount: 0.1,
    }), 'exchange-account-1')
  })

  it('fails closed when constraints cannot be resolved', async () => {
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('instrument unavailable'))
    const service = new TradingExecutionService(
      tradingService as never,
      new ClientOrderIdFactoryService(),
      new OrderNormalizerService(),
      new OrderAdmissionGateService(),
    )

    const result = await service.executeIntent(intent)

    expect(result).toEqual(expect.objectContaining({ status: 'waiting_constraints' }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('waits instead of submitting a close intent without matching position', async () => {
    const tradingService = createTradingService()
    const service = new TradingExecutionService(
      tradingService as never,
      new ClientOrderIdFactoryService(),
      new OrderNormalizerService(),
      new OrderAdmissionGateService(),
    )

    const result = await service.executeIntent({ ...intent, role: 'close_short', reduceOnly: true })

    expect(result).toEqual(expect.objectContaining({ status: 'waiting_position' }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.spec.ts apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts
```

Expected: FAIL because services do not exist.

- [ ] **Step 4: Implement admission gate**

Create `apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.ts`:

```ts
import type { UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import type { OrderIntent } from '../types/trading-execution.types'

type AdmissionResult =
  | { ok: true }
  | { ok: false; status: 'waiting_position'; reason: string }

@Injectable()
export class OrderAdmissionGateService {
  evaluate(intent: OrderIntent, positions: UnifiedPosition[]): AdmissionResult {
    const requiredSide = this.requiredPositionSide(intent)
    if (!requiredSide) return { ok: true }

    const hasPosition = positions.some(position =>
      position.side === requiredSide
      && position.size > 0
      && this.normalizeSymbol(position.symbol) === this.normalizeSymbol(intent.symbol)
      && position.marketType === intent.marketType,
    )

    if (hasPosition) return { ok: true }
    return {
      ok: false,
      status: 'waiting_position',
      reason: requiredSide === 'long' ? 'missing_closable_long_position' : 'missing_closable_short_position',
    }
  }

  private requiredPositionSide(intent: OrderIntent): 'long' | 'short' | null {
    if (intent.role === 'close_long') return 'long'
    if (intent.role === 'close_short') return 'short'
    if (!intent.reduceOnly) return null
    return intent.side === 'sell' ? 'long' : 'short'
  }

  private normalizeSymbol(symbol: string): string {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
  }
}
```

- [ ] **Step 5: Implement TradingExecutionService**

Create `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { TradingService } from '@/modules/trading/trading.service'
import { ClientOrderIdFactoryService } from './client-order-id-factory.service'
import { OrderAdmissionGateService } from './order-admission-gate.service'
import { OrderNormalizerService } from './order-normalizer.service'
import type { OrderIntent, TradingExecutionResult } from '../types/trading-execution.types'

@Injectable()
export class TradingExecutionService {
  constructor(
    private readonly tradingService: TradingService,
    private readonly clientOrderIds: ClientOrderIdFactoryService,
    private readonly normalizer: OrderNormalizerService,
    private readonly admissionGate: OrderAdmissionGateService,
  ) {}

  async executeIntent(intent: OrderIntent): Promise<TradingExecutionResult> {
    let constraints
    try {
      constraints = await this.tradingService.getInstrumentConstraints(
        intent.userId,
        intent.exchangeId,
        intent.marketType,
        intent.symbol,
        intent.exchangeAccountId ?? undefined,
      )
    }
    catch (error) {
      return { status: 'waiting_constraints', intent, reason: (error as Error).message, error }
    }

    const clientOrderId = this.clientOrderIds.create({
      exchangeId: intent.exchangeId,
      source: intent.source,
      sourceId: intent.sourceId,
      maxLength: constraints.clientOrderId.maxLength,
      pattern: constraints.clientOrderId.pattern,
    })

    let normalized
    try {
      normalized = this.normalizer.normalize(intent, constraints, clientOrderId)
    }
    catch (error) {
      return { status: 'rejected', intent, reason: (error as Error).message }
    }

    const positions = intent.reduceOnly || intent.role === 'close_long' || intent.role === 'close_short'
      ? await this.tradingService.getPositions(intent.userId, intent.exchangeId, intent.marketType, intent.exchangeAccountId ?? undefined)
      : []
    const admission = this.admissionGate.evaluate(intent, positions)
    if (!admission.ok) {
      return { status: admission.status, intent, reason: admission.reason }
    }

    try {
      const order = await this.tradingService.placeOrder(
        intent.userId,
        intent.exchangeId,
        intent.marketType,
        normalized.request,
        intent.exchangeAccountId ?? undefined,
      )
      return { status: 'submitted', intent, normalized, order }
    }
    catch (error) {
      return { status: 'submit_failed', intent, normalized, reason: (error as Error).message, error }
    }
  }
}
```

- [ ] **Step 6: Create the module**

Create `apps/quantify/src/modules/trading-execution/trading-execution.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { TradingModule } from '@/modules/trading/trading.module'
import { ClientOrderIdFactoryService } from './services/client-order-id-factory.service'
import { OrderAdmissionGateService } from './services/order-admission-gate.service'
import { OrderNormalizerService } from './services/order-normalizer.service'
import { TradingExecutionService } from './services/trading-execution.service'

@Module({
  imports: [TradingModule],
  providers: [
    ClientOrderIdFactoryService,
    OrderNormalizerService,
    OrderAdmissionGateService,
    TradingExecutionService,
  ],
  exports: [TradingExecutionService],
})
export class TradingExecutionModule {}
```

- [ ] **Step 7: Run tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading-execution/services/order-admission-gate.service.spec.ts apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/trading-execution
git commit -F - <<'MSG'
feat: 新增量化订单执行内核

变更说明：
- 新增统一 TradingExecutionService
- 增加 reduce-only 持仓门禁
- 增加结构化执行结果

Refs: #955
MSG
```

## Task 4: Migrate Grid Runtime Execution

**Files:**
- Modify: `apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts`
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.ts`
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts`

- [ ] **Step 1: Add a failing grid waiting-position test**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`, update the test setup to mock `TradingExecutionService`, then add:

```ts
it('keeps no-position perp close orders waiting without runtime reconcile', async () => {
  const repository = createRepository()
  repository.findInstanceForSync.mockResolvedValue({
    ...createInstance(),
    marketType: 'perp',
    symbol: 'BTC/USDT:PERP',
    configSnapshot: { ...baseConfig, mode: 'perp_neutral' },
  })
  repository.listOrders.mockResolvedValue([
    createOrder({
      id: 'planned-close-short',
      clientOrderId: null,
      exchangeOrderId: null,
      status: 'PLANNED',
      side: 'buy',
      role: 'close_short',
    }),
  ])
  const tradingExecution = createTradingExecutionService()
  tradingExecution.executeIntent.mockResolvedValue({
    status: 'waiting_position',
    intent: expect.anything(),
    reason: 'missing_closable_short_position',
  })
  const stateMachine = createStateMachine()
  const service = createService(repository, createTradingService(), stateMachine, createTxEvents(), tradingExecution)

  await service.syncInstance('grid-1')

  expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
    source: 'grid',
    sourceId: 'planned-close-short',
    role: 'close_short',
    reduceOnly: true,
  }))
  expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the grid focused test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts -t "keeps no-position perp close orders waiting"
```

Expected: FAIL because `GridOrderSyncService` does not inject or call `TradingExecutionService`.

- [ ] **Step 3: Import execution module into grid runtime**

In `apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts`, import and add `TradingExecutionModule`:

```ts
import { TradingExecutionModule } from '../trading-execution/trading-execution.module'
```

Then change:

```ts
imports: [PrismaModule, TradingModule, TradingExecutionModule],
```

- [ ] **Step 4: Inject and use TradingExecutionService**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`:

1. Import:

```ts
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
```

2. Add constructor parameter after `tradingService`:

```ts
private readonly tradingExecution: TradingExecutionService,
```

3. Replace the direct `tradingService.placeOrder(...)` block in `submitPlannedOrders()` with:

```ts
const executionResult = await this.tradingExecution.executeIntent({
  source: 'grid',
  sourceId: order.id,
  userId: instance.userId,
  exchangeAccountId: instance.exchangeAccountId,
  exchangeId,
  marketType,
  symbol: instance.symbol,
  side: order.side as GridOrderSide,
  type: 'limit',
  amount: Number(this.decimalToString(order.quantity)),
  price: Number(this.decimalToString(order.price)),
  timeInForce: 'GTC',
  role: order.role as never,
  reduceOnly: marketType === 'perp' && this.isCloseRole(order.role),
  tdMode: marketType === 'perp' ? 'cross' : undefined,
})

if (executionResult.status === 'waiting_position') {
  continue
}
if (executionResult.status !== 'submitted') {
  await this.txEvents.withAfterCommit(async () =>
    this.stateMachine.markReconcileRequired(instance.id, executionResult.status, {
      orderId: order.id,
      reason: executionResult.reason,
    }))
  return
}

exchangeOrder = executionResult.order
clientOrderId = executionResult.normalized.clientOrderId
```

4. Change `const clientOrderId` to `let clientOrderId` before marking order submitting so the accepted normalized id can be used for persistence.

- [ ] **Step 5: Resolve constraints before grid planning and persist normalized open values**

In `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts`, add this failing test:

```ts
it('normalizes grid plan values with exchange constraints before persistence', async () => {
  const tradingService = createTradingService()
  tradingService.getInstrumentConstraints.mockResolvedValue({
    exchangeId: 'okx',
    marketType: 'perp',
    symbol: 'BTC/USDT:PERP',
    rawSymbol: 'BTC-USDT-SWAP',
    priceTickSize: '0.1',
    quantityStepSize: '1',
    minQuantity: '1',
    contractValue: '0.01',
    clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
    raw: {},
  })
  const repository = createRepository()
  const service = createService({ repository, tradingService })

  await service.createFromDeployment({
    strategyInstanceId: 'strategy-1',
    publishedSnapshotId: 'snapshot-1',
    userId: 'user-1',
    exchangeAccountId: 'exchange-account-1',
    exchangeId: 'okx',
    marketType: 'perp',
    symbol: 'BTC/USDT:PERP',
    astSnapshot: createGridAstWithoutExecutionPrecision(),
    currentPrice: '79250',
    fundingSnapshot: { executionCapital: '1000', asset: 'USDT' },
  })

  expect(repository.createInstanceWithPlan).toHaveBeenCalledWith(expect.objectContaining({
    plannedOrders: expect.arrayContaining([
      expect.objectContaining({
        price: expect.stringMatching(/^\d+(\.\d)?$/u),
        quantity: expect.not.stringMatching(/\.\d{13,}$/u),
      }),
    ]),
  }))
})
```

Then update `GridRuntimeService`:

1. Import `TradingService` and constraint types:

```ts
import type { ExchangeId, MarketType, UnifiedInstrumentConstraints } from '@/modules/trading/core/types'
import { TradingService } from '@/modules/trading/trading.service'
```

2. Add constructor dependency:

```ts
private readonly tradingService: TradingService,
```

3. In `createFromDeployment()`, replace the current `const config = this.buildConfigFromAst(...)` with:

```ts
const baseConfig = this.buildConfigFromAst(input.astSnapshot, input.symbol, input.currentPrice, input.fundingSnapshot)
const constraints = await this.tradingService.getInstrumentConstraints(
  input.userId,
  input.exchangeId as ExchangeId,
  input.marketType as MarketType,
  input.symbol,
  input.exchangeAccountId,
)
const config = this.applyExecutionConstraintsToConfig(baseConfig, constraints)
```

4. Add this helper to `GridRuntimeService`:

```ts
private applyExecutionConstraintsToConfig(
  config: GridRuntimeConfigSnapshot,
  constraints: UnifiedInstrumentConstraints,
): GridRuntimeConfigSnapshot {
  const contractValue = constraints.contractValue ? new Prisma.Decimal(constraints.contractValue) : null
  const quantityStep = constraints.quantityStepSize ? new Prisma.Decimal(constraints.quantityStepSize) : null
  const minQuantity = constraints.minQuantity ? new Prisma.Decimal(constraints.minQuantity) : null
  const baseLotSize = contractValue && quantityStep
    ? quantityStep.mul(contractValue).toFixed()
    : constraints.quantityStepSize ?? config.lotSize
  const baseMinQuantity = contractValue && minQuantity
    ? minQuantity.mul(contractValue).toFixed()
    : constraints.minQuantity ?? config.minQuantity

  return {
    ...config,
    tickSize: constraints.priceTickSize ?? config.tickSize,
    lotSize: baseLotSize,
    minQuantity: baseMinQuantity,
  }
}
```

Also ensure submitted/open persisted values use `executionResult.normalized.normalizedPrice` and `executionResult.normalized.normalizedAmount`:

```ts
price: executionResult.normalized.normalizedPrice ?? this.decimalToString(order.price),
quantity: executionResult.normalized.normalizedAmount,
```

- [ ] **Step 6: Run grid tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.ts apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts
git commit -F - <<'MSG'
fix: 网格运行时接入通用执行内核

变更说明：
- 网格订单提交改走 TradingExecutionService
- 无仓位平仓单进入等待而不是打停 runtime
- 使用执行内核规整后的价格数量回填本地订单

Refs: #955
MSG
```

## Task 5: Migrate Signal Executor Final Submit Hop and Add Golden Tests

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/strategy-signals-execution.module.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`

- [ ] **Step 1: Add a golden submit compatibility test**

In `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`, add a test around the existing successful execution fixtures:

```ts
it('preserves signal order semantics when routing final submit through execution core', async () => {
  const tradingExecution = {
    executeIntent: jest.fn().mockResolvedValue({
      status: 'submitted',
      intent: expect.anything(),
      normalized: {
        request: {
          symbol: 'BTC/USDT:PERP',
          marketType: 'perp',
          side: 'buy',
          type: 'market',
          amount: 0.1,
          reduceOnly: false,
          clientOrderId: 'ssignalexec1',
        },
        normalizedAmount: '0.1',
        exchangeSize: '10',
        clientOrderId: 'ssignalexec1',
        constraints: {},
      },
      order: {
        id: 'exchange-order-1',
        clientOrderId: 'ssignalexec1',
        symbol: 'BTC/USDT:PERP',
        marketType: 'perp',
        side: 'buy',
        type: 'market',
        amount: 0.1,
        filled: 0.1,
        status: 'closed',
        createdAt: Date.parse('2026-05-04T00:00:00.000Z'),
        raw: {},
      },
    }),
  }

  const service = createService({ tradingExecution })

  await service.executeSignalForSubscribedAccounts('signal-1')

  expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
    source: 'signal',
    sourceId: expect.any(String),
    symbol: 'BTC/USDT:PERP',
    marketType: 'perp',
    side: 'buy',
    type: 'market',
    amount: 0.1,
    reduceOnly: false,
  }))
  expect(executionRepository.markStage).toHaveBeenCalledWith(expect.any(String), 'ORDER_SUBMITTED', expect.objectContaining({
    orderRequest: expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      amount: 0.1,
      reduceOnly: false,
    }),
  }))
})
```

Adapt fixture names to the existing spec helpers in that file. The assertion must compare the existing `effectiveOrderParams` semantics to the intent.

- [ ] **Step 2: Run the golden test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts -t "preserves signal order semantics"
```

Expected: FAIL because `SignalExecutorService` still calls `TradingService.placeOrder()`.

- [ ] **Step 3: Import execution module**

In `apps/quantify/src/modules/strategy-signals/strategy-signals-execution.module.ts`, import and add:

```ts
import { TradingExecutionModule } from '@/modules/trading-execution/trading-execution.module'
```

Then include `TradingExecutionModule` in `imports`.

- [ ] **Step 4: Inject TradingExecutionService into SignalExecutorService**

In `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`:

1. Import:

```ts
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
```

2. Add constructor dependency:

```ts
private readonly tradingExecution: TradingExecutionService,
```

3. Replace only the final direct submit:

```ts
const executionResult = await this.tradingExecution.executeIntent({
  source: 'signal',
  sourceId: execution.id,
  userId: account.userId,
  exchangeAccountId: exchangeAccountId ?? null,
  exchangeId: effectiveExchangeId,
  marketType: effectiveOrderParams.marketType,
  symbol: effectiveOrderParams.symbol,
  side: effectiveOrderParams.side,
  type: 'market',
  amount: effectiveOrderParams.amount,
  price: effectiveOrderParams.price,
  reduceOnly: effectiveOrderParams.reduceOnly,
  metadata: { signalId: signal.id, strategyInstanceId: signal.strategyInstanceId },
})

if (executionResult.status !== 'submitted') {
  await this.executionRepository.markStage(execution.id, executionResult.status === 'waiting_position' ? 'SKIPPED' : 'RECONCILE_REQUIRED', {
    executionCore: executionResult,
  })
  await this.executionRepository.markFailed(execution.id, executionResult.status)
  await this.releaseReservation(account.id, reservedQuote, reserveReference)
  return executionResult.status === 'waiting_position' ? 'skipped' : 'failed'
}

const initialOrder = executionResult.order
```

Keep the existing final-order resolution, `ORDER_ACKED`, ledger application, and reservation release logic after this point.

- [ ] **Step 5: Add six golden cases**

In the same spec file, add a table test using the existing helper patterns:

```ts
it.each([
  ['spot buy', { marketType: 'spot', side: 'buy', reduceOnly: false }],
  ['spot sell', { marketType: 'spot', side: 'sell', reduceOnly: false }],
  ['perp open long', { marketType: 'perp', side: 'buy', reduceOnly: false }],
  ['perp open short', { marketType: 'perp', side: 'sell', reduceOnly: false }],
  ['perp close long', { marketType: 'perp', side: 'sell', reduceOnly: true }],
  ['perp close short', { marketType: 'perp', side: 'buy', reduceOnly: true }],
])('preserves strategy plaza golden order semantics for %s', async (_name, expected) => {
  const harness = createGoldenSignalHarness(expected)

  await harness.service.executeSignalForSubscribedAccounts(harness.signalId)

  expect(harness.tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining(expected))
})
```

Implement `createGoldenSignalHarness` in the spec using existing fixture builders. It must not call real exchanges.

- [ ] **Step 6: Run signal executor tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/strategy-signals/strategy-signals-execution.module.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
git commit -F - <<'MSG'
fix: 信号策略下单接入通用执行内核

变更说明：
- 信号执行最终下单改走 TradingExecutionService
- 保留原 execution stage 与 ledger 流程
- 增加策略广场已调通策略语义回归测试

Refs: #955
MSG
```

## Task 6: Migrate Position Close Submission

**Files:**
- Modify: `apps/quantify/src/modules/positions/positions.module.ts`
- Modify: `apps/quantify/src/modules/positions/positions.service.ts`
- Modify: position service spec file if present, otherwise add focused unit spec beside service.

- [ ] **Step 1: Add a failing no-position/waiting-position close test**

Find the existing positions service spec with:

```bash
rg -n "closePosition|manual-close-position|PositionsService" apps/quantify/src/modules/positions -g "*.spec.ts"
```

Add this behavior to the existing spec file:

```ts
it('does not submit a close order when execution core reports waiting_position', async () => {
  const tradingExecution = {
    executeIntent: jest.fn().mockResolvedValue({
      status: 'waiting_position',
      intent: expect.anything(),
      reason: 'missing_closable_long_position',
    }),
  }
  const service = createPositionsService({ tradingExecution })

  await expect(service.closePosition({
    userStrategyAccountId: 'account-1',
    positionId: 'position-1',
    quantity: '1',
  })).rejects.toMatchObject({
    message: 'position.close_waiting_position',
  })

  expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
    source: 'position_tool',
    role: 'close_long',
    reduceOnly: true,
  }))
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run the discovered spec file, for example:

```bash
dx test unit quantify apps/quantify/src/modules/positions/positions.service.spec.ts -t "does not submit a close order"
```

Expected: FAIL because the close path uses `TradingService.placeOrder()`.

- [ ] **Step 3: Import execution module**

In `apps/quantify/src/modules/positions/positions.module.ts`, import and add:

```ts
import { TradingExecutionModule } from '@/modules/trading-execution/trading-execution.module'
```

Then include `TradingExecutionModule` in `imports`.

- [ ] **Step 4: Inject and use TradingExecutionService**

In `apps/quantify/src/modules/positions/positions.service.ts`:

1. Import:

```ts
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
```

2. Add constructor dependency:

```ts
private readonly tradingExecution: TradingExecutionService,
```

3. Replace direct `tradingService.placeOrder(...)` in `closePosition()` with:

```ts
const executionResult = await this.tradingExecution.executeIntent({
  source: 'position_tool',
  sourceId: dto.positionId,
  userId: position.account.userId,
  exchangeId,
  marketType,
  symbol: executionSymbol,
  side: orderSide,
  type: 'market',
  amount: closeQuantity.toNumber(),
  role: position.positionSide === PositionSide.LONG ? 'close_long' : 'close_short',
  reduceOnly: true,
  metadata: {
    positionId: dto.positionId,
    userStrategyAccountId: dto.userStrategyAccountId,
  },
})

if (executionResult.status === 'waiting_position') {
  throw new DomainException('position.close_waiting_position', {
    code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
    args: { positionId: dto.positionId, reason: executionResult.reason },
  })
}
if (executionResult.status !== 'submitted') {
  throw new DomainException('position.close_execution_failed', {
    code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
    args: { positionId: dto.positionId, status: executionResult.status, reason: executionResult.reason },
  })
}

const order = executionResult.order
```

- [ ] **Step 5: Run positions tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/positions
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/positions/positions.module.ts apps/quantify/src/modules/positions/positions.service.ts apps/quantify/src/modules/positions
git commit -F - <<'MSG'
fix: 自动平仓接入通用执行内核

变更说明：
- 平仓订单改走 TradingExecutionService
- 无可平仓位时不提交交易所
- 保留现有本地成交记录流程

Refs: #955
MSG
```

## Task 7: Full Regression and PR Update

**Files:**
- No new source files unless previous tests reveal compile issues.
- PR: existing PR for issue #955.

- [ ] **Step 1: Run focused unit test suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts
dx test unit quantify apps/quantify/src/modules/trading-execution
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/positions
```

Expected: all PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 3: Run affected build**

Run:

```bash
dx build affected --dev
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: clean working tree on `codex/fix/955-quant-strategy-execution-bug` after all task commits.

- [ ] **Step 5: Push branch**

Run:

```bash
git push origin codex/fix/955-quant-strategy-execution-bug
```

Expected: push succeeds.

- [ ] **Step 6: Add PR comment**

Run:

```bash
gh pr comment 956 --body-file - <<'MSG'
已按通用量化执行内核方案完成迁移：

- 新增 TradingExecutionService，统一 constraints、clientOrderId、price/quantity normalization、reduce-only 持仓门禁和结构化执行结果。
- 网格 runtime、信号执行最终下单、自动平仓均接入统一执行内核。
- OKX 缺少 instrument constraints 时失败关闭，不再提交不确定精度订单。
- 无对应仓位的 close/reduce-only 订单进入 waiting_position，不再把单个等待平仓单当成交易所提交失败。
- 已增加策略广场 6 个已调通策略的信号下单语义回归测试，保护 symbol/marketType/side/amount/price/reduceOnly/exchangeAccountId 不回退。

验证：
- dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts
- dx test unit quantify apps/quantify/src/modules/trading-execution
- dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/positions
- dx lint
- dx build affected --dev
MSG
```

Expected: PR comment URL printed.

## Self-Review Checklist

- Spec coverage:
  - Shared execution path: Tasks 2, 3, 4, 5, 6.
  - Fail closed constraints: Tasks 1 and 3.
  - Normalize symbol, price, quantity, contract size, client order id: Tasks 1 and 2.
  - Reduce-only/close admission gate: Task 3 plus callers in Tasks 4, 5, 6.
  - Caller-owned persistence: Tasks 4, 5, 6 keep grid/signal/positions persistence in callers.
  - Six signal strategy regression protection: Task 5.

- Placeholder scan:
  - No task may contain vague markers, deferred implementation wording, or unexplained test-writing instructions.
  - Every task includes exact files, commands, and expected results.

- Type consistency:
  - `OrderIntent`, `TradingExecutionResult`, and `TradingExecutionConstraints` are defined in Task 2 before later tasks use them.
  - `TradingExecutionService.executeIntent()` returns the statuses used by grid, signal, and positions tasks.

# Quantify Market Data Spot/Perp Schema-Stable Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改 Prisma schema 的前提下，让 `apps/quantify` 同时支持现货与合约策略行情（先 Binance），并为后续 OKX/Hyperliquid 接入复用同一模式。

**Architecture:** 保持 `MarketDataProvider` 对外接口不变，在 provider 内按 symbol code 后缀（`:SPOT`/`:PERP`）路由 URL 与参数模板。通过 symbol code 规范化 + 一次性数据回填解决同码冲突，不引入 schema 迁移。

**Tech Stack:** NestJS 11, Prisma 7, Jest, dx, TypeScript 5.9, Binance REST/WS

---

## File Map

- `apps/quantify/src/modules/market-data/utils/market-symbol-code.util.ts`
用途：统一 symbol code 规范化、解析与兼容（`BTCUSDT` -> `BTCUSDT:SPOT`）。

- `apps/quantify/src/modules/market-data/services/market-data.service.ts`
用途：统一 symbol 查找、upsert、缓存键；支持旧码兼容和新码精确匹配。

- `apps/quantify/src/modules/market-data/providers/binance-market-data.provider.ts`
用途：同一 provider 内实现 spot/perp 路由（URL+参数模板切换），不拆双实现。

- `apps/quantify/src/config/configuration.ts`
用途：新增 spot/perp 专用 REST/WS 基础 URL 与参数模板配置；保留旧配置兼容。

- `dx/config/env-policy.jsonc` 与 `.env.example`
用途：声明并示例化新环境变量（REST/WS 基础 URL + 参数模板）。

- `apps/quantify/scripts/backfill-market-symbol-codes.ts`
用途：一次性将历史无后缀 code 回填为 `:SPOT`（可 dry-run）。

- `apps/quantify/src/modules/market-data/services/__tests__/market-data.service.symbol-code.spec.ts`
用途：验证 symbol code 兼容查找和 upsert 行为。

- `apps/quantify/src/modules/market-data/providers/__tests__/binance-market-data.provider.spec.ts`
用途：验证 Binance provider spot/perp URL 与参数路由、WS payload 映射统一输出。

- `apps/quantify/src/config/__tests__/configuration.market-data.spec.ts`
用途：验证 market-data 新增配置项默认值与兼容回退。

- `apps/quantify/e2e/market-data/market-data.e2e-spec.ts`
用途：补一条 `:PERP` 路径验证。

执行与提交前置要求：必须在 Issue 分支（`codex/fix/461-*`）上操作。

执行时请遵循：`@superpowers/test-driven-development`、`@superpowers/verification-before-completion`。

### Task 1: 建立 Symbol Code 规范化与兼容读取

**Files:**
- Create: `apps/quantify/src/modules/market-data/utils/market-symbol-code.util.ts`
- Create: `apps/quantify/src/modules/market-data/services/__tests__/market-data.service.symbol-code.spec.ts`
- Modify: `apps/quantify/src/modules/market-data/services/market-data.service.ts`

- [ ] **Step 1: 写失败用例（旧码 fallback + 新码精确匹配）**
```ts
it('prefers :SPOT over legacy when both exist', async () => {
  await prisma.symbol.createMany({
    data: [
      {
        code: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
      {
        code: 'BTCUSDT:SPOT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
    ],
  })
  await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toMatchObject({ code: 'BTCUSDT:SPOT' })
})

it('prefers exact suffixed symbol', async () => {
  await expect(service.getSymbolOrThrow('BTCUSDT:PERP')).resolves.toMatchObject({ code: 'BTCUSDT:PERP' })
})

it('warns when unsuffixed symbol matches both spot/perp', async () => {
  jest.spyOn(service['logger'], 'warn')
  await prisma.symbol.createMany({
    data: [
      {
        code: 'BTCUSDT:SPOT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
      {
        code: 'BTCUSDT:PERP',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        instrumentType: 'PERPETUAL',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
    ],
  })
  await service.getSymbolOrThrow('BTCUSDT')
  expect(service['logger'].warn).toHaveBeenCalledWith(expect.stringContaining('ambiguous symbol'), expect.anything())
})

it('falls back to legacy code before backfill', async () => {
  await prisma.symbol.create({
    data: {
      code: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      instrumentType: 'SPOT',
      type: 'CRYPTO',
      status: 'ACTIVE',
    },
  })
  await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toMatchObject({ code: 'BTCUSDT' })
})

it('does not warn on other-exchange duplicates when exchange is specified', async () => {
  jest.spyOn(service['logger'], 'warn')
  await prisma.symbol.createMany({
    data: [
      {
        code: 'BTCUSDT:SPOT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        instrumentType: 'SPOT',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
      {
        code: 'BTCUSDT:PERP',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'OKX',
        instrumentType: 'PERPETUAL',
        type: 'CRYPTO',
        status: 'ACTIVE',
      },
    ],
  })
  await service.getSymbolOrThrow('BTCUSDT', 'BINANCE')
  expect(service['logger'].warn).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行单测确认失败**
Run: `dx test unit quantify`  
Expected: 新增 symbol-code 测试失败（兼容逻辑尚未实现）

- [ ] **Step 3: 实现最小 symbol code 工具函数**
```ts
export type SymbolMarketType = 'SPOT' | 'PERP'
export const instrumentTypeToMarket = (instrumentType: string): SymbolMarketType => {
  const upper = instrumentType.trim().toUpperCase()
  if (upper === 'PERPETUAL' || upper === 'FUTURE') return 'PERP'
  return 'SPOT'
}
export const toSymbolCode = (raw: string, market: SymbolMarketType) => `${raw.trim().toUpperCase()}:${market}`
export const normalizeRequestedCode = (input: string) => input.includes(':') ? input.trim().toUpperCase() : toSymbolCode(input, 'SPOT')
export const normalizeExactCode = (input: string) => input.trim().toUpperCase()
export const normalizeProviderCode = (raw: string, instrumentType: string) =>
  toSymbolCode(raw, instrumentTypeToMarket(instrumentType))
export const extractRawSymbol = (symbolCode: string) => symbolCode.trim().toUpperCase().split(':')[0]
export const parseSymbolMarket = (code: string): SymbolMarketType => {
  const upper = code.trim().toUpperCase()
  if (upper.includes(':PERP')) return 'PERP'
  if (upper.includes(':SPOT') || !upper.includes(':')) return 'SPOT'
  throw new Error(`Unknown symbol market suffix: ${code}`)
}
```

- [ ] **Step 4: 在 MarketDataService 接入兼容查找与缓存键（包含歧义告警）**
```ts
// 签名调整：getSymbolOrThrow(symbolCode, exchange?)
const exchange = exchangeInput?.trim().toUpperCase()
const exact = normalizeExactCode(symbolCode)
const fallback = normalizeRequestedCode(symbolCode)
const raw = symbolCode.trim().toUpperCase().split(':')[0]
// 优先级：exact(带后缀) -> spotCode -> legacy(无后缀)
const spotCode = toSymbolCode(raw, 'SPOT')
const perpCode = toSymbolCode(raw, 'PERP')
const candidates = await this.prisma.symbol.findMany({
  where: {
    code: { in: [spotCode, perpCode] },
    ...(exchange ? { exchange } : {}),
  },
  select: { code: true },
})
const hasSpot = candidates.some(item => item.code === spotCode)
const hasPerp = candidates.some(item => item.code === perpCode)
if (!symbolCode.includes(':') && hasSpot && hasPerp) {
  this.logger.warn(`ambiguous symbol code, default to SPOT: ${symbolCode}`)
}
const exactHit = await this.prisma.symbol.findUnique({ where: { code: exact } })
const spotHit = await this.prisma.symbol.findUnique({ where: { code: spotCode } })
const legacy = await this.prisma.symbol.findUnique({ where: { code: raw } })
const fallbackHit = await this.prisma.symbol.findUnique({ where: { code: fallback } })
const resolved = exactHit
  ?? spotHit
  ?? (!symbolCode.includes(':') ? legacy : null)
  ?? fallbackHit
if (resolved) {
  const canonicalCode = normalizeExactCode(resolved.code)
  this.symbolIdCache.set(canonicalCode, resolved.id)
  this.symbolCodeCache.set(resolved.id, canonicalCode)
  return resolved
}
```

- [ ] **Step 4.1: 更新所有调用点传入 exchange（如果可用）**
```ts
// MarketDataService.getBars/getLatestQuote 等调用点传入 query.exchange
await this.getSymbolOrThrow(query.symbol, query.exchange)
```

- [ ] **Step 5: 更新 upsertSymbolsFromProvider 使用规范化 code**
```ts
const code = normalizeProviderCode(symbol.symbol, symbol.instrumentType)
```

- [ ] **Step 6: 回归单测并提交**
Run: `dx test unit quantify`  
Expected: symbol-code 相关测试通过

```bash
git add apps/quantify/src/modules/market-data/utils/market-symbol-code.util.ts \
  apps/quantify/src/modules/market-data/services/__tests__/market-data.service.symbol-code.spec.ts \
  apps/quantify/src/modules/market-data/services/market-data.service.ts
git commit -F - <<'MSG'
refactor: normalize market symbol codes with spot fallback

Refs: #461
MSG
```

### Task 2: Binance Provider 接入 Spot/Perp URL 与参数路由

**Files:**
- Modify: `apps/quantify/src/modules/market-data/providers/binance-market-data.provider.ts`
- Create: `apps/quantify/src/modules/market-data/providers/__tests__/binance-market-data.provider.spec.ts`

- [ ] **Step 1: 写失败用例（REST 路由与 WS stream 路由 + WS payload 映射）**
```ts
it('routes BTCUSDT:PERP historical bars to perp REST endpoint', async () => {
  await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })
  expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/fapi'), expect.anything())
})

it('uses raw symbol for REST params', async () => {
  await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })
  expect(http.get).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    params: expect.objectContaining({ symbol: 'BTCUSDT' }),
  }))
})

it('routes BTCUSDT:SPOT to spot stream template', async () => {
  // 断言 stream 组装包含 spot 模板
})

it('uses raw symbol for WS stream', async () => {
  await provider.subscribe({ symbols: ['BTCUSDT:PERP'], timeframes: ['1m'], onTick: jest.fn(), onKline: jest.fn() })
  const url = (WebSocket as jest.Mock).mock.calls[0]?.[0] as string
  expect(url).toContain('btcusdt@kline_1m')
})

it('maps perp WS payload to MarketBarPayload with :PERP code', () => {
  const payload = provider.mapWsKline(perpEvent)
  expect(payload.symbol).toBe('BTCUSDT:PERP')
  expect(payload).toMatchObject({ open: '1', high: '2', low: '0.5', close: '1.5', volume: '10' })
})

it('opens separate ws connections for spot/perp', async () => {
  await provider.subscribe({
    symbols: ['BTCUSDT:SPOT', 'ETHUSDT:PERP'],
    timeframes: ['1m'],
    onTick: jest.fn(),
    onKline: jest.fn(),
  })
  const urls = (WebSocket as jest.Mock).mock.calls.map(([url]) => url as string)
  const spotUrl = urls.find(url => url.includes('stream.binance.com')) ?? ''
  const perpUrl = urls.find(url => url.includes('fstream.binance.com')) ?? ''
  expect(spotUrl).toContain('btcusdt@kline_1m')
  expect(perpUrl).toContain('ethusdt@kline_1m')
})

it('logs reconnect metric with market tag', () => {
  jest.spyOn(provider['logger'], 'warn')
  provider['scheduleReconnect']('PERP')
  expect(provider['logger'].warn).toHaveBeenCalledWith(expect.stringContaining('market=PERP'))
})
```

- [ ] **Step 2: 运行单测确认失败**
Run: `dx test unit quantify`  
Expected: provider 新测试失败

- [ ] **Step 3: 实现 symbol market 解析与 URL 选择器（REST + WS）**
```ts
const market = parseSymbolMarket(query.symbol) // SPOT|PERP
const rawSymbol = extractRawSymbol(query.symbol) // remove :SPOT/:PERP
const restBase = market === 'PERP' ? this.perpRestBaseUrl : this.spotRestBaseUrl
const wsBase = market === 'PERP' ? this.perpWsBaseUrl : this.spotWsBaseUrl
const restParamsTemplate = market === 'PERP' ? this.perpRestParamsTemplate : this.spotRestParamsTemplate
const wsStreamTemplate = market === 'PERP' ? this.perpWsStreamTemplate : this.spotWsStreamTemplate
const restParams = applyTemplate(restParamsTemplate, { symbol: rawSymbol, interval: query.timeframe, limit })
const stream = applyTemplate(wsStreamTemplate, { symbolLower: rawSymbol.toLowerCase(), interval: tf })
const restPath = market === 'PERP' ? this.perpRestPathTemplate : this.spotRestPathTemplate
const restUrl = new URL(restPath, restBase)
const exchangeInfoPath = market === 'PERP' ? this.perpExchangeInfoPath : this.spotExchangeInfoPath
```

- [ ] **Step 4: 实现 fetchSymbols 双市场拉取（同 API 形态）**
```ts
const spot = await this.fetchExchangeInfo('SPOT', requestedRawSymbols)
const perp = await this.fetchExchangeInfo('PERP', requestedRawSymbols)
return [...spot, ...perp]
```

- [ ] **Step 4.1: 适配 Binance futures exchangeInfo 并设置 instrumentType**
```ts
if (market === 'PERP') {
  return data.symbols.map(item => ({
    symbol: item.symbol,
    status: item.status,
    baseAsset: item.baseAsset,
    quoteAsset: item.quoteAsset,
    type: 'CRYPTO',
    instrumentType: 'PERPETUAL',
    isMarginTradingAllowed: false,
    filters: this.mapFilters(item.filters),
    exchange: this.name,
  }))
}
```

- [ ] **Step 4.2: 测试 futures exchangeInfo 映射**
```ts
it('maps futures exchangeInfo to PERPETUAL instrumentType', async () => {
  mockExchangeInfo('PERP', { symbols: [{ symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT', filters: [] }] })
  const symbols = await provider.fetchSymbols()
  expect(symbols.find(item => item.symbol === 'BTCUSDT')?.instrumentType).toBe('PERPETUAL')
})
```

- [ ] **Step 5: 订阅按 market 分流，WS 独立连接（故障隔离）**
```ts
const markets = groupSymbolsByMarket(params.symbols)
this.wsByMarket = {
  SPOT: await this.openWebSocket('SPOT', markets.SPOT),
  PERP: await this.openWebSocket('PERP', markets.PERP),
}
this.reconnectTimers = { SPOT: undefined, PERP: undefined }
this.currentStreamsByMarket = { SPOT: buildStream(markets.SPOT), PERP: buildStream(markets.PERP) }
```

- [ ] **Step 5.1: 兼容旧单 WS 配置键（MARKET_DATA_WS_STREAM_PATH）**
```ts
this.spotWsPathTemplate = env.str('MARKET_DATA_SPOT_WS_PATH_TEMPLATE', env.str('MARKET_DATA_WS_STREAM_PATH', 'stream?streams='))
this.perpWsPathTemplate = env.str('MARKET_DATA_PERP_WS_PATH_TEMPLATE', env.str('MARKET_DATA_WS_STREAM_PATH', 'stream?streams='))
```

- [ ] **Step 5.2: 改造 disconnect / reconnect 以支持双连接**
```ts
await this.closeWebSocket('SPOT')
await this.closeWebSocket('PERP')
this.reconnectTimers = { SPOT: undefined, PERP: undefined }
```

- [ ] **Step 6: 保持输出结构统一（MarketBarPayload 不变）**
```ts
return { symbol: normalizedCode, timeframe, open, high, low, close, volume, timestamp, source }
```

- [ ] **Step 6.1: 全部输出统一使用规范化 symbol（Bar/Quote/WS/REST）**
```ts
const normalizedCode = toSymbolCode(rawSymbol, market)
return { symbol: normalizedCode, ... } // adaptRestBar/adaptWsKline/adaptTicker
```

- [ ] **Step 7: 增加 market 级故障隔离与可观测性**
```ts
this.logger.log(`metric=market_ws_connected value=1 market=${market}`)
this.logger.warn(`metric=market_ws_reconnect_total value=1 market=${market}`)
this.logger.error(`ws_payload_parse_failed market=${market} stream=${payload.stream} symbol=${symbol}`)
throw error
```

- [ ] **Step 8: 回归单测并提交**
Run: `dx test unit quantify`  
Expected: provider 路由测试通过

```bash
git add apps/quantify/src/modules/market-data/providers/binance-market-data.provider.ts \
  apps/quantify/src/modules/market-data/providers/__tests__/binance-market-data.provider.spec.ts
git commit -F - <<'MSG'
feat: add binance spot/perp market routing in single provider

Refs: #461
MSG
```

### Task 3: 配置层支持 Spot/Perp 端点与参数模板

**Files:**
- Modify: `apps/quantify/src/config/configuration.ts`
- Create: `apps/quantify/src/config/__tests__/configuration.market-data.spec.ts`
- Modify: `dx/config/env-policy.jsonc`
- Modify: `.env.example`
- Modify: `apps/quantify/src/modules/market-data/services/market-data-ingestion.service.ts`

- [ ] **Step 1: 写失败用例（配置缺失时默认值回退）**
```ts
import { marketDataConfig } from '../configuration'

it('uses spot/perp defaults when dedicated envs are absent', () => {
  process.env.MARKET_DATA_API_BASE_URL = 'https://api.binance.com'
  const config = marketDataConfig()
  expect(config.spotRestBaseUrl).toBe('https://api.binance.com')
  expect(config.spotWsBaseUrl).toContain('stream.binance.com')
  expect(config.perpRestBaseUrl).toContain('fapi.binance.com')
  expect(config.perpWsBaseUrl).toContain('fstream.binance.com')
})
```

- [ ] **Step 2: 运行单测确认失败**
Run: `dx test unit quantify`  
Expected: 新配置键未定义导致失败

- [ ] **Step 3: 在 marketDataConfig 增加专用配置键并兼容旧键**
```ts
spotRestBaseUrl: env.str('MARKET_DATA_SPOT_REST_BASE_URL', env.str('MARKET_DATA_API_BASE_URL', 'https://api.binance.com'))
spotWsBaseUrl: env.str('MARKET_DATA_SPOT_WS_BASE_URL', env.str('MARKET_DATA_WS_URL', 'wss://stream.binance.com:9443'))
perpRestBaseUrl: env.str('MARKET_DATA_PERP_REST_BASE_URL', 'https://fapi.binance.com')
perpWsBaseUrl: env.str('MARKET_DATA_PERP_WS_BASE_URL', 'wss://fstream.binance.com')
spotRestParamsTemplate: env.str('MARKET_DATA_SPOT_REST_PARAMS_TEMPLATE', 'symbol={symbol}&interval={interval}&limit={limit}')
perpRestParamsTemplate: env.str('MARKET_DATA_PERP_REST_PARAMS_TEMPLATE', 'symbol={symbol}&interval={interval}&limit={limit}')
spotWsStreamTemplate: env.str('MARKET_DATA_SPOT_WS_STREAM_TEMPLATE', '{symbolLower}@kline_{interval}')
perpWsStreamTemplate: env.str('MARKET_DATA_PERP_WS_STREAM_TEMPLATE', '{symbolLower}@kline_{interval}')
spotRestPathTemplate: env.str('MARKET_DATA_SPOT_REST_PATH_TEMPLATE', '/api/v3/klines')
perpRestPathTemplate: env.str('MARKET_DATA_PERP_REST_PATH_TEMPLATE', '/fapi/v1/klines')
spotExchangeInfoPath: env.str('MARKET_DATA_SPOT_EXCHANGE_INFO_PATH', '/api/v3/exchangeInfo')
perpExchangeInfoPath: env.str('MARKET_DATA_PERP_EXCHANGE_INFO_PATH', '/fapi/v1/exchangeInfo')
spotWsPathTemplate: env.str('MARKET_DATA_SPOT_WS_PATH_TEMPLATE', env.str('MARKET_DATA_WS_STREAM_PATH', 'stream?streams='))
perpWsPathTemplate: env.str('MARKET_DATA_PERP_WS_PATH_TEMPLATE', env.str('MARKET_DATA_WS_STREAM_PATH', 'stream?streams='))
```

- [ ] **Step 4: 更新 env-policy 与 .env.example**
```env
MARKET_DATA_SPOT_REST_BASE_URL=https://api.binance.com
MARKET_DATA_SPOT_WS_BASE_URL=wss://stream.binance.com:9443
MARKET_DATA_PERP_REST_BASE_URL=https://fapi.binance.com
MARKET_DATA_PERP_WS_BASE_URL=wss://fstream.binance.com
MARKET_DATA_SPOT_REST_PARAMS_TEMPLATE=symbol={symbol}&interval={interval}&limit={limit}
MARKET_DATA_PERP_REST_PARAMS_TEMPLATE=symbol={symbol}&interval={interval}&limit={limit}
MARKET_DATA_SPOT_WS_STREAM_TEMPLATE={symbolLower}@kline_{interval}
MARKET_DATA_PERP_WS_STREAM_TEMPLATE={symbolLower}@kline_{interval}
MARKET_DATA_SPOT_REST_PATH_TEMPLATE=/api/v3/klines
MARKET_DATA_PERP_REST_PATH_TEMPLATE=/fapi/v1/klines
MARKET_DATA_SPOT_EXCHANGE_INFO_PATH=/api/v3/exchangeInfo
MARKET_DATA_PERP_EXCHANGE_INFO_PATH=/fapi/v1/exchangeInfo
MARKET_DATA_SPOT_WS_PATH_TEMPLATE=stream?streams=
MARKET_DATA_PERP_WS_PATH_TEMPLATE=stream?streams=
```

- [ ] **Step 5: 在 ingestion 启动日志打印 spot/perp endpoint 摘要**
```ts
this.logger.log(`marketData endpoints spotRest=${config.spotRestBaseUrl} spotWs=${config.spotWsBaseUrl} perpRest=${config.perpRestBaseUrl} perpWs=${config.perpWsBaseUrl}`)
```

- [ ] **Step 6: 回归并提交**
Run: `dx test unit quantify`  
Expected: 配置与 ingestion 测试通过

```bash
git add apps/quantify/src/config/configuration.ts \
  dx/config/env-policy.jsonc \
  .env.example \
  apps/quantify/src/modules/market-data/services/market-data-ingestion.service.ts
git commit -F - <<'MSG'
chore: add spot/perp market-data endpoint config with compatibility defaults

Refs: #461
MSG
```

### Task 4: 一次性数据回填（无 schema 变更）

**Files:**
- Create: `apps/quantify/scripts/backfill-market-symbol-codes.ts`
- Create: `apps/quantify/scripts/__tests__/backfill-market-symbol-codes.spec.ts`
- Modify: `apps/quantify/src/modules/market-data/README.md`

- [ ] **Step 1: 写失败用例（仅回填无后缀 code）**
```ts
it('appends :SPOT to unsuffixed symbols only', async () => {
  // BTCUSDT -> BTCUSDT:SPOT
  // BTCUSDT:PERP 保持不变
})

it('is idempotent when run twice', async () => {
  // 执行两次后，第二次更新数为 0
})
```

- [ ] **Step 2: 运行单测确认失败**
Run: `dx test unit quantify`  
Expected: 回填脚本测试失败

- [ ] **Step 3: 实现脚本（支持 --dry-run / --apply）**
```ts
await prisma.$transaction(async tx => {
  const rows = await tx.symbol.findMany({ where: { code: { not: { contains: ':' } } } })
  // dry-run 仅打印；apply 执行 update
})
```

- [ ] **Step 4: 先 dry-run，再 apply（在目标环境执行）**
Run: `pnpm --filter ./apps/quantify exec tsx scripts/backfill-market-symbol-codes.ts --dry-run`  
Expected: 输出将被改写的 symbol 列表

Run: `pnpm --filter ./apps/quantify exec tsx scripts/backfill-market-symbol-codes.ts --apply`  
Expected: 输出更新数量 > 0（首次）

- [ ] **Step 5: 在 README 增加回填执行与回滚说明**
```md
先 dry-run，再 apply；异常时按变更清单逐条回滚 code（记录旧 code -> 新 code 的映射并逐条还原）。
重复执行脚本应为幂等，不再更新已带后缀的数据。
```

- [ ] **Step 6: 回归并提交**
Run: `dx test unit quantify`  
Expected: 脚本测试通过

```bash
git add apps/quantify/scripts/backfill-market-symbol-codes.ts \
  apps/quantify/scripts/__tests__/backfill-market-symbol-codes.spec.ts \
  apps/quantify/src/modules/market-data/README.md
git commit -F - <<'MSG'
feat: add schema-stable market symbol backfill script

Refs: #461
MSG
```

### Task 5: 验证闭环（Unit + E2E + Strategy 回归）

**Files:**
- Modify: `apps/quantify/e2e/market-data/market-data.e2e-spec.ts`
- Modify: `apps/quantify/src/modules/market-data/QUICKSTART.md`
- Modify: `apps/quantify/src/modules/market-data/SUMMARY.md`

- [ ] **Step 1: 增加 `:PERP` E2E 用例（bars/quote 至少一条）**
```ts
it('GET /market/bars supports BTCUSDT:PERP', async () => {
  // 准备 symbol/code + bar 数据（prisma insert），并断言返回
})
```

- [ ] **Step 2: 先跑 market-data E2E 确认失败（缺少 :PERP 处理）**
Run: `dx test e2e quantify apps/quantify/e2e/market-data`  
Expected: FAIL（新增 :PERP 用例失败）

- [ ] **Step 3: 跑 market-data E2E 回归**
Run: `dx test e2e quantify apps/quantify/e2e/market-data`  
Expected: PASS（包含 :PERP 用例）

- [ ] **Step 4: 跑 strategy-signals E2E 回归**
Run: `dx test e2e quantify apps/quantify/e2e/strategy-signals`  
Expected: PASS（无回退）

- [ ] **Step 5: 跑 quantify 单测与 lint**
Run: `dx test unit quantify && dx lint`  
Expected: PASS

- [ ] **Step 6: 更新 QUICKSTART/SUMMARY（symbol code 规范 + 回填前置）**
```md
默认 code 规范：<RAW_SYMBOL>:SPOT|PERP
生产执行顺序：backfill -> 启动 -> 观察指标
```

- [ ] **Step 7: 提交最终验证与文档**
```bash
git add apps/quantify/e2e/market-data/market-data.e2e-spec.ts \
  apps/quantify/src/modules/market-data/QUICKSTART.md \
  apps/quantify/src/modules/market-data/SUMMARY.md
git commit -F - <<'MSG'
test: cover perp symbol path and document schema-stable rollout

Refs: #461
MSG
```

---

## Final Verification Gate

- [ ] Run: `dx test unit quantify`
- [ ] Run: `dx test e2e quantify apps/quantify/e2e/market-data`
- [ ] Run: `dx test e2e quantify apps/quantify/e2e/strategy-signals`
- [ ] Run: `dx lint`
- [ ] Confirm: 无 schema 迁移文件新增（`apps/quantify/prisma/schema` 无结构变更）

## Notes for Execution

- 严格按 TDD 顺序执行：先失败测试 -> 最小实现 -> 通过测试 -> 提交。
- 每个 Task 一次 commit，提交信息末尾保留 `Refs: #461`。
- 若发现 provider 与真实交易所 API 存在结构差异，优先通过参数模板适配，不新增第二套 provider 类。
- 若需要切分故障范围，按 `market` 维度隔离失败与重连指标，并补充结构化日志（symbol/market/source）。

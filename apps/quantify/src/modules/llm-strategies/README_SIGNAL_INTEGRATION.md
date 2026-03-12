# LLM绛栫暐淇″彿闆嗘垚鍒板紑浠撴祦绋?

## 馃搵 姒傝堪

LLM绛栫暐鐢熸垚鐨勪俊鍙风幇鍦ㄥ凡缁?*瀹屽叏闆嗘垚鍒板紑浠撴祦绋?*锛屼笌鏃х増绛栫暐瀹炰緥鐢熸垚鐨勪俊鍙蜂韩鍙楃浉鍚岀殑澶勭悊娴佺▼銆?

## 馃幆 瀹炵幇鐨勫姛鑳?

### 1. 淇″彿鍏ュ簱
- 鉁?鍒涘缓鐪熷疄鐨?`TradingSignal` 璁板綍
- 鉁?鍏宠仈 `llmStrategyId` 鍜?`llmStrategyInstanceId`
- 鉁?鍏宠仈 `generatedSignalId` 鍒拌繍琛岃褰?
- 鉁?淇濆瓨瀹屾暣鐨勪俊鍙锋暟鎹紙浠锋牸銆佹鎹熴€佹鐩堛€佷粨浣嶇瓑锛?

### 2. 浜嬩欢瑙﹀彂
- 鉁?鍙戝嚭 `TradingSignalCreatedEvent` 浜嬩欢
- 鉁?瑙﹀彂涓嬫父鐨勫紑浠撴祦绋?
- 鉁?涓庢棫鐗堜俊鍙蜂娇鐢ㄧ浉鍚岀殑浜嬩欢绯荤粺

### 3. 妯″紡鎺у埗
- 鉁?鍙湁 `LIVE` 妯″紡鎵嶅垱寤虹湡瀹炰俊鍙?
- 鉁?`PAPER`/`BACKTEST` 妯″紡鍙褰曞湪杩愯鏃ュ織涓?
- 鉁?閬垮厤娴嬭瘯鏃惰Е鍙戠湡瀹炰氦鏄?

## 馃梽锔?鏁版嵁搴撳彉鏇?

### Schema 淇敼

```prisma
model TradingSignal {
  // 鏃у瓧娈碉紙鍙€夛紝鐢ㄤ簬鏃х瓥鐣ワ級
  strategyId         String?  @map("strategy_id")
  strategyInstance   String?  @map("strategy_instance_id")

  // 鏂板瓧娈碉紙鐢ㄤ簬LLM绛栫暐锛?
  llmStrategyId         String?  @map("llm_strategy_id")
  llmStrategyInstanceId String?  @map("llm_strategy_instance_id")

  // 鍏宠仈
  llmStrategy         LlmStrategy?          @relation(fields: [llmStrategyId], references: [id])
  llmStrategyInstance LlmStrategyInstance?  @relation(fields: [llmStrategyInstanceId], references: [id])
}
```

### 鏁版嵁搴撶粨鏋勫彉鏇?

- 浣?`strategy_id` 鍙€?
- 娣诲姞 `llm_strategy_id` 鍜?`llm_strategy_instance_id` 瀛楁
- 鍒涘缓澶栭敭绾︽潫鍜岀储寮?

## 馃摝 鏍稿績淇敼

### 1. 宸ュ叿Schema鏇存柊 (`llm-v3-tools.ts`)

**娣诲姞 `symbol` 瀛楁**锛堝繀濉級锛?

```typescript
const tradingSignalTool = {
  parameters: {
    properties: {
      symbol: {
        type: 'string',
        description: '浜ゆ槗鏍囩殑浠ｇ爜锛屽 BTCUSDT銆丒THUSDT 绛?,
      },
      // ... 鍏朵粬瀛楁
    },
    required: ['symbol', 'direction'], // symbol 鏄繀濉瓧娈?
  }
}
```

**鏇存柊鎺ュ彛瀹氫箟**锛?

```typescript
export interface AiSignalPayloadWithMeta extends AiSignalPayload {
  symbol: string  // 蹇呭～
  meta?: Record<string, unknown>
}
```

### 2. 寮曟搸鏇存柊 (`llm-orchestrated-engine-v3.service.ts`)

**娉ㄥ叆渚濊禆**锛?

```typescript
constructor(
  // ... 鍏朵粬渚濊禆
  private readonly prisma: PrismaService,  // 鐢ㄤ簬鍒涘缓淇″彿
) {}
```

**淇″彿鐢熸垚鍚庣殑澶勭悊**锛?

```typescript
// 鍙湪 LIVE 妯″紡涓嬪垱寤虹湡瀹炰俊鍙?
if (signal && finalStatus === 'success' && instance.mode === 'LIVE') {
  generatedSignalId = await this.createTradingSignal(signal, instance, strategy, run.id)
}

// 鏇存柊杩愯璁板綍锛屽叧鑱斾俊鍙稩D
await this.runsRepo.update(run.id, {
  generatedSignalId,  // 鉁?鍏宠仈鍒涘缓鐨勪俊鍙?
  metadata: signal,
})
```

**鍒涘缓淇″彿鏂规硶**锛?

```typescript
private async createTradingSignal(
  signal: AiSignalPayloadWithMeta,
  instance: LlmStrategyInstance,
  strategy: LlmStrategy,
  runId: string,
): Promise<string> {
  // 1. 鏌ユ壘 symbol
  const symbolRecord = await client.symbol.findUnique({
    where: { code: signal.symbol },
  })

  // 2. 鍒涘缓 TradingSignal
  const tradingSignal = await client.tradingSignal.create({
    data: {
      llmStrategy: { connect: { id: strategy.id } },
      llmStrategyInstance: { connect: { id: instance.id } },
      symbol: { connect: { id: symbolRecord.id } },
      // ... 瀹屾暣鐨勪俊鍙锋暟鎹?
    }
  })

  // 3. 鍙戝嚭浜嬩欢
  this.eventEmitter.emit(
    StrategySignalEvents.CREATED,
    new TradingSignalCreatedEvent(tradingSignal.id),
  )

  return tradingSignal.id
}
```

## 馃攧 瀹屾暣娴佺▼

```mermaid
graph LR
    A[LLM璋冨害鍣ㄦ墽琛宂 --> B[LLM鍒嗘瀽甯傚満]
    B --> C[璋冪敤generate_trading_signal]
    C --> D{妫€鏌ユā寮弣
    D -->|LIVE妯″紡| E[鍒涘缓TradingSignal璁板綍]
    D -->|鍏朵粬妯″紡| F[鍙褰曞埌metadata]
    E --> G[鍏宠仈generatedSignalId]
    G --> H[鍙戝嚭TradingSignalCreatedEvent]
    H --> I[瑙﹀彂寮€浠撴祦绋媇
    F --> J[淇濆瓨鍒拌繍琛屾棩蹇梋
```

### 鏃х増瀵规瘮

| 姝ラ | 鏃х瓥鐣ュ疄渚?| LLM绛栫暐瀹炰緥锛堟柊锛墊
|-----|-----------|-----------------|
| 1. 鐢熸垚淇″彿 | SignalGeneratorService | LlmOrchestratedEngineV3 |
| 2. 鍒涘缓璁板綍 | TradingSignal | TradingSignal 鉁?|
| 3. 鍏宠仈瀛楁 | strategyId, strategyInstanceId | llmStrategyId, llmStrategyInstanceId |
| 4. 鍙戝嚭浜嬩欢 | TradingSignalCreatedEvent 鉁?| TradingSignalCreatedEvent 鉁?|
| 5. 瑙﹀彂寮€浠?| 鉁?鍙備笌 | 鉁?鍙備笌 |

## 馃摑 浣跨敤绀轰緥

### 1. 鍒涘缓LLM瀹炰緥锛圠IVE妯″紡锛?

```typescript
POST /ops/llm-strategy-instances
{
  "strategyId": "xxx",
  "name": "BTC Trend Following",
  "mode": "LIVE",  // 蹇呴』鏄疞IVE妯″紡
  "llmModel": "gpt-4",
  "scheduleCron": "*/15 * * * *"
}
```

### 2. 鍚姩瀹炰緥

```typescript
PATCH /ops/llm-strategy-instances/:id
{
  "status": "running"
}
```

### 3. LLM鐢熸垚淇″彿

LLM浼氳皟鐢ㄥ伐鍏凤細

```json
{
  "name": "generate_trading_signal",
  "arguments": {
    "symbol": "BTCUSDT",  // 蹇呭～
    "direction": "BUY",
    "signalType": "ENTRY",
    "confidence": 85,
    "entryPrice": 45000,
    "stopLoss": 44000,
    "takeProfit": 47000,
    "positionSizeRatio": 0.1,
    "reasoning": "绐佺牬鍏抽敭闃诲姏浣嶏紝鎴愪氦閲忔斁澶?
  }
}
```

### 4. 绯荤粺鑷姩澶勭悊

**LIVE妯″紡**锛?
1. 鉁?鍒涘缓 `TradingSignal` 璁板綍
2. 鉁?鍙戝嚭 `TradingSignalCreatedEvent` 浜嬩欢
3. 鉁?瑙﹀彂鐢ㄦ埛璁㈤槄鐨勫紑浠撴祦绋?
4. 鉁?璁板綍 `generatedSignalId` 鍒拌繍琛屾棩蹇?

**PAPER/BACKTEST妯″紡**锛?
1. 鉂?涓嶅垱寤?`TradingSignal` 璁板綍
2. 鉁?淇濆瓨淇″彿鍒拌繍琛屾棩蹇楃殑 `metadata`
3. 鉂?涓嶈Е鍙戠湡瀹炰氦鏄?

## 馃攳 楠岃瘉鏂规硶

### 1. 鏌ョ湅杩愯鏃ュ織

```sql
SELECT
  id,
  status,
  generated_signal_id,  -- 鍏宠仈鐨勪俊鍙稩D
  metadata->>'symbol' as symbol,
  metadata->>'direction' as direction
FROM llm_strategy_runs
WHERE strategy_instance_id = 'xxx'
ORDER BY started_at DESC;
```

### 2. 鏌ョ湅鐢熸垚鐨勪俊鍙?

```sql
SELECT
  id,
  llm_strategy_id,          -- LLM绛栫暐ID
  llm_strategy_instance_id, -- LLM瀹炰緥ID
  symbol_id,
  direction,
  status
FROM strategy_signals
WHERE llm_strategy_instance_id = 'xxx'
ORDER BY created_at DESC;
```

### 3. 鏌ョ湅淇″彿浜嬩欢

鏌ョ湅鏃ュ織涓殑浜嬩欢鍙戝嚭璁板綍锛?

```
[LlmOrchestratedEngineV3] Created TradingSignal cm5xxx for LLM strategy cm4xxx, instance cm4yyy, symbol BTCUSDT
```

## 鈿狅笍 娉ㄦ剰浜嬮」

1. **Symbol蹇呭～**锛歀LM蹇呴』鍦ㄤ俊鍙蜂腑鎸囧畾 `symbol`锛屽惁鍒欒В鏋愬け璐?
2. **妯″紡妫€鏌?*锛氬彧鏈?`LIVE` 妯″紡鎵嶄細鍒涘缓鐪熷疄淇″彿鍜岃Е鍙戜氦鏄?
3. **Symbol楠岃瘉**锛歴ymbol蹇呴』鍦ㄦ暟鎹簱涓瓨鍦紝鍚﹀垯鍒涘缓淇″彿澶辫触
4. **鍚戝悗鍏煎**锛氭棫鐨勭瓥鐣ュ疄渚嬩笉鍙楀奖鍝嶏紝浠嶄娇鐢?`strategyId` 瀛楁
5. **浜嬩欢绯荤粺**锛氫娇鐢ㄧ浉鍚岀殑浜嬩欢绯荤粺锛岀‘淇濆紑浠撴祦绋嬩竴鑷?

## 馃殌 鍚庣画鎵╁睍

### 1. 淇″彿杩囨护鍜岄獙璇?

鍙互鍦ㄥ垱寤轰俊鍙峰墠娣诲姞棰濆鐨勯獙璇侊細

```typescript
// 妫€鏌?symbol 鏄惁鍦ㄧ瓥鐣ョ殑 allowedSymbols 涓?
if (strategy.allowedSymbols) {
  const allowed = (strategy.allowedSymbols as string[])
  if (!allowed.includes(signal.symbol)) {
    throw new Error(`Symbol ${signal.symbol} not in allowedSymbols`)
  }
}
```

### 2. 淇″彿瀹℃牳娴佺▼

瀵逛簬楂樹环鍊肩瓥鐣ワ紝鍙互娣诲姞瀹℃牳姝ラ锛?

```typescript
status: instance.mode === 'LIVE' ? 'PENDING_REVIEW' : 'PENDING'
```

### 3. 椋庨櫓鎺у埗

鍦ㄥ垱寤轰俊鍙锋椂妫€鏌ラ闄╁弬鏁帮細

```typescript
// 妫€鏌ユ鎹熸瘮渚?
const stopLossRatio = (entryPrice - stopLoss) / entryPrice
if (stopLossRatio > 0.05) {  // 姝㈡崯瓒呰繃5%
  this.logger.warn(`Large stop loss ratio: ${stopLossRatio}`)
}
```

## 馃摎 鐩稿叧鏂囦欢

- `llm-v3-tools.ts` - 宸ュ叿瀹氫箟锛堟坊鍔爏ymbol瀛楁锛?
- `llm-orchestrated-engine-v3.service.ts` - 寮曟搸瀹炵幇锛堝垱寤轰俊鍙烽€昏緫锛?
- `prisma/schema/strategy_trading.prisma` - TradingSignal schema
- `prisma/schema/llm_strategies.prisma` - LLM绛栫暐schema
- `apps/backend/prisma/schema/*.prisma` - 褰撳墠鏁版嵁搴撶粨鏋勫畾涔?

## 馃帀 鎬荤粨

LLM绛栫暐鐢熸垚鐨勪俊鍙风幇鍦ㄥ凡缁?*瀹屽叏闆嗘垚鍒板紑浠撴祦绋?*锛?

鉁?**鍒涘缓鐪熷疄鐨?TradingSignal 璁板綍**
鉁?**鍏宠仈 llmStrategyId 鍜?llmStrategyInstanceId**
鉁?**鍙戝嚭 TradingSignalCreatedEvent 浜嬩欢**
鉁?**瑙﹀彂涓庢棫鐗堢浉鍚岀殑寮€浠撴祦绋?*
鉁?**鏀寔 LIVE/PAPER/BACKTEST 妯″紡鎺у埗**
鉁?**鍚戝悗鍏煎鏃х増绛栫暐瀹炰緥**

涓庢棫鐗堢瓥鐣ュ疄渚嬬敓鎴愮殑淇″彿**瀹屽叏涓€鑷寸殑澶勭悊娴佺▼**锛侌煄?

# LLM绛栫暐瀹炰緥鍔ㄦ€丆ron璋冨害绯荤粺

## 馃搵 姒傝堪

涓?`LlmStrategyInstance` 瀹炵幇浜嗗畬鏁寸殑**瀹炰緥绾у埆鍔ㄦ€乧ron璋冨害**绯荤粺锛屽埄鐢ㄦ暟鎹簱宸叉湁鐨?`scheduleCron` 瀛楁銆?

## 馃幆 鏍稿績鍔熻兘

### 1. 瀹炰緥绾у埆鐨凜ron閰嶇疆
- 姣忎釜LLM绛栫暐瀹炰緥鍙互璁剧疆鐙珛鐨刢ron琛ㄨ揪寮?(`scheduleCron`)
- 鏈缃椂浣跨敤榛樿閰嶇疆 (`*/15 * * * *`锛屾瘡15鍒嗛挓)
- Schema瀛楁宸插瓨鍦紝鏃犻渶鏁版嵁搴撹縼绉?

### 2. 鑷姩鐢熷懡鍛ㄦ湡绠＄悊
- **瀹炰緥鍚姩** (`status: running`) 鈫?濡傛灉璁剧疆浜?`scheduleCron`锛岃嚜鍔ㄥ垱寤哄苟鍚姩cron浠诲姟
- **瀹炰緥鍋滄/鏆傚仠** (`status: stopped/paused`) 鈫?鑷姩鍋滄骞舵竻鐞哻ron浠诲姟
- **鏈嶅姟閲嶅惎** 鈫?鑷姩鎭㈠鎵€鏈?`running` 鐘舵€佷笖鏈?`scheduleCron` 鐨勫疄渚?

### 3. 鍔ㄦ€佽皟搴︽洿鏂?
- 鏇存柊 `scheduleCron` 鏃讹紝濡傛灉瀹炰緥姝ｅ湪杩愯锛岃嚜鍔ㄩ噸鍚皟搴︿换鍔?
- 鏀寔鐑洿鏂帮紝鏃犻渶閲嶅惎鏈嶅姟

## 馃梽锔?鏁版嵁搴揝chema

**Schema宸插瓨鍦紝鏃犻渶淇敼锛?*

```prisma
model LlmStrategyInstance {
  id                    String                       @id @default(cuid())
  strategyId            String                       @map("strategy_id")
  name                  String
  status                LlmStrategyInstanceStatus    @default(paused)
  mode                  LlmStrategyInstanceMode      @default(PAPER)
  llmModel              String                       @map("llm_model")
  scheduleCron          String?                      @map("schedule_cron")  // 鉁?宸插瓨鍦?
  maxToolCallsPerRun    Int?                         @map("max_tool_calls_per_run")
  maxRunsPerHour        Int?                         @map("max_runs_per_hour")
  cooldownSeconds       Int?                         @map("cooldown_seconds")
  // ... 鍏朵粬瀛楁
}
```

## 馃摝 鏍稿績缁勪欢

### 1. LlmStrategyInstanceSchedulerService

**浣嶇疆**锛歚services/llm-strategy-instance-scheduler.service.ts`

**鑱岃矗**锛?
- 绠＄悊鎵€鏈塋LM瀹炰緥绾у埆鐨刢ron浠诲姟
- 瀹炵幇 `OnModuleInit` 鍜?`OnModuleDestroy` 鐢熷懡鍛ㄦ湡閽╁瓙
- 鎻愪緵鍚姩/鍋滄/閲嶅惎瀹炰緥璋冨害鐨勬柟娉?

**鏍稿績鏂规硶**锛?

```typescript
class LlmStrategyInstanceSchedulerService {
  // 鍚姩瀹炰緥鐨勮皟搴︿换鍔?
  async startInstance(instance: LlmStrategyInstance | string): Promise<void>

  // 鍋滄瀹炰緥鐨勮皟搴︿换鍔?
  stopInstance(instanceId: string): void

  // 閲嶅惎瀹炰緥鐨勮皟搴︿换鍔?
  async restartInstance(instanceId: string): Promise<void>

  // 鎭㈠鎵€鏈塺unning鐘舵€佺殑瀹炰緥
  private async recoverRunningInstances(): Promise<void>
}
```

### 2. LlmStrategyInstancesService 闆嗘垚

**鏇存柊鐐?*锛?
- 鍦?`update` 鏂规硶涓泦鎴愯皟搴﹀櫒
- 鐘舵€佸彉鏇存椂鑷姩璋冪敤 `handleSchedulerOnStatusChange`
- 鍒犻櫎瀹炰緥鏃舵竻鐞嗚皟搴︿换鍔?
- 鏇存柊 `scheduleCron` 鏃堕噸鍚换鍔★紙濡傛灉瀹炰緥姝ｅ湪杩愯锛?

```typescript
// 鐘舵€佸彉鏇村鐞?
private async handleSchedulerOnStatusChange(
  instance: LlmStrategyInstance,
  oldStatus: LlmStrategyInstanceStatus,
  newStatus: LlmStrategyInstanceStatus,
): Promise<void> {
  if (newStatus === 'running' && oldStatus !== 'running') {
    if (instance.scheduleCron) {
      await this.scheduler.startInstance(instance)
    }
  } else if (newStatus !== 'running' && oldStatus === 'running') {
    this.scheduler.stopInstance(instance.id)
  }
}
```

### 3. 璋冨害浠诲姟鎵ц

姣忔cron瑙﹀彂鏃讹紝浼氳皟鐢?`LlmOrchestratedEngineV3.runForInstance`锛?

```typescript
await this.engine.runForInstance(
  instanceData.id,
  instanceData.createdBy,
  {
    triggerSource: 'cron_schedule',  // 鏍囪涓篶ron瑙﹀彂
    now: new Date(),
  },
  {
    skipGuards: false,  // 閬靛惊棰戠巼闄愬埗銆佸喎鍗存椂闂寸瓑
  }
)
```

## 馃攧 宸ヤ綔娴佺▼

### 鍒涘缓瀹炰緥
```mermaid
graph LR
    A[鍒涘缓瀹炰緥] --> B[status: paused]
    B --> C[璁剧疆scheduleCron鍙€塢
    C --> D[瀹炰緥淇℃伅淇濆瓨鍒版暟鎹簱]
    D --> E[涓嶅垱寤篶ron浠诲姟]
```

### 鍚姩瀹炰緥
```mermaid
graph LR
    A[鏇存柊status=running] --> B[鏁版嵁搴撴洿鏂癩
    B --> C{鏄惁鏈塻cheduleCron?}
    C -->|鏄瘄 D[handleSchedulerOnStatusChange]
    C -->|鍚 H[浠呭惎鍔ㄥ疄渚?鏃犺嚜鍔ㄨ皟搴
    D --> E[scheduler.startInstance]
    E --> F[鍒涘缓CronJob]
    F --> G[鍚姩瀹氭椂浠诲姟]
```

### 鍋滄瀹炰緥
```mermaid
graph LR
    A[鏇存柊status=stopped/paused] --> B[鏁版嵁搴撴洿鏂癩
    B --> C[handleSchedulerOnStatusChange]
    C --> D[scheduler.stopInstance]
    D --> E[鍋滄CronJob]
    E --> F[娓呯悊鍐呭瓨寮曠敤]
```

### 鏈嶅姟閲嶅惎
```mermaid
graph LR
    A[鏈嶅姟鍚姩] --> B[OnModuleInit]
    B --> C[recoverRunningInstances]
    C --> D[鏌ヨ鎵€鏈塺unning瀹炰緥]
    D --> E{鏄惁鏈塻cheduleCron?}
    E -->|鏄瘄 F[鍒涘缓cron浠诲姟]
    E -->|鍚 G[璺宠繃]
```

## 馃摑 浣跨敤绀轰緥

### 1. 鍒涘缓瀹炰緥锛堣缃畇cheduleCron锛?

```typescript
POST /ops/llm-strategy-instances
{
  "strategyId": "xxx",
  "name": "My LLM Strategy",
  "llmModel": "gpt-4",
  "mode": "PAPER",
  "scheduleCron": "*/10 * * * *",  // 姣?0鍒嗛挓杩愯涓€娆?
  "maxToolCallsPerRun": 10,
  "maxRunsPerHour": 6,
  "cooldownSeconds": 300
}
```

瀹炰緥鍒涘缓鍚庣姸鎬佷负 `paused`锛屼笉浼氳嚜鍔ㄦ墽琛屻€?

### 2. 鍚姩瀹炰緥锛堣嚜鍔ㄥ垱寤鸿皟搴︼級

```typescript
PATCH /ops/llm-strategy-instances/:id
{
  "status": "running"
}
```

**绯荤粺浼氳嚜鍔細**
1. 鏇存柊鏁版嵁搴撶姸鎬佷负 `running`
2. 妫€鏌ユ槸鍚︽湁 `scheduleCron`
3. 濡傛灉鏈夛紝鍒涘缓cron浠诲姟骞跺紑濮嬪畾鏃舵墽琛?

### 3. 鏇存柊scheduleCron锛堢儹鏇存柊锛?

```typescript
PATCH /ops/llm-strategy-instances/:id
{
  "scheduleCron": "*/20 * * * *"  // 鏀逛负姣?0鍒嗛挓
}
```

濡傛灉瀹炰緥姝ｅ湪杩愯锛岀郴缁熶細鑷姩閲嶅惎璋冨害浠诲姟銆?

### 4. 鍋滄鑷姩璋冨害锛堟竻闄cheduleCron锛?

```typescript
PATCH /ops/llm-strategy-instances/:id
{
  "scheduleCron": null
}
```

濡傛灉瀹炰緥姝ｅ湪杩愯锛岀郴缁熶細鍋滄璋冨害浠诲姟銆傚疄渚嬩粛鍙墜鍔ㄨЕ鍙戙€?

### 5. 鎵嬪姩瑙﹀彂锛堜笉鍙梒ron闄愬埗锛?

```typescript
POST /ops/llm-strategy-instances/:id/test-run
```

**鐗圭偣**锛?
- `skipGuards: true` - 蹇界暐棰戠巼闄愬埗鍜屽喎鍗存椂闂?
- `triggerSource: 'ops_test'` - 鏍囪涓烘墜鍔ㄦ祴璇?
- 鏃犺鏄惁鏈?`scheduleCron` 閮藉彲浠ユ墽琛?

## 馃攳 璋冨害瑙﹀彂涓庝繚鎶ゆ満鍒?

### Cron瑙﹀彂
- **瑙﹀彂婧?*锛歚triggerSource: 'cron_schedule'`
- **淇濇姢鏈哄埗**锛歚skipGuards: false`
- **閬靛惊闄愬埗**锛?
  - `maxRunsPerHour` - 姣忓皬鏃舵渶澶ц繍琛屾鏁?
  - `cooldownSeconds` - 鍐峰嵈鏃堕棿
  - `maxToolCallsPerRun` - 姣忔杩愯鏈€澶у伐鍏疯皟鐢ㄦ鏁?

### 鎵嬪姩瑙﹀彂
- **瑙﹀彂婧?*锛歚triggerSource: 'ops_test'`
- **淇濇姢鏈哄埗**锛歚skipGuards: true`
- **蹇界暐闄愬埗**锛氬彲浠ラ殢鏃舵墜鍔ㄨЕ鍙戯紝涓嶅彈棰戠巼鍜屽喎鍗撮檺鍒?

## 馃搳 Cron琛ㄨ揪寮忕ず渚?

| Cron琛ㄨ揪寮?| 璇存槑 | 閫傜敤鍦烘櫙 |
|-----------|------|---------|
| `*/5 * * * *` | 姣?鍒嗛挓 | 楂橀浜ゆ槗绛栫暐 |
| `*/15 * * * *` | 姣?5鍒嗛挓锛堥粯璁わ級 | 涓绛栫暐 |
| `*/30 * * * *` | 姣?0鍒嗛挓 | 涓暱鏈熺瓥鐣?|
| `0 * * * *` | 姣忓皬鏃舵暣鐐?| 闀挎湡瓒嬪娍绛栫暐 |
| `0 0,12 * * *` | 姣忓ぉ0鐐瑰拰12鐐?| 鏃ョ骇鍒嗘瀽绛栫暐 |
| `0 9 * * 1-5` | 宸ヤ綔鏃ヤ笂鍗?鐐?| 寮€鐩樼瓥鐣?|

## 馃啔 涓庢棫绛栫暐瀹炰緥鐨勫尯鍒?

| 鐗规€?| StrategyInstance (鏃? | LlmStrategyInstance (鏂? |
|-----|----------------------|--------------------------|
| Cron瀛楁 | 鉂?鏃?| 鉁?`scheduleCron` |
| 璋冨害瀹炵幇 | 鉂?浠呭叏灞€cron | 鉁?瀹炰緥绾у埆cron |
| 鎵ц寮曟搸 | SignalGeneratorService | LlmOrchestratedEngineV3 |
| 宸ュ叿璋冪敤 | 鉂?涓嶆敮鎸?| 鉁?鏀寔 |
| 棰戠巼鎺у埗 | 鍏ㄥ眬閰嶇疆 | 瀹炰緥绾у埆閰嶇疆 |
| 鎵嬪姩瑙﹀彂 | `generate-signal` | `test-run` |

## 馃殌 鐩戞帶鍜岃皟璇?

### 鏌ョ湅杩愯涓殑璋冨害浠诲姟

```typescript
// 鍦↙lmStrategyInstanceSchedulerService涓?
getRunningInstancesCount(): number         // 杩愯涓殑浠诲姟鏁伴噺
getRunningInstanceIds(): string[]          // 鎵€鏈夎繍琛屼腑鐨勫疄渚婭D
isInstanceRunning(instanceId: string): boolean  // 妫€鏌ュ疄渚嬫槸鍚︽湁璋冨害浠诲姟
```

### 鏃ュ織绀轰緥

```
[LlmStrategyInstanceSchedulerService] 鍒濆鍖朙LM绛栫暐瀹炰緥璋冨害鏈嶅姟...
[LlmStrategyInstanceSchedulerService] 鍙戠幇 2 涓?running 鐘舵€佺殑LLM瀹炰緥锛屾鍦ㄦ仮澶嶈皟搴?..
[LlmStrategyInstanceSchedulerService] 鉁?鍚姩LLM瀹炰緥 cm5xxx 鐨勮皟搴︿换鍔★紝cron: */10 * * * *
[LlmStrategyInstanceSchedulerService] 鎴愬姛鎭㈠ 2 涓狶LM瀹炰緥鐨勮皟搴︿换鍔?

[LlmStrategyInstancesService] LLM瀹炰緥 cm5xxx 鍚姩锛屾鍦ㄥ垱寤鸿皟搴︿换鍔?..
[LlmStrategyInstanceSchedulerService] 鉁?鍚姩LLM瀹炰緥 cm5xxx 鐨勮皟搴︿换鍔★紝cron: */15 * * * *

[LlmStrategyInstancesService] LLM瀹炰緥 cm5xxx 鍋滄锛屾鍦ㄦ竻鐞嗚皟搴︿换鍔?..
[LlmStrategyInstanceSchedulerService] 鈴癸笍 鍋滄LLM瀹炰緥 cm5xxx 鐨勮皟搴︿换鍔?

[Cron] 瑙﹀彂LLM瀹炰緥 cm5xxx 鐨勬墽琛?
[LlmOrchestratedEngineV3] [CRON] Start LLM run for instance=cm5xxx
```

## 鈿狅笍 娉ㄦ剰浜嬮」

1. **鏃犻渶鏁版嵁搴撹縼绉?*锛歚scheduleCron` 瀛楁宸插瓨鍦ㄤ簬Schema涓?
2. **榛樿鐘舵€?*锛氭柊鍒涘缓鐨勫疄渚嬬姸鎬佷负 `paused`锛屼笉浼氳嚜鍔ㄦ墽琛?
3. **鍙€夎皟搴?*锛歚scheduleCron` 涓哄彲閫夊瓧娈碉紝鏈缃椂涓嶄細鍒涘缓cron浠诲姟
4. **淇濇姢鏈哄埗**锛歝ron瑙﹀彂閬靛惊 `maxRunsPerHour`銆乣cooldownSeconds` 绛夐檺鍒?
5. **鎵嬪姩瑙﹀彂涓嶅彈闄?*锛歚test-run` 鎺ュ彛缁曡繃鎵€鏈夐檺鍒讹紝鍙殢鏃惰Е鍙?

## 馃帀 鎬荤粨

LLM绛栫暐瀹炰緥鐨勫姩鎬乧ron璋冨害绯荤粺宸插畬鏁村疄鐜帮細

鉁?**寮€鍚疄渚嬫椂鑷姩杩愯cron**锛堝鏋滆缃簡 `scheduleCron`锛?
鉁?**鍋滄瀹炰緥鏃惰嚜鍔ㄥ仠姝ron**
鉁?**鏈嶅姟閲嶅惎鏃惰嚜鍔ㄦ仮澶嶆墍鏈塺unning瀹炰緥鐨刢ron**
鉁?**鏀寔瀹炰緥绾у埆鐨勮嚜瀹氫箟璋冨害棰戠巼**
鉁?**鏀寔鐑洿鏂癱ron琛ㄨ揪寮?*
鉁?**閬靛惊棰戠巼闄愬埗鍜屽喎鍗存満鍒?*
鉁?**鏀寔鎵嬪姩瑙﹀彂锛堢粫杩囨墍鏈夐檺鍒讹級**

瀹屽叏婊¤冻涓氬姟闇€姹傦紒馃帄

## 馃摎 鐩稿叧鏂囦欢

- `services/llm-strategy-instance-scheduler.service.ts` - 璋冨害鏈嶅姟鏍稿績
- `services/llm-strategy-instances.service.ts` - 涓氬姟鏈嶅姟闆嗘垚
- `llm-strategies.module.ts` - 妯″潡閰嶇疆
- `llm-orchestrated-engine-v3.service.ts` - 鎵ц寮曟搸
- `prisma/schema/llm_strategies.prisma` - 鏁版嵁妯″瀷锛堝凡鏈塻cheduleCron瀛楁锛?

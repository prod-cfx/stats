# Hyperliquid 浜ゆ槗鎵€閫傞厤鍣?

> 鉁?**鐘舵€侊細宸插畬鎴愬疄鐜?*
>
> 鏈€傞厤鍣ㄥ熀浜?[@nktkas/hyperliquid](https://www.npmjs.com/package/@nktkas/hyperliquid) SDK 瀹炵幇浜嗗畬鏁寸殑浜ゆ槗鍔熻兘銆?
>
> **娉ㄦ剰浜嬮」**锛?
> - 浠呮敮鎸佹案缁悎绾?(`marketType: 'perp'`)
> - 浣跨敤 Agent 閽卞寘绛惧悕锛屼富閽卞寘鍦板潃浣滀负璧勯噾褰掑睘
> - 鍒涘缓璐︽埛鏃朵細楠岃瘉鍑嵁鏈夋晥鎬?

## 姒傝堪

Hyperliquid 鏄竴涓幓涓績鍖栫殑姘哥画鍚堢害浜ゆ槗鎵€銆傛湰閫傞厤鍣ㄥ熀浜?[@nktkas/hyperliquid](https://www.npmjs.com/package/@nktkas/hyperliquid) SDK 瀹炵幇瀹屾暣鐨勪氦鏄撳姛鑳姐€?

## 宸插疄鐜扮壒鎬?

- 鉁?瀹屾暣瀹炵幇缁熶竴浜ゆ槗鎺ュ彛 `IExchangeClient`
- 鉁?鏀寔甯備环鍗曞拰闄愪环鍗?
- 鉁?鏀寔璁㈠崟鏌ヨ銆佸彇娑堬紙鏀寔 oid 鍜?clientOrderId锛?
- 鉁?鏀寔鎸佷粨鏌ヨ
- 鉁?鏀寔浣欓鏌ヨ
- 鉁?鏀寔琛屾儏鏌ヨ
- 鉁?浣跨敤 Agent 绉侀挜绛惧悕锛屼富閽卞寘鍦板潃浣滀负璧勯噾褰掑睘
- 鉁?鍐呯疆閫熺巼闄愬埗鍜岃姹傞噸璇曟満鍒?
- 鉁?鍒涘缓璐︽埛鏃堕獙璇佸嚟鎹湁鏁堟€?

## 閰嶇疆璇存槑

### HyperliquidConfig

```typescript
interface HyperliquidConfig {
  // 涓婚挶鍖呭湴鍧€锛堣祫閲戝綊灞炲湴鍧€锛?
  mainWalletAddress: string

  // Agent 绉侀挜锛堢敤浜庣鍚嶄氦鏄擄級
  agentPrivateKey: string
}
```

### 閰嶇疆绀轰緥

```typescript
const config: HyperliquidConfig = {
  mainWalletAddress: '0x1234...', // 涓婚挶鍖呭湴鍧€
  agentPrivateKey: '0xabcd...', // Agent 绉侀挜锛堥渶瑕佹湁涓婚挶鍖呯殑鎺堟潈锛?
}
```

## 浣跨敤鏂规硶

### 1. 鍒涘缓瀹㈡埛绔?

```typescript
import { HyperliquidClient } from './exchanges/hyperliquid-client'

const client = new HyperliquidClient(config)
await client.init() // 鍒濆鍖栧苟娴嬭瘯杩炴帴
```

### 2. 涓嬪崟

```typescript
// 闄愪环鍗?
const limitOrder = await client.createOrder({
  symbol: 'BTC/USDT:PERP',
  marketType: 'perp',
  side: 'buy',
  type: 'limit',
  amount: 0.01,
  price: 50000,
})

// 甯備环鍗?
const marketOrder = await client.createOrder({
  symbol: 'ETH/USDT:PERP',
  marketType: 'perp',
  side: 'sell',
  type: 'market',
  amount: 0.1,
})

// 鍙噺浠撳崟
const reduceOnlyOrder = await client.createOrder({
  symbol: 'BTC/USDT:PERP',
  marketType: 'perp',
  side: 'sell',
  type: 'limit',
  amount: 0.01,
  price: 60000,
  reduceOnly: true,
})
```

### 3. 鏌ヨ璁㈠崟

```typescript
// 鏌ヨ鍗曚釜璁㈠崟
const order = await client.fetchOrder('12345', 'BTC/USDT:PERP')

// 鏌ヨ鎵€鏈夋湭瀹屾垚璁㈠崟
const openOrders = await client.fetchOpenOrders()

// 鏌ヨ鎸囧畾甯佺鐨勬湭瀹屾垚璁㈠崟
const btcOpenOrders = await client.fetchOpenOrders('BTC/USDT:PERP')

// 鏌ヨ鍘嗗彶璁㈠崟
const closedOrders = await client.fetchClosedOrders()
```

### 4. 鍙栨秷璁㈠崟

```typescript
const canceledOrder = await client.cancelOrder('12345', 'BTC/USDT:PERP')
```

### 5. 鏌ヨ鎸佷粨

```typescript
const positions = await client.fetchPositions()

positions.forEach(pos => {
  console.log(`${pos.symbol}: ${pos.side} ${pos.size} @ ${pos.entryPrice}`)
  console.log(`  鏈疄鐜扮泩浜? ${pos.unrealizedPnl}`)
  console.log(`  鏉犳潌: ${pos.leverage}x`)
  console.log(`  寮哄钩浠? ${pos.liquidationPrice}`)
})
```

### 6. 鏌ヨ浣欓

```typescript
const balances = await client.fetchBalance()

balances.forEach(balance => {
  console.log(`${balance.asset}:`)
  console.log(`  鎬昏: ${balance.total}`)
  console.log(`  鍙敤: ${balance.free}`)
  console.log(`  鍐荤粨: ${balance.locked}`)
})
```

### 7. 鏌ヨ琛屾儏

```typescript
const ticker = await client.fetchTicker('BTC/USDT:PERP')

console.log('鏈€鏂颁环:', ticker.last)
console.log('涔颁竴浠?', ticker.bid)
console.log('鍗栦竴浠?', ticker.ask)
console.log('24h鏈€楂?', ticker.high)
console.log('24h鏈€浣?', ticker.low)
console.log('24h鎴愪氦閲?', ticker.volume)
```

## Symbol 鏄犲皠瑙勫垯

### 鍐呴儴鏍煎紡 鈫?Hyperliquid 鏍煎紡

- `BTC/USDT:PERP` 鈫?`BTC`
- `ETH/USDT:PERP` 鈫?`ETH`
- `SOL/USDT:PERP` 鈫?`SOL`

Hyperliquid 鎵€鏈夊悎绾﹂兘鏄?USDT 姘哥画鍚堢害锛屽洜姝ゅ彧闇€瑕?base currency 鍚嶇О銆?

### Hyperliquid 鏍煎紡 鈫?鍐呴儴鏍煎紡

- `BTC` 鈫?`BTC/USDT:PERP`
- `ETH` 鈫?`ETH/USDT:PERP`
- `SOL` 鈫?`SOL/USDT:PERP`

## 娉ㄦ剰浜嬮」

### 1. 浠呮敮鎸佹案缁悎绾?

Hyperliquid 鍙彁渚涙案缁悎绾︿氦鏄擄紝涓嶆敮鎸佺幇璐с€俙marketType` 蹇呴』鏄?`'perp'`銆?

### 2. Agent 鎺堟潈

鍦ㄤ娇鐢?Agent 绉侀挜涔嬪墠锛屽繀椤诲厛鍦ㄤ富閽卞寘涓巿鏉冭 Agent 鍦板潃銆傛巿鏉冩柟寮忥細

1. 璁块棶 Hyperliquid 瀹樼綉
2. 杩炴帴涓婚挶鍖?
3. 鍦ㄨ缃腑娣诲姞 Agent 鍦板潃骞舵巿鏉?

### 3. 甯備环鍗曞疄鐜?

Hyperliquid 娌℃湁鐪熸鐨勫競浠峰崟锛屽競浠峰崟閫氳繃闄愪环鍗?+ IOC锛堢珛鍗虫垚浜ゆ垨鍙栨秷锛夋椂鏁堝疄鐜帮細
- 涔板崟锛氳缃檺浠蜂负甯備环 * 1.1
- 鍗栧崟锛氳缃檺浠蜂负甯備环 * 0.9

杩欐牱鍙互纭繚璁㈠崟绔嬪嵆鎴愪氦銆?

### 4. 閿欒澶勭悊

鎵€鏈夋柟娉曢兘浼氭姏鍑?`ExchangeError` 鎴栧叾瀛愮被锛?

```typescript
try {
  await client.createOrder(orderInput)
} catch (error) {
  if (error instanceof ExchangeError) {
    console.error('浜ゆ槗鎵€閿欒:', error.message)
    console.error('閿欒鐮?', error.code)
    console.error('璇︽儏:', error.details)
  } else {
    console.error('鏈煡閿欒:', error)
  }
}
```

### 5. 璁㈠崟鐘舵€佹槧灏?

| Hyperliquid 鐘舵€?| 缁熶竴鐘舵€?| 璇存槑 |
|-----------------|----------|------|
| resting锛堟湁鎸傚崟锛?| open | 璁㈠崟閮ㄥ垎鎴栧叏閮ㄦ湭鎴愪氦 |
| filled锛堟湁鎴愪氦锛?+ no resting | closed | 璁㈠崟瀹屽叏鎴愪氦 |
| filled锛堟湁鎴愪氦锛?+ resting | partially_filled | 璁㈠崟閮ㄥ垎鎴愪氦 |
| error | rejected | 璁㈠崟琚嫆缁?|

### 7. 娴嬭瘯缃?

HyperliquidClient 鏍规嵁浼犲叆閰嶇疆鐨?`isTestnet` 鏍囧織鍐冲畾杩炴帴缃戠粶锛?

- 褰?`isTestnet: true` 鏃讹紝浣跨敤娴嬭瘯缃戯細`https://api.hyperliquid-testnet.xyz`
- 褰?`isTestnet: false` 鎴栨湭璁剧疆鏃讹紝浣跨敤涓荤綉锛歚https://api.hyperliquid.xyz`

璋冪敤鏂瑰簲鏄惧紡鍐冲畾 `isTestnet`锛屼笉瑕佸啀渚濊禆娴忚鍣ㄥ墠绔幆澧冨彉閲忔帹鏂綉缁溿€?

## 涓庡叾浠栦氦鏄撴墍鐨勫尯鍒?

| 鍔熻兘 | Binance | OKX | Hyperliquid |
|------|---------|-----|-------------|
| 鐜拌揣浜ゆ槗 | 鉁?| 鉁?| 鉂?|
| 姘哥画鍚堢害 | 鉁?| 鉁?| 鉁?|
| 甯備环鍗?| 鉁?| 鉁?| 鉁咃紙IOC 闄愪环鍗曪級 |
| 姝㈡崯鍗?| 鉁?| 鉁?| 鉂岋紙寰呭疄鐜帮級 |
| API Key | 鉁?| 鉁?| 鉂岋紙浣跨敤绉侀挜锛?|
| 閽卞寘鎺堟潈 | 鉂?| 鉂?| 鉁咃紙閾句笂鎺堟潈锛?|

## 鍙傝€冭祫婧?

- [Hyperliquid 瀹樼綉](https://hyperliquid.xyz)
- [Hyperliquid 鏂囨。](https://hyperliquid.gitbook.io)
- [@nktkas/hyperliquid SDK](https://www.npmjs.com/package/@nktkas/hyperliquid)
- [Hyperliquid API 鏂囨。](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)

## 瀹炵幇娓呭崟

### 褰撳墠鐘舵€侊細鉁?宸插畬鎴愬疄鐜?

**鏂囦欢缁撴瀯**锛?
- 鉁?`hyperliquid-client.ts` - 瀹屾暣瀹炵幇锛屾墍鏈夋柟娉曞彲鐢?
- 鉁?`account-store.ts` - 閰嶇疆绫诲瀷宸插畾涔?
- 鉁?`create-exchange-account.dto.ts` - DTO 瀛楁宸叉坊鍔狅紙鍚牸寮忔牎楠岋級
- 鉁?OpenAPI/SDK - 宸茬敓鎴愶紝濂戠害涓庡疄鐜颁竴鑷?

**宸插疄鐜板姛鑳?*锛?

| 鍔熻兘 | 鏂规硶 | 鐘舵€?| 璇存槑 |
|------|------|------|------|
| 鍋ュ悍妫€鏌?| `ping()` | 鉁?宸插疄鐜?| 璋冪敤 `allMids()` 楠岃瘉杩炴帴 |
| 鍒濆鍖?| `init()` | 鉁?宸插疄鐜?| 璋冪敤 `ping()` 娴嬭瘯杩炴帴 |
| 鍒涘缓璁㈠崟 | `createOrder()` | 鉁?宸插疄鐜?| 鏀寔闄愪环鍗曞拰甯備环鍗曪紙IOC锛?|
| 鍙栨秷璁㈠崟 | `cancelOrder()` | 鉁?宸插疄鐜?| 鏀寔 oid 鍜?clientOrderId |
| 鏌ヨ璁㈠崟 | `fetchOrder()` | 鉁?宸插疄鐜?| 鏀寔 oid 鍜?clientOrderId锛屾纭鐞嗛儴鍒嗘垚浜?|
| 鏌ヨ鏈畬鎴愯鍗?| `fetchOpenOrders()` | 鉁?宸插疄鐜?| 鏀寔鎸?symbol 杩囨护 |
| 鏌ヨ鍘嗗彶璁㈠崟 | `fetchClosedOrders()` | 鉁?宸插疄鐜?| 鑱氬悎澶氱瑪鎴愪氦锛岃绠楀姞鏉冨钩鍧囦环 |
| 鏌ヨ鎸佷粨 | `fetchPositions()` | 鉁?宸插疄鐜?| 杩斿洖鎵€鏈夐潪闆舵寔浠?|
| 鏌ヨ浣欓 | `fetchBalance()` | 鉁?宸插疄鐜?| 杩斿洖 USDC 浣欓淇℃伅 |
| 鏌ヨ琛屾儏 | `fetchTicker()` | 鉁?宸插疄鐜?| 鍚紦瀛樻満鍒讹紙5绉扵TL锛?|

**鎶€鏈鐐?*锛?

- **璁よ瘉鏈哄埗**锛氫娇鐢?ethers.js 鐨?`Wallet` 瀵逛氦鏄撶鍚?
- **Agent/Vault 鏋舵瀯**锛歛gent 閽卞寘绛惧悕锛屼富閽卞寘璧勯噾
- **Symbol 鏄犲皠**锛歚BTC/USDT:PERP` 鈫?`BTC`
- **Asset ID 鏄犲皠**锛氱淮鎶?coin 鈫?assetId 鐨勭紦瀛橈紙1灏忔椂TTL锛?
- **ClientOrderId**锛?x + 32 涓崄鍏繘鍒跺瓧绗︼紙16 瀛楄妭闅忔満鏁帮級
- **甯備环鍗曟ā鎷?*锛氫娇鐢?IOC 闄愪环鍗?+ 10% 婊戠偣
- **閫熺巼闄愬埗**锛氭渶灏忚姹傞棿闅?100ms锛屾渶澶у苟鍙?10
- **閲嶈瘯鏈哄埗**锛氭渶澶?3 娆￠噸璇曪紝鎸囨暟閫€閬?

**娉ㄦ剰浜嬮」**锛?

1. 鈿狅笍 浠呮敮鎸佹案缁悎绾︼紙`marketType: 'perp'`锛?
2. 鈿狅笍 鍒涘缓璐︽埛鏃朵細楠岃瘉鍑嵁锛堣皟鐢?`fetchBalance`锛?
3. 鈿狅笍 闇€瑕佸厛鍦?Hyperliquid 瀹樼綉鎺堟潈 Agent 鍦板潃

## 鏇存柊鏃ュ織

### v1.0.0 (2024-12-02)

- 鉁?瀹屾暣瀹炵幇鎵€鏈?`IExchangeClient` 鏂规硶
- 鉁?娣诲姞閫熺巼闄愬埗鍜岄噸璇曟満鍒?
- 鉁?姝ｇ‘澶勭悊 Agent/Vault 鏋舵瀯
- 鉁?鏀寔 oid 鍜?clientOrderId 鏌ヨ/鍙栨秷
- 鉁?姝ｇ‘澶勭悊閮ㄥ垎鎴愪氦璁㈠崟鐘舵€?
- 鉁?鍒涘缓璐︽埛鏃堕獙璇佸嚟鎹?
- 鉁?鏇存柊鏂囨。涓?宸插畬鎴愬疄鐜?

### 鑽夌 v0.1.0 (2024-12-01)

- 鉁?鍒涘缓楠ㄦ灦瀹炵幇
- 鉁?瀹氫箟閰嶇疆绫诲瀷
- 鉁?娣诲姞 DTO 瀛楁
- 鉁?鐢熸垚 OpenAPI/SDK

# CEX API Key 楠岃瘉 E2E 娴嬭瘯

## 姒傝堪

杩欎釜E2E娴嬭瘯濂椾欢鍏ㄩ潰娴嬭瘯浜嗕腑蹇冨寲浜ゆ槗鎵€锛圔inance/OKX锛堿PI Key楠岃瘉鍔熻兘锛屽寘鎷細

- 鉁?鎴愬姛楠岃瘉鍦烘櫙
- 鉂?鍚勭閿欒鍦烘櫙锛堟棤鏁圞ey銆両P闄愬埗銆佹潈闄愪笉瓒崇瓑锛?
- 馃敀 鏉冮檺鎺у埗鍜屽畨鍏ㄦ€?
- 馃摑 琛ㄥ崟楠岃瘉
- 馃殌 杈圭紭鎯呭喌鍜屽苟鍙戞祴璇?

## 娴嬭瘯瑕嗙洊

### Binance 娴嬭瘯鍦烘櫙

1. **鎴愬姛鍦烘櫙**
   - 鍒涘缓鐜拌揣璐︽埛锛圫pot锛?
   - 鍒涘缓鍚堢害璐︽埛锛團utures锛?
   - 楠岃瘉鍝嶅簲鏁版嵁缁撴瀯

2. **閿欒鍦烘櫙**
   - 鉂?鏃犳晥鐨?API Key
   - 鉂?閿欒鐨?Secret锛堢鍚嶉獙璇佸け璐ワ級
   - 鉂?IP鐧藉悕鍗曢檺鍒?
   - 鉂?API Key 琚鐢?
   - 鉂?鏉冮檺涓嶈冻锛堟湭寮€鍚氦鏄撴潈闄愶級

### OKX 娴嬭瘯鍦烘櫙

1. **鎴愬姛鍦烘櫙**
   - 鍒涘缓鐜拌揣/鍚堢害璐︽埛
   - 楠岃瘉鍝嶅簲鍖呭惈 `lastValidatedAt` 鏃堕棿鎴?

2. **閿欒鍦烘櫙**
   - 鉂?鏃犳晥鐨?API Key
   - 鉂?杩囨湡鐨?API Key锛堝惈14澶╂彁绀猴級
   - 鉂?閿欒鐨?Passphrase
   - 鉂?IP鐧藉悕鍗曢檺鍒?
   - 鉂?鏉冮檺涓嶈冻
   - 鉂?API Key 琚鐢ㄦ垨鍒犻櫎
   - 鉂?缂哄皯 Passphrase锛圖TO 楠岃瘉锛?

### 鍏朵粬娴嬭瘯

3. **鍒楄〃鍜屽垹闄?*
   - 鑾峰彇鐢ㄦ埛鐨勪氦鏄撴墍璐︽埛鍒楄〃
   - 鍒犻櫎璐︽埛
   - 楠岃瘉涓嶆硠闇叉晱鎰熶俊鎭?
   - 楠岃瘉鐢ㄦ埛闅旂锛堜笉鑳藉垹闄ゅ叾浠栫敤鎴风殑璐︽埛锛?

4. **琛ㄥ崟楠岃瘉**
   - 蹇呭～瀛楁楠岃瘉
   - 鏋氫妇绫诲瀷楠岃瘉
   - 瀛楁闀垮害闄愬埗

5. **杈圭紭鎯呭喌**
   - 骞跺彂璇锋眰澶勭悊
   - 鏈€澶ч暱搴﹁处鎴峰悕绉?
   - 瓒呴暱鍚嶇О鎷掔粷

## Mock 绛栫暐

娴嬭瘯浣跨敤 `globalThis.fetch` mock 鏉ユ嫤鎴氦鏄撴墍 API 璇锋眰锛岄伩鍏嶈闂湡瀹炰氦鏄撴墍锛?

### Binance Mock

```typescript
// 姝ｅ父鍝嶅簲
apiKey: 'valid_key' + valid signature 鈫?200 OK with balance

// 閿欒鍝嶅簲
apiKey: 'invalid_key' 鈫?400 with code -2015
apiKey: 'wrong_secret' 鈫?400 with code -1022
apiKey: 'ip_restricted' 鈫?403 with code -2010
apiKey: 'disabled_key' 鈫?403 with code -2011
apiKey: 'no_permission' 鈫?403 with code -2015 + permission msg
```

### OKX Mock

```typescript
// 姝ｅ父鍝嶅簲
apiKey: 'valid_key' + passphrase: 'valid_passphrase' 鈫?200 OK

// 閿欒鍝嶅簲
apiKey: 'invalid_key' 鈫?401 with code '50113'
apiKey: 'expired_key' 鈫?401 with code '50114'
passphrase: 'wrong_passphrase' 鈫?401 with code '50111'
apiKey: 'ip_restricted' 鈫?403 with code '50112'
apiKey: 'no_permission' 鈫?403 with code '51001'
apiKey: 'disabled_key' 鈫?403 with code '50115'
```

## 杩愯娴嬭瘯

### 鍓嶆彁鏉′欢

```bash
# 1. 纭繚娴嬭瘯鏁版嵁搴撻厤缃纭?
cp .env.example .env.e2e
# 缂栬緫 .env.e2e锛岃缃?DATABASE_URL 鎸囧悜娴嬭瘯鏁版嵁搴?

# 2. 鍚屾褰撳墠鏁版嵁搴?schema
dx db deploy --e2e
```

### 杩愯鎵€鏈?E2E 娴嬭瘯

```bash
dx test e2e quantify apps/quantify/e2e/exchange-accounts
```

### 杩愯 CEX 楠岃瘉娴嬭瘯

```bash
# 浠呰繍琛岃娴嬭瘯濂椾欢
dx test e2e quantify apps/quantify/e2e/exchange-accounts

# 鎴栨寚瀹氬畬鏁磋矾寰?
dx test e2e quantify apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts
```

### 杩愯鐗瑰畾娴嬭瘯

```bash
# 杩愯 Binance 鐩稿叧娴嬭瘯
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "Binance"

# 杩愯 OKX 鐩稿叧娴嬭瘯
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "OKX"

# 杩愯閿欒鍦烘櫙娴嬭瘯
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "should reject"
```

### 璋冭瘯妯″紡

```bash
# 鍚敤璇︾粏鏃ュ織
E2E_VERBOSE_LOG=true dx test e2e quantify apps/quantify/e2e/exchange-accounts

# 浣跨敤 Node 璋冭瘯鍣紙闇€瑕佺洿鎺ヤ娇鐢?npx jest锛?
node --inspect-brk node_modules/.bin/jest --config apps/quantify/e2e/jest-e2e.json exchange-accounts.e2e-spec.ts
```

## 娴嬭瘯鏁版嵁娓呯悊

娴嬭瘯浼氳嚜鍔ㄦ竻鐞嗗垱寤虹殑鏁版嵁锛?

1. **娴嬭瘯鐢ㄦ埛**: 鍦?`afterAll` 閽╁瓙涓垹闄?
2. **浜ゆ槗鎵€璐︽埛**: 绾ц仈鍒犻櫎锛堥€氳繃澶栭敭锛?
3. **娴嬭瘯鏁版嵁搴?*: 鐢?`setup-e2e.ts` 鍦ㄦ墍鏈夋祴璇曠粨鏉熷悗鍒犻櫎

## CI/CD 闆嗘垚

### GitHub Actions 绀轰緥

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test_secret
          APP_ENV: e2e
        run: npm run test:e2e -- exchange-accounts
```

## 娴嬭瘯瑕嗙洊鐜?

杩愯娴嬭瘯骞剁敓鎴愯鐩栫巼鎶ュ憡锛?

```bash
# 鐢熸垚瑕嗙洊鐜囨姤鍛?
npm run test:e2e -- --coverage exchange-accounts

# 鏌ョ湅瑕嗙洊鐜?
open coverage/lcov-report/index.html
```

### 褰撳墠瑕嗙洊鐜囩洰鏍?

- **TradingService.validateCexCredentials**: 100%
- **BinanceClient.mapError**: 95%+
- **OkxClient.mapError**: 95%+
- **ExchangeAccountsService.create**: 100%

## 鏁呴殰鎺掗櫎

### 娴嬭瘯瓒呮椂

```bash
# 澧炲姞瓒呮椂鏃堕棿
jest --testTimeout=60000

# 鎴栧湪 jest-e2e.json 涓厤缃?
{
  "testTimeout": 60000
}
```

### 鏁版嵁搴撹繛鎺ラ棶棰?

```bash
# 妫€鏌ユ暟鎹簱URL
echo $DATABASE_URL

# 楠岃瘉鏁版嵁搴撹繛鎺?
psql $DATABASE_URL -c "SELECT 1"

# 閲嶇疆娴嬭瘯鏁版嵁搴?
npm run prisma:reset:e2e
```

### Mock 涓嶇敓鏁?

妫€鏌?`beforeAll` 閽╁瓙鏄惁姝ｇ‘鎵ц锛?

```typescript
console.log('Fetch is mocked:', typeof globalThis.fetch === 'function')
```

## 鎵╁睍娴嬭瘯

### 娣诲姞鏂扮殑閿欒鍦烘櫙

1. 鍦?mock fetch 涓坊鍔犳柊鐨勯敊璇爜锛?

```typescript
if (apiKey === 'new_error_case') {
  return new Response(JSON.stringify({
    code: 'NEW_ERROR_CODE',
    msg: 'New error message'
  }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })
}
```

2. 娣诲姞娴嬭瘯鐢ㄤ緥锛?

```typescript
it('should handle new error case', async () => {
  const response = await createApiClient(app, userToken)
    .post('exchange-accounts')
    .send({
      exchangeId: 'binance',
      apiKey: 'new_error_case',
      apiSecret: 'secret',
      marketType: 'spot',
    })
    .expect(400)

  expect(response.body.message).toContain('expected error message')
})
```

### 娣诲姞鎬ц兘娴嬭瘯

```typescript
describe('Performance', () => {
  it('should validate credentials within 5 seconds', async () => {
    const start = Date.now()

    await createApiClient(app, userToken)
      .post('exchange-accounts')
      .send({
        exchangeId: 'binance',
        apiKey: 'valid_key',
        apiSecret: 'valid_secret',
        marketType: 'spot',
      })
      .expect(201)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000)
  })
})
```

## 鐩稿叧鏂囨。

- [Jest E2E 閰嶇疆](../../jest-e2e.json)
- [娴嬭瘯 Fixtures](../fixtures/fixtures.ts)

## 缁存姢娓呭崟

- [ ] 瀹氭湡鏇存柊浜ゆ槗鎵€閿欒鐮佹槧灏?
- [ ] 鐩戞帶鐪熷疄鐜涓殑閿欒鍒嗗竷
- [ ] 鏍规嵁鐢ㄦ埛鍙嶉娣诲姞鏂扮殑娴嬭瘯鍦烘櫙
- [ ] 淇濇寔 mock 鍝嶅簲涓庣湡瀹?API 涓€鑷?
- [ ] 鏇存柊鏂囨。鍙嶆槧鏈€鏂扮殑娴嬭瘯瑕嗙洊

## 璐＄尞鎸囧崡

娣诲姞鏂版祴璇曟椂锛岃纭繚锛?

1. 鉁?娴嬭瘯鍚嶇О娓呮櫚鎻忚堪娴嬭瘯鍐呭
2. 鉁?浣跨敤姝ｇ‘鐨?HTTP 鐘舵€佺爜鏂█
3. 鉁?楠岃瘉閿欒娑堟伅鐨勫叧閿唴瀹?
4. 鉁?娓呯悊娴嬭瘯鏁版嵁
5. 鉁?鏇存柊 README 鏂囨。

# 绛栫暐淇″彿璋冭瘯閰嶇疆

## 姒傝堪

鏈ā鍧楁彁渚涗簡璇︾粏鐨勮剼鏈皟璇曟棩蹇楀姛鑳斤紝甯姪寮€鍙戣€呮帓鏌ョ瓥鐣ヨ剼鏈墽琛岄棶棰樸€?

## 鐜鍙橀噺閰嶇疆

### DEBUG_STRATEGY_SCRIPTS

鎺у埗鏄惁鍚敤璇︾粏鐨勮剼鏈皟璇曟棩蹇椼€?

- **绫诲瀷**: Boolean
- **榛樿鍊?*: `false`
- **鎺ㄨ崘閰嶇疆**:
  - 寮€鍙戠幆澧? `true`
  - 鐢熶骇鐜: `false`锛堥櫎闈為渶瑕佹帓鏌ラ棶棰橈級

**绀轰緥**:
```bash
# .env.development
DEBUG_STRATEGY_SCRIPTS=true

# .env.production
DEBUG_STRATEGY_SCRIPTS=false
```

### DEBUG_SCRIPT_MAX_LENGTH

鑴氭湰鍐呭杈撳嚭鐨勬渶澶ч暱搴︼紙瀛楃鏁帮級銆?

- **绫诲瀷**: Number
- **榛樿鍊?*: `1000`
- **璇存槑**: 瓒呰繃姝ら暱搴︾殑鑴氭湰浼氳鎴柇锛屾樉绀?"... (truncated)"

**绀轰緥**:
```bash
DEBUG_SCRIPT_MAX_LENGTH=2000
```

### DEBUG_VALUE_MAX_LENGTH

鑴氭湰杩斿洖鍊艰緭鍑虹殑鏈€澶ч暱搴︼紙瀛楃鏁帮級銆?

- **绫诲瀷**: Number
- **榛樿鍊?*: `200`
- **璇存槑**: 鐢ㄤ簬闄愬埗鏃ュ織涓繑鍥炲€肩殑杈撳嚭闀垮害

**绀轰緥**:
```bash
DEBUG_VALUE_MAX_LENGTH=500
```

## 浣跨敤璇存槑

### 1. 寮€鍙戠幆澧冨惎鐢ㄨ皟璇?

鍦?`.env.development` 鏂囦欢涓坊鍔狅細

```bash
STRATEGY_SIGNALS_ENABLED=true
DEBUG_STRATEGY_SCRIPTS=true
```

### 2. 鏌ョ湅璋冭瘯鏃ュ織

鍚敤鍚庯紝鍦ㄧ瓥鐣ヨ剼鏈墽琛屾椂浼氳緭鍑鸿缁嗘棩蹇楋細

```
[Script Debug] Strategy cmip1uo8a03t5x1h8a1i1eu0m script:
// 鑾峰彇 BTC 1灏忔椂鐨勬暟鎹?
const bars = data['primary']['1h'].bars;
...
[End Script]

[Script Debug] Strategy cmip1uo8a03t5x1h8a1i1eu0m result: success=true, valueType=object, value={"symbol":"BTCUSDT",...}
```

### 3. 鐢熶骇鐜瀹夊叏

鐢熶骇鐜榛樿绂佺敤璋冭瘯鏃ュ織锛屽嵆浣胯缃簡 `DEBUG_STRATEGY_SCRIPTS=true`锛屼篃闇€瑕佺‘淇濓細

1. 鐜鍙橀噺 `NODE_ENV=production`
2. 鏄庣‘鐭ラ亾寮€鍚皟璇曠殑褰卞搷锛堟€ц兘銆佹棩蹇楅噺銆佹晱鎰熶俊鎭級

## 宸ュ叿绫讳娇鐢?

### ScriptDebugUtil

鎻愪緵浜嗕竴绯诲垪闈欐€佹柟娉曠敤浜庢牸寮忓寲鑴氭湰鍜岃繑鍥炲€硷細

```typescript
import { ScriptDebugUtil } from './utils/script-debug.util'

// 鏍煎紡鍖栬繑鍥炲€肩敤浜庢棩蹇?
const formatted = ScriptDebugUtil.formatValueForLog(value, 200)

// 鏍煎紡鍖栬剼鏈敤浜庢棩蹇?
const script = ScriptDebugUtil.formatScriptForLog(scriptContent, 1000)

// 鍒涘缓鑴氭湰鎽樿锛堢敓浜х幆澧冿級
const summary = ScriptDebugUtil.createScriptSummary(scriptContent)
// 杈撳嚭: { lines: 20, length: 450, hasReturn: false, hasAsync: false }
```

## 璋冭瘯娴佺▼

### 闂鎺掓煡姝ラ

1. **鍚敤璋冭瘯鏃ュ織**
   ```bash
   DEBUG_STRATEGY_SCRIPTS=true
   ```

2. **閲嶅惎鏈嶅姟**
   ```bash
   dx start backend --dev
   ```

3. **瑙﹀彂淇″彿鐢熸垚**
   - 鑷姩锛氱瓑寰?cron 浠诲姟瑙﹀彂
   - 鎵嬪姩锛氬湪绠＄悊鍚庡彴鐐瑰嚮"瑙﹀彂淇″彿"鎸夐挳

4. **鏌ョ湅鏃ュ織杈撳嚭**
   - 妫€鏌ヨ剼鏈唴瀹规槸鍚︽纭?
   - 妫€鏌ヨ繑鍥炲€肩被鍨嬪拰鍐呭
   - 鏌ョ湅鏄惁鏈夐敊璇俊鎭?

5. **淇闂鍚庡叧闂皟璇?*
   ```bash
   DEBUG_STRATEGY_SCRIPTS=false
   ```

## 娉ㄦ剰浜嬮」

鈿狅笍 **瀹夊叏鎻愰啋**:
- 璋冭瘯鏃ュ織鍙兘鍖呭惈鏁忔劅鐨勭瓥鐣ヨ剼鏈唴瀹?
- 鐢熶骇鐜搴斾繚鎸佽皟璇曟棩蹇楀叧闂?
- 濡傞渶鍦ㄧ敓浜х幆澧冭皟璇曪紝浣跨敤鍚庣珛鍗冲叧闂?

鈿狅笍 **鎬ц兘褰卞搷**:
- 鍚敤璋冭瘯浼氬鍔犳棩蹇楄緭鍑洪噺
- 澶ч噺绛栫暐瀹炰緥鍙兘瀵艰嚧鏃ュ織鏂囦欢蹇€熷闀?
- 寤鸿浠呭湪蹇呰鏃跺惎鐢?

## 鏈€浣冲疄璺?

1. **寮€鍙戠幆澧?*: 濮嬬粓鍚敤璋冭瘯锛屼究浜庡揩閫熷畾浣嶉棶棰?
2. **Staging鐜**: 鏍规嵁闇€瑕佷复鏃跺惎鐢?
3. **鐢熶骇鐜**: 榛樿绂佺敤锛屼粎鍦ㄧ揣鎬ユ帓鏌ユ椂鐭殏鍚敤
4. **鏃ュ織瀹℃煡**: 瀹氭湡妫€鏌ユ棩蹇楋紝纭繚鏃犳晱鎰熶俊鎭硠闇?
5. **閰嶇疆绠＄悊**: 浣跨敤鐜鍙橀噺锛岄伩鍏嶇‖缂栫爜

# Quantify 真实交易所数据与策略信号最小验收 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一套可一键执行的最小真实链路验收，验证 Binance/OKX/Hyperliquid 行情可用并能通过现有 strategy-instance 手动触发生成信号。

**Architecture:** 复用现有 `preflight/runtime/gate1` 脚本，增量新增“多交易所校验”“策略信号触发校验”“总编排脚本”三层。每一层只负责一个 gate，统一把结果写入 `tmp/quantify-min-acceptance`，最后由编排脚本汇总并返回退出码。所有 gate 均采用 `t0` 时间边界与结构化错误码，确保幂等与可诊断。

**Tech Stack:** Bash, curl, psql, python3(JSON 解析), quantify NestJS ops API, dx 命令体系

---

### Task 1: 固化验收输入与公共错误输出约定

**Files:**
- Create: `scripts/acceptance/quantify-acceptance-common.sh`
- Test: `scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`

- [ ] **Step 1: 写契约测试（先失败）**

```js
// scripts/__tests__/quantify-min-acceptance-contract.spec.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('acceptance common script defines required env keys', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'scripts/acceptance/quantify-acceptance-common.sh'),
    'utf8',
  )

  assert.match(source, /ACCEPT_SYMBOL_BINANCE/)
  assert.match(source, /ACCEPT_SYMBOL_OKX/)
  assert.match(source, /ACCEPT_SYMBOL_HYPERLIQUID/)
  assert.match(source, /ACCEPT_STRATEGY_INSTANCE_ID/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: FAIL（文件不存在）

- [ ] **Step 3: 最小实现公共脚本**

```bash
# scripts/acceptance/quantify-acceptance-common.sh
# - 严格模式
# - require_env "VAR_NAME"
# - json_fail <gate> <code> <message>
# - json_pass <gate>
# - write_json <path> <json>
```

- [ ] **Step 4: 再跑测试确认通过**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/acceptance/quantify-acceptance-common.sh scripts/__tests__/quantify-min-acceptance-contract.spec.cjs
git commit -m "test: add acceptance common contract for min real-exchange flow\n\nRefs: #461"
```

### Task 2: 新增三交易所数据 Gate（API + DB + t0 边界）

**Files:**
- Create: `scripts/acceptance/quantify-multi-exchange-gate-check.sh`
- Modify: `scripts/acceptance/quantify-market-data-gate1-check.sh`
- Test: `scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`

- [ ] **Step 1: 写契约测试（先失败）**

```js
test('multi-exchange gate script checks three exchanges explicitly', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'scripts/acceptance/quantify-multi-exchange-gate-check.sh'),
    'utf8',
  )

  assert.match(source, /binance/)
  assert.match(source, /okx/)
  assert.match(source, /hyperliquid/)
  assert.match(source, /api\/v1\/market\/quote/)
  assert.match(source, /api\/v1\/market\/bars/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: FAIL（脚本尚未创建）

- [ ] **Step 3: 实现最小脚本**

```bash
# quantify-multi-exchange-gate-check.sh
# 1) 读取 t0 + 三家 symbol
# 2) for exchange in binance okx hyperliquid:
#    - curl quote/bars
#    - psql 校验 t0 后 quote/bar 最新记录
#    - 累积 per-exchange pass/fail
# 3) 输出 gate2-summary.json（含每家错误码）
```

- [ ] **Step 4: 最小复用现有 gate1 的 JSON 工具函数**

```bash
# 在 quantify-market-data-gate1-check.sh 提取可复用 json_eval/assert_* 函数
# 避免在新脚本复制大段逻辑
```

- [ ] **Step 5: 跑契约测试**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/acceptance/quantify-multi-exchange-gate-check.sh scripts/acceptance/quantify-market-data-gate1-check.sh scripts/__tests__/quantify-min-acceptance-contract.spec.cjs
git commit -m "feat: add multi-exchange market-data acceptance gate\n\nRefs: #461"
```

### Task 3: 新增 strategy-instance 手动触发信号 Gate

**Files:**
- Create: `scripts/acceptance/quantify-strategy-signal-gate-check.sh`
- Test: `scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`

- [ ] **Step 1: 写契约测试（先失败）**

```js
test('signal gate script uses ops generate-signal endpoint', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'scripts/acceptance/quantify-strategy-signal-gate-check.sh'),
    'utf8',
  )

  assert.match(source, /ops\/strategy-instances\/.+\/generate-signal/)
  assert.match(source, /trading_signal/i)
  assert.match(source, /ACCEPT_STRATEGY_INSTANCE_ID/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: FAIL

- [ ] **Step 3: 实现最小脚本**

```bash
# quantify-strategy-signal-gate-check.sh
# 1) 读取 ACCEPT_STRATEGY_INSTANCE_ID 与 t0
# 2) POST /api/v1/ops/strategy-instances/{id}/generate-signal
# 3) 轮询 DB：确认 t0 后新增 trading_signal 记录且 strategy_instance 相关字段匹配
# 4) 写 gate3-summary.json
```

- [ ] **Step 4: 跑契约测试**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/acceptance/quantify-strategy-signal-gate-check.sh scripts/__tests__/quantify-min-acceptance-contract.spec.cjs
git commit -m "feat: add strategy-instance manual signal acceptance gate\n\nRefs: #461"
```

### Task 4: 新增总编排脚本与统一汇总

**Files:**
- Create: `scripts/acceptance/quantify-min-acceptance.sh`
- Modify: `scripts/acceptance/quantify-market-data-runtime.sh`
- Test: `scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`

- [ ] **Step 1: 写契约测试（先失败）**

```js
test('orchestrator runs all gates in order and writes acceptance-summary.json', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'scripts/acceptance/quantify-min-acceptance.sh'),
    'utf8',
  )

  assert.match(source, /quantify-market-data-preflight\.sh/)
  assert.match(source, /quantify-market-data-runtime\.sh start/)
  assert.match(source, /quantify-multi-exchange-gate-check\.sh/)
  assert.match(source, /quantify-strategy-signal-gate-check\.sh/)
  assert.match(source, /acceptance-summary\.json/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: FAIL

- [ ] **Step 3: 实现编排脚本（最小闭环）**

```bash
# quantify-min-acceptance.sh
# - 顺序执行 Gate0~Gate3
# - 每个 Gate 都写单独 summary
# - 聚合 acceptance-summary.json
# - EXIT CODE: all pass => 0; otherwise 1
# - finally 调用 runtime stop（可通过 KEEP_RUNTIME=1 跳过）
```

- [ ] **Step 4: 对 runtime 脚本补最小增强（仅必要）**

```bash
# 支持 STATE_DIR 复用 + 保留现有行为兼容
# 不改变已有 start/stop/status API
```

- [ ] **Step 5: 跑契约测试**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/acceptance/quantify-min-acceptance.sh scripts/acceptance/quantify-market-data-runtime.sh scripts/__tests__/quantify-min-acceptance-contract.spec.cjs
git commit -m "feat: add minimal real-exchange acceptance orchestrator\n\nRefs: #461"
```

### Task 5: 补充 API 触发回归测试（Controller 层）

**Files:**
- Modify: `apps/quantify/src/modules/strategy-instances/strategy-instances.controller.spec.ts`
- Test: `apps/quantify/src/modules/strategy-instances/strategy-instances.controller.spec.ts`

- [ ] **Step 1: 先写失败测试**

```ts
it('POST /ops/strategy-instances/:id/generate-signal validates then triggers async generation', async () => {
  signalGenerator.validateManualTriggerTarget.mockResolvedValue(undefined)

  await request(app.getHttpServer())
    .post('/ops/strategy-instances/instance-1/generate-signal')
    .expect(200)

  expect(signalGenerator.validateManualTriggerTarget).toHaveBeenCalledWith('instance-1')
})
```

- [ ] **Step 2: 跑目标单测确认失败**

Run: `dx test unit quantify --runInBand --testPathPattern=strategy-instances.controller.spec.ts`
Expected: FAIL（当前未覆盖对应断言）

- [ ] **Step 3: 做最小修正让测试通过**

```ts
// 按现有 controller 行为补齐 mock + 断言，不改业务逻辑
```

- [ ] **Step 4: 跑目标单测确认通过**

Run: `dx test unit quantify --runInBand --testPathPattern=strategy-instances.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/strategy-instances/strategy-instances.controller.spec.ts
git commit -m "test: cover ops generate-signal endpoint contract\n\nRefs: #461"
```

### Task 6: 文档与最终验收

**Files:**
- Modify: `apps/quantify/src/modules/market-data/QUICKSTART.md`
- Modify: `apps/quantify/src/modules/market-data/README.md`
- Modify: `apps/quantify/src/modules/market-data/SUMMARY.md`

- [ ] **Step 1: 文档先写“如何跑最小验收”段落**

```md
# 最小真实链路验收
export ACCEPT_SYMBOL_BINANCE=BTCUSDT
export ACCEPT_SYMBOL_OKX=BTCUSDT
export ACCEPT_SYMBOL_HYPERLIQUID=BTCUSDC
export ACCEPT_STRATEGY_INSTANCE_ID=<existing-id>

bash scripts/acceptance/quantify-min-acceptance.sh
```

- [ ] **Step 2: 跑脚本契约测试**

Run: `node --test scripts/__tests__/quantify-min-acceptance-contract.spec.cjs`
Expected: PASS

- [ ] **Step 3: 跑 Quantify 最小健康 E2E**

Run: `dx test e2e quantify apps/quantify/e2e/health`
Expected: PASS

- [ ] **Step 4: 跑关键策略信号 E2E（回归）**

Run: `dx test e2e quantify apps/quantify/e2e/strategy-signals`
Expected: PASS

- [ ] **Step 5: 本地执行一次验收编排（若本机环境齐备）**

Run: `bash scripts/acceptance/quantify-min-acceptance.sh`
Expected: 输出 `tmp/quantify-min-acceptance/acceptance-summary.json`，状态 PASS 或带结构化失败原因

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/market-data/QUICKSTART.md apps/quantify/src/modules/market-data/README.md apps/quantify/src/modules/market-data/SUMMARY.md
git commit -m "docs: add minimal real-exchange acceptance runbook\n\nRefs: #461"
```

### Task 7: 最终门禁与合并前检查

**Files:**
- Modify: `docs/superpowers/specs/2026-03-18-quantify-real-exchange-signal-min-acceptance-design.md`（如验收实现偏离设计时回填）

- [ ] **Step 1: 运行 lint**

Run: `dx lint`
Expected: PASS

- [ ] **Step 2: 运行 Quantify 单测（最小范围）**

Run: `dx test unit quantify`
Expected: PASS

- [ ] **Step 3: 回填风险与已知限制**

```md
- 若某交易所公网波动导致失败，优先参考 gate2 错误码与日志重试。
- 若实例状态不满足触发条件，优先修复实例状态而非跳过 gate3。
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore: finalize minimal real-exchange acceptance workflow\n\nRefs: #461"
```

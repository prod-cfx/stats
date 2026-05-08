# AI Quant Phase 1 PR-3 — `risk.partial_take_profit` Reduce Action 设计

**Issue:** #984 Phase 1（PR-1 #996 / IR follow-up #998 已合并；本 PR 是 Phase 1 第三块也是最后一块）
**Spec date:** 2026-05-07
**Track:** C
**Branch:** `feat/984-phase1-partial-take-profit`（已切，基于 origin/main 含 #998）

## 0. 已 dry-check 的仓库现状

| 项 | 实际 | 影响设计 |
|---|---|---|
| Atom 注册 | `unsupported('risk.partial_take_profit', 'risk', ...)` (registry line 246) | 升级为 `supported_executable` / `supported_requires_slot` |
| Seed 短语识别 | 已识别 "分批止盈/部分止盈/多档止盈/平一半/scale out" (extractor line 1342)，但只 capture `sourceText` | 扩展为按档位结构解析 tiers |
| IR 编译 | `tryCompileRiskGuard` 对 risk-phase + REDUCE actions 直接返回 null（rule 静默丢弃） | 新增 risk → exit-phase decision program 编译路径 |
| compiled-runtime decision phase | `'entry' / 'exit' / 'rebalance'`，**无 `risk` phase** (run-decision-programs line 7) | partial_take_profit 编译落到 `phase: 'exit'` |
| 单 bar 决策上限 | `runDecisionPrograms` 单 bar 返回首个 applicable decision (line 89) | 单 bar 单档 fire；多档 fire 跨多 bar |
| Sizing mode | `pct_equity / fixed_quote / fixed_base / position_pct` | 复用 `position_pct`（% of 当前剩余仓位）；IR 编译时把用户"% of original"展开为递推 ratio |
| State 写回 | `__compiledDecisionState` 通过 ctx 直接 mutation (line 92, 122-123) | tier_fired 写回沿用同样 ctx mutation |
| State 读取 | `readSemanticRuntimeState(ctx, memoryKey)` (evaluate-expr-pool line 790-803) 已存在 | tier_fired 读取直接用，无需新通道 |
| REDUCE_LONG/SHORT runtime | 已实现（run-decision-programs line 146-167，与 ADJUST_POSITION 决策映射） | 直接复用，无需扩展 |
| Existing parity spec | `atomic-contract-backtest-runtime-parity.spec.ts` | 在此追加 `describe('phase-1 partial take profit parity', ...)` |

## 1. Atom 形态与 Contract

### 1.1 SemanticRiskState.params（discriminated union 预留扩展）

```ts
{
  memoryKey: string                                // 'partial_tp_<uuid>'，state key 命名空间
  tiers: Array<{
    trigger: { kind: 'pnl_pct'; threshold: number } // PR-3 仅支持 'pnl_pct'；schema 留 union 给未来扩展（price/atr_multiple）
    reduceRatio: number                              // 0 < r ≤ 1，% of original entry quantity（用户语义）
  }>
  sideScope?: 'long' | 'short' | 'both'             // 默认 'both'
}
```

### 1.2 SemanticAtomContract

| 字段 | 值 |
|---|---|
| `category` | `'risk'`（保留 Phase 0 categorization；存储仍在 `state.risk[]`） |
| `capabilities` | `['reduce_partial_position']` |
| `requires` | `['position_open']` |
| `effects` | `['reduce_exposure']` |
| `runtimeRequirements.helpers` | `['position_pnl_pct']`（Phase 0 已存在） |
| `stateRequirements` | `[memoryKey]` —— Phase 0 substrate 机制 |
| `orderRequirements` | `['reduce_only']` |
| `openSlots` | tiers 未声明 / ratio 总和 > 1 / threshold 非递增 → 显式 openSlot 要求澄清 |

### 1.3 Registry helper

注册路径与 PR-1 `supportedRequiresSlotRisk` 同型：
- 已 closure 的 atom（tiers 解析成功且校验通过）→ `executableRisk('risk.partial_take_profit', ['memoryKey', 'tiers'])`
- 缺关键参数 → `supportedRequiresSlotRisk(...)` 路径，附 `partial_take_profit_tiers` openSlot

具体二选一在 atom resolve 时根据 params 完整度切换（沿用 Phase 0 closure 状态机制，不引入新 helper）。

## 2. Seed Extractor / State Builder

### 2.1 Token-level 抽取（覆盖 4 类用户表达）

| 用户语料 | tiers 解析 |
|---|---|
| "盈利 5% 平 50%，盈利 10% 平 50%" | `[{th:5, r:0.5},{th:10, r:0.5}]` |
| "+5% 平一半，+10% 平剩下" | `[{th:5, r:0.5},{th:10, r:1.0}]`（"平剩下"→ratio=1.0） |
| "Take profit 50% at +5%, 50% at +10%" | `[{th:5, r:0.5},{th:10, r:0.5}]` |
| "分两档止盈，第一档 +3% 减 30%，第二档 +6% 减 70%" | `[{th:3, r:0.3},{th:6, r:0.7}]` |

无法匹配档位结构（仅识别"分批止盈"短语）→ `status: 'open_slot'`，附 `partial_take_profit_tiers` openSlot。

### 2.2 校验

- `tiers.length ≥ 1`
- `0 < reduceRatio ≤ 1`
- `sum(reduceRatio) ≤ 1`（超过即过度减仓 → openSlot）
- `threshold` 严格递增（重复或乱序 → openSlot）

### 2.3 State builder

seed → `risk[]`，phase 隐式 `'risk'`（沿用现有规约）。`memoryKey` 在 builder 阶段生成（例如 `'partial_tp_' + nanoid(8)`）。

## 3. Canonical Spec Builder

每档独立 risk-phase rule：

```ts
{
  id: `semantic-risk-ptp-${memoryKey}-tier-${i}`,
  phase: 'risk',
  sideScope: <atom.sideScope ?? 'both'>,
  priority: <计算>,
  condition: {
    kind: 'atom',
    key: 'risk.partial_take_profit',
    semanticScope: 'position',
    op: 'GTE',
    value: <tier.trigger.threshold>,
    params: {
      tierIndex: i,
      totalTiers: N,
      memoryKey,
      basis: 'pnl_pct',
    },
  },
  actions: [
    { type: 'REDUCE_LONG',  sizing: { mode: 'RATIO', value: <derivedRatio_i> } },
    { type: 'REDUCE_SHORT', sizing: { mode: 'RATIO', value: <derivedRatio_i> } },
  ],
  metadata: {
    riskKey: 'risk.partial_take_profit',
    tierIndex: i,
    totalTiers: N,
    memoryKey,
  },
}
```

### 3.1 derivedRatio 计算（"% of original" → "% of remaining" 静态展开）

用户写 `[{r:0.5},{r:0.5}]` 期望"两档各平 50% of original"。逐档执行下，第 i 档 fire 时剩余仓位 = `1 - sum(prev_fired_ratios_of_original)`。该档需要减 `reduceRatio_i` of original，对应当时剩余的比例：

```
derivedRatio_i = reduceRatio_i / (1 - sum_{j<i}(reduceRatio_j))
```

例：
- `[{r:0.5},{r:0.5}]` → derived `[0.5, 1.0]`
- `[{r:0.3},{r:0.5},{r:0.2}]` → derived `[0.3, 0.5/0.7, 0.2/0.2] = [0.3, 0.714, 1.0]`

最后一档 derivedRatio 为 1.0 即"清掉剩余"。

### 3.2 不变量

- builder 必须保证 derivedRatio_N == 1（最后一档清仓）当且仅当 sum(reduceRatio) == 1
- sum < 1 时最后一档 derivedRatio < 1（保留剩余仓位） — 这是合法语义
- IR 编译时再次验证，避免 builder bug

## 4. IR 编译（新路径 `tryCompileReduceActionRule`）

### 4.1 触发条件

risk-phase rule + actions 包含 REDUCE_LONG / REDUCE_SHORT + condition.key === 'risk.partial_take_profit'。

### 4.2 编译产物

每档 rule → 一个 `phase: 'exit'` decision program：

- **exprPool**：
  - `POSITION_PNL_PCT` series（已存在）
  - `CONST(threshold)` series
  - `GTE` predicate (POSITION_PNL_PCT, CONST) → 阈值 predicate
- **decisionProgram**：
  ```ts
  {
    id: `program_ptp_${memoryKey}_tier_${i}`,
    phase: 'exit',
    priority: <从 risk priority 转换，保证 ptp 优先级低于普通 exit>,
    when: <阈值 predicate id>,
    metadata: {
      partialTakeProfit: {
        memoryKey,
        tierIndex: i,
        totalTiers: N,
      },
    },
    actions: [
      { kind: 'REDUCE_LONG',  quantity: { mode: 'position_pct', value: derivedRatio_i × 100 } },
      { kind: 'REDUCE_SHORT', quantity: { mode: 'position_pct', value: derivedRatio_i × 100 } },
    ],
  }
  ```

### 4.3 旧 IR byte-equal

不含 partial_take_profit atom 的 spec 编译产物 100% 不变（regression snapshot test）。

## 5. compiled-runtime 扩展（最小改动）

### 5.1 run-decision-programs.ts

在程序选择循环（line 71-94）加 partial_take_profit gate：

```ts
const ptpMeta = program.metadata?.partialTakeProfit
if (ptpMeta) {
  const tierState = readPartialTakeProfitState(ctx, ptpMeta.memoryKey)
  if (tierState[`tier_${ptpMeta.tierIndex}_fired`] === true) {
    continue   // 已 fire，跳过
  }
}
```

decision 触发后写状态（line 92 后）：

```ts
if (ptpMeta) {
  writePartialTakeProfitState(ctx, ptpMeta.memoryKey, ptpMeta.tierIndex)
}
```

### 5.2 helper

新增内部 helper：

```ts
function readPartialTakeProfitState(ctx, memoryKey): Record<string, boolean>
function writePartialTakeProfitState(ctx, memoryKey, tierIndex): void
```

存储位置：`ctx.semanticRuntimeState[memoryKey]`（Phase 0 既有通道；entry-on-open 时由 outer harness 初始化为空对象）。

### 5.3 入场重置

position 从 0 → 非 0 时（开新仓），`semanticRuntimeState[memoryKey]` 必须重置（否则上轮 fired 状态污染本轮）。

**实现**：复用 `__compiledDecisionState` ctx mutation 通道存"上一根 qty"快照。run-decision-programs 进入主循环前：

```ts
const prevQty = compiledState.previousPositionQty ?? 0
const currentQty = readCurrentQty(ctx)
if (prevQty === 0 && currentQty !== 0) {
  // entry edge：清空所有 partial_take_profit memoryKey 的 tier_fired 状态
  resetAllPartialTakeProfitState(ctx)
}
compiledState.previousPositionQty = currentQty
```

`__compiledDecisionState` 本身已经是 ctx mutation；新增 `previousPositionQty` 字段沿用同样机制。backtest 与 live signal 都 share 同一 ctx 状态结构，parity 自动成立。

候选 memoryKey 集合：runtime 不需要枚举所有 atom 的 memoryKey，直接 `Object.keys(ctx.semanticRuntimeState ?? {})` 然后挨个检查 key 前缀 `partial_tp_` 即可。

## 6. 关键不变量与红测对照

| # | 不变量 | 落点 |
|---|---|---|
| I1 | tiers ratio 总和 ≤ 1，threshold 严格递增 | seed extractor + state builder + IR compiler 三处校验 |
| I2 | 旧 IR（无 partial_take_profit）byte-equal | IR snapshot regression test |
| I3 | derivedRatio 换算正确（"% of original" → cumulative position_pct） | builder/IR compiler 单元测试覆盖 [{0.5,0.5}], [{0.3,0.5,0.2}], [{0.4,0.6}] |
| I4 | 单 bar 单档 fire，已 fire tier 不再触发 | parity spec：连续 bar PnL 持续高于阈值，仅首根 fire |
| I5 | position 边沿 reset：第二次开仓不污染 tier_fired | parity spec：close → reopen → 同 tier 重新可 fire |
| I6 | sideScope=long 时 IR 仅 emit REDUCE_LONG action（不带 REDUCE_SHORT）；sideScope=short 同理仅 REDUCE_SHORT；sideScope=both 两个 action 都带，运行时由 `resolveReduceDeltaQty` 按 currentQty 符号决定哪个 noop（既有逻辑） | builder + IR compile 单元测试覆盖三组 sideScope；runtime 路径无需修改 |
| I7 | sum(reduceRatio) < 1 时最后一档 derivedRatio < 1（保留持仓） | builder 单元测试 |
| I8 | sum(reduceRatio) == 1 时最后一档 derivedRatio == 1（清仓） | builder + parity 单元测试 |

## 7. 测试矩阵

### 7.1 单元测试（新增/修改）

- `semantic-atom-registry.service.spec.ts`：partial_take_profit `supportStatus` / `category` / `requiredParams` / `contractSubstrate` / openSlot 路径
- `strategy-semantic-contracts.spec.ts`：contract 字段断言（capabilities/requires/effects/orderRequirements）
- `semantic-seed-extractor.service.spec.ts`：4 类用户表达 → tiers；不可解析 → openSlot
- `semantic-seed-state-builder.service.spec.ts`：seed → risk[]，phase='risk'，memoryKey 生成稳定性
- `canonical-spec-builder.service.spec.ts`：N 档 atom → N 条 rule；derivedRatio 换算
- `canonical-spec-v2-ir-compiler.service.spec.ts`：rule → exit-phase decision program；旧 IR byte-equal
- `run-decision-programs.spec.ts`（packages/shared）：tier_fired gate；entry edge reset

### 7.2 Parity spec（既有文件追加）

`atomic-contract-backtest-runtime-parity.spec.ts` 新增 `describe('phase-1 partial take profit parity', ...)`：

| Case | 序列 | 期望 |
|---|---|---|
| 单档 50% | bars: PnL 跨过 5% | T1 fire 第一根 bar，REDUCE 50%；后续 bar 不再 fire |
| 双档 50/50 | bars: PnL 5% → 10% | T1 fire 当 5%，T2 fire 当 10%；累计减仓 = 入场 100% |
| 双档 sum<1 | [{0.3, 0.5}] sum=0.8 | T1 减 30%，T2 减 50% of original = 50/70 of remaining；终态保留 20% |
| 价格反复 | PnL 5% → 7% → 4% → 8% | T1 在第一根 5% fire，后续 PnL 退回 4% T1 不重 fire，PnL 涨到 8% T1 不重 fire |
| close + reopen | T1 fired，position close，再次开仓 | T1 在新仓位上重新可 fire |
| sideScope=long | atom long-only，short 持仓时 PnL 也跨阈值 | 不触发减仓 |

### 7.3 Corpus 增量

`atom-coverage-golden-cases.ts` 新增至少 4 case：
- 1 supported_executable 双档 50/50
- 1 supported_executable 三档 30/50/20（sum<1）
- 1 supported_requires_slot：仅识别短语缺档位
- 1 mix supported+unsupported：partial_tp + 一个 unsupported atom → 整策略路由 `unsupported_unknown`

### 7.4 E2E happy-path

`apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts` 追加 1 case：
- 用户描述含分批止盈
- canonical IR 含 ≥ 1 partial_tp decision program
- 流程 success

## 8. PR 拓扑与 Ship

单 PR：`feat/984-phase1-partial-take-profit`，commit 序列：

1. `feat(ai-quant): substrate + contract for partial take profit`
2. `feat(ai-quant): seed extractor parses partial take profit tiers`
3. `feat(ai-quant): builder + ir compile reduce-action rules`
4. `feat(shared): partial take profit tier state in decision programs`
5. `test(ai-quant): partial take profit parity + corpus`

每 commit 末尾 `Refs: #984`。

最终 verify：`dx lint` / `dx build quantify --dev` / `npx nx build shared` / `dx test unit quantify` / `npx nx test shared` / `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` / `dx build contracts --dev`。

通过 `git-pr-ship` skill 收口。

## 9. 风险与回滚

| 风险 | 缓解 |
|---|---|
| compiled-runtime state mutation 与既有 cooldown ctx mutation 互相干扰 | 不同 key 命名空间（`semanticRuntimeState` vs `__compiledDecisionState`），物理隔离 |
| derivedRatio 浮点精度 | 全部换算后再 ×100 转 position_pct；保留 6 位小数；parity test 用容差对比 |
| sideScope=long 路径 IR 编译时遗漏 REDUCE_SHORT 省略 | 单元测试覆盖 sideScope=long/short/both 三组 |
| position close 边沿检测在 backtest 有 lookback bar 但 live 没有 | (i) 方案在 run-decision-programs 顶部，两路径 share 同一 ctx.position.qty 前后差，无 lookback 依赖 |
| Seed extractor 误识别（如"50% 仓位"被当成档位） | 模式正则增加上下文锚点（"止盈"/"take profit"/"平"近邻）；corpus 含负例 |

回滚：单 PR commit 序列原子，revert 整 PR 即恢复（registry 退回 unsupported，runtime 改动局限在 run-decision-programs 加几行 metadata 检查、零回归风险）。

## 10. 非目标

- 不支持 `kind: 'price'` / `kind: 'atr_multiple'` 的 tier trigger（schema 预留 union，PR-3 仅 `pnl_pct`）
- 不支持单 bar 多档 fire（runtime 限制，gap up 跨档跨多 bar 完成）
- 不引入新 sizing mode（复用 `position_pct`）
- 不引入新 phase（复用 `'exit'`）
- 不引入 feature flag（YAGNI）
- 不修改 evaluate-guards / evaluate-expr-pool（runtime 改动局限在 run-decision-programs）

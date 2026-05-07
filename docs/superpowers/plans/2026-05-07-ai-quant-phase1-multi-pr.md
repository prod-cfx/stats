# AI Quant Phase 1 Multi-PR Implementation Plan（rev 4，post execution scope adjustment）

## ⚠️ 范围调整（rev 4，2026-05-07 ralph 执行后）

PR-1 实施过程中 dry-check 揭示：仓库 `canonical-spec-builder.service.ts:1030` 显式 filter `if (trigger.phase === 'gate' && !this.isNoPositionGateCondition(condition)) continue` 当前**只让 `position.has_position EQ false` 形态 gate 进入 IR 编译**；其他 gate atom（volume.threshold / volatility.atr_threshold / strategy.time_window）会被丢弃。打通需要：

1. 放宽 line 1030 filter
2. 扩 `buildConditionFromNormalizedTrigger` switch 加 3 个新 atom case（构造 CanonicalConditionNode + operator flip）
3. 扩 IR compiler `tryCompileRiskGuard` 加 EXPRESSION_GUARD 分支生成新 series + CONST + predicate + guard 节点
4. 旧 IR snapshot byte-equal 兼容 + 5 atom × IR snapshot 测试

体量约 100+ 行代码 / 多个 commit。**为避免 PR-1 体量爆炸，IR 编译扩展提取为 follow-up issue 独立交付**。

**PR-1 实际范围（rev 4）**：
- ✅ Phase A：5 atom 注册 + substrate + contract + readiness 白名单
- ✅ Phase B：seed/builder/projection 通用路由（既有泛型代码）
- ✅ Phase D：timezone-clock helper + IN_TIME_WINDOW series kind
- ✅ position.has_position / position.no_position：完整 IR via 既有 MAX_POSITION_PCT 路径
- ⏭ volume.threshold / volatility.atr_threshold / strategy.time_window：substrate/contract/readiness/runtime helper 全部到位，但 IR 编译路径**提取为 follow-up issue**（同 #984 Phase 1 范围内的子任务）

**原 PR-2（risk.partial_take_profit）顺延为 PR-3**。

---

# 原计划（rev 2，仅作历史参考；实际以 rev 4 执行）

# AI Quant Phase 1 Multi-PR Implementation Plan（rev 2，post critic round 1）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Tasks use `- [ ]` checkbox tracking. Design reference: `docs/superpowers/specs/2026-05-07-ai-quant-phase1-trigger-gates-design.md`（含 §9 修订段，**以 §9 为准**）。

**Goal:** 把 issue #984 Phase 1 的 5 个 atom（4 个 trigger-kind gate + 1 个 risk-kind reduce action）从 unsupported 升级为 supported_executable / supported_requires_slot；每个完成 contract → canonical IR → compiled runtime → backtest/live signal parity → corpus 全闭环。
**Track:** C
**Total PRs:** 2
**Issue:** #984
**Branch (PR-1):** `feat/984-phase1-trigger-gates`（已切，基于 origin/main）
**Critic 报告 (round 1)：** `.omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round1.md`（处理结论：全部 17 条均"修"，本 rev 2 落地）

---

## 0. 已 dry-check 的仓库现状（避免幻觉）

| 项 | 实际 | 备注 |
|---|---|---|
| 共享包 barrel | `packages/shared/src/script-engine/compiled-runtime.ts`（**同名 .ts**，非 `compiled-runtime/index.ts`） | 当前导出 7 个：`buildCompiledManifest / canonicalSerialize / evaluateExprPool / evaluateGuards / evaluateRiskPredicates / runDecisionPrograms / runOrderPrograms` |
| Live 主循环 | `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts:704-731` `buildCompiledRuntimeAdapter` 中 `onBar` | 调用栈：`evaluateExprPool → evaluateGuards → evaluateRiskPredicates → runDecisionPrograms → runOrderPrograms` |
| Backtest 主循环 | `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts` | 复用同一 compiled-runtime 函数，parity 自动成立 |
| Entry 抑制 | `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts:74-76` | `if (program.phase === 'entry' && guardState.blockNewEntry) continue` —— 已天然实现"gate 失败仅压制新开仓" |
| Series 原语 | `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.ts:78-104` | 已含 `VOLUME / ATR / POSITION_BARS_HELD / POSITION_AVG_PRICE / POSITION_PNL_PCT` —— `volume.threshold / volatility.atr_threshold` 0 个新 series kind |
| Predicate 原语 | 同上 :129-146 | 已含 `GT / GTE / LT / LTE / EQ / AND / OR / NOT` |
| Guard 通道 | `packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts` | `EXPRESSION_GUARD` + `onBreach: 'BLOCK_NEW_ENTRY' \| 'FORCE_EXIT' \| 'HALT_STRATEGY' \| 'CANCEL_ORDER_PROGRAMS'`；`appliesTo: 'long' \| 'short' \| 'both'` 已存在 |
| Registry 字段 | `category`（不是 `kind`，spec §9.8 已澄清） | `executableTrigger` 等 helper 设 `category: 'trigger' \| 'action' \| 'risk' \| 'position' \| 'context'` |
| `supportedRequiresSlotRisk` | registry line 261-281 | 模板：本 PR 衍生新 `supportedRequiresSlotTrigger` helper |
| Existing parity spec | `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`（10.7K） | 本 PR 在此文件追加 `describe('phase-1 gate parity', ...)` 段，不新建 |
| Existing e2e | `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`（11.3K，**已存在**，round 1 dry-check 笔误，round 2 critic N4 修正） | PR-1 在此文件追加 1 个 happy-path case：用户描述含成交量阈值 + MA 金叉 → IR 含 1 gate + 1 entry → 流程 success；命令 `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` |
| Test 命令 | `dx test unit quantify` 实际跑 `pnpm --filter @net/quantify run test`（dx 配置） | 见根 `package.json`；`-t '<pattern>'` 透传 jest `--testNamePattern` |
| Shared 包 test | **无 `pnpm --filter @ai/shared test`**（未声明 test script）；走 `npx nx test shared` 或 `npx nx test shared -t '<pattern>'` | 不要写 `pnpm --filter @ai/shared test` |
| Contracts 重生成检查 | 改 IR 类型 + 新 atom 不影响 `apps/backend/src/swagger/export-openapi.ts` 与 `apps/quantify/src/swagger/export-openapi.ts` 的 OpenAPI 输出 schema —— 但**必须显式跑** `dx build contracts --dev` 验证零 diff | M6 触发 |

不影响层（已确认 Phase 1 零关联）：ErrorCode / RBAC / Swagger / Seed / 菜单注册 / Prisma migration / Auth。

---

## PR 拓扑

| # | PR 标题 | 涵盖层 | 依赖 | 哨兵 |
|---|---|---|---|---|
| 1 | feat(ai-quant): Phase 1 trigger-kind gate atoms | quantify llm-strategy-codegen + IR compiler + packages/shared compiled-runtime + corpus | - | 否（同步管线） |
| 2 | feat(ai-quant): Phase 1 risk.partial_take_profit reduce action | quantify llm-strategy-codegen risk path + compiled-runtime reduce-action 编译 + corpus | #1 merged | 否 |

PR-2 当前**仅占位**：完整设计在 PR-1 ship 后另起 brainstorming 与独立 plan 文件，本计划不予扩写（critic M4）。

---

# PR 1: feat(ai-quant): Phase 1 trigger-kind gate atoms

## 任务前提

- 设计取自 spec §9（修订后的 evaluateGuards 复用路径），不再造 `evalGates`。
- 5 个 atom 的 sideScope `'long' / 'short' / 'both'` 在 IR 透传，但 runtime 不区分 side（Phase 1 已知简化，spec §9.4）。
- gate predicate 在 IR 编译阶段 operator flip（用户语义 `GT` → guard 触发条件 `LTE`），spec §9.3。

## Phase A — Registry 与 Contract（5 task）

### Task A0：重构 `executableTrigger` 等 helper 接受可选 substrate factory（critic M1）

**Files:** `apps/quantify/.../services/semantic-atom-registry.service.ts` + spec

- [ ] Step 1：写失败测试 in `__tests__/semantic-atom-registry.service.spec.ts`：现有 50+ atom 仍按 `baseExecutableSubstrate()` 输出 substrate，byte-equal 既有 fixture。新增一个 contrived case 调 `executableTrigger('foo', [], () => positionSubstrate())` 断言 substrate 等于 positionSubstrate。
- [ ] Step 2：把 `executableTrigger / executableAction / executableRisk / executablePosition` 改为接受可选第三参数 `substrateFactory?: () => SemanticAtomContractSubstrate`，默认沿用既有 substrate。所有现有调用点 byte-equal。
- [ ] Verify: `dx test unit quantify -t 'semantic-atom-registry'`
- [ ] Commit: `refactor(ai-quant): allow custom substrate factory in registry helpers`

### Task A1：4 个 substrate 工厂（A=volume / B=atr / C=time-window / D=position-state）

**Files:** `semantic-atom-registry.service.ts`

- [ ] Step 1：写失败测试，4 工厂返回的 substrate 字段与 spec §2.3 / §9.5 一致；substrate immutable（参考 Phase 0 invariant 模式）。
- [ ] Step 2：实现 `volumeGateSubstrate()` / `atrGateSubstrate()` / `timeWindowGateSubstrate()`（含 timezone openSlot）/ `positionGateSubstrate()`，runtime/state/order requirements 严格按 spec §2.3。
- [ ] Verify: `dx test unit quantify -t 'gate substrate'`
- [ ] Commit: `feat(ai-quant): add phase-1 gate substrate factories`

### Task A2：5 atom 在 registry 升级 supported

**Files:** `semantic-atom-registry.service.ts`

- [ ] Step 1：写失败测试，5 atom resolve 后 `supportStatus` / `category='trigger'` / `requiredParams` / `contractSubstrate` 符合 spec §3。`time_window` `supportStatus='supported_requires_slot'` 含 timezone openSlot；其余 4 atom `supported_executable`。`position.has_position` 与 `position.no_position` 各自独立注册。
- [ ] Step 2：从 ATOMS 数组移除 5 行 `unsupported('volume.threshold' / 'volatility.atr_threshold' / 'strategy.time_window' / ...)`；新增：
  - `executableTrigger('volume.threshold', ['metric','operator','value','unit'], volumeGateSubstrate)`
  - `executableTrigger('volatility.atr_threshold', ['period','operator','threshold','thresholdUnit'], atrGateSubstrate)`
  - 新建 `supportedRequiresSlotTrigger(key, requiredParams, openSlots, substrateFactory)` helper（仿 `supportedRequiresSlotRisk`，category 改 'trigger'）
  - `supportedRequiresSlotTrigger('strategy.time_window', ['timezone','windows'], [timezoneOpenSlot], timeWindowGateSubstrate)`
  - `executableTrigger('position.has_position', [], positionGateSubstrate)`
  - `executableTrigger('position.no_position', [], positionGateSubstrate)`
- [ ] Verify: `dx test unit quantify -t 'semantic-atom-registry'`
- [ ] Commit: `feat(ai-quant): upgrade phase-1 gate atoms to supported`

### Task A3：5 contract spec（capabilities/requires/effects）

**Files:** `apps/quantify/.../services/strategy-semantic-contracts.ts` + spec

- [ ] Step 1：写失败测试断言 5 contract 的 capabilities / requires / effects / orderRequirements 与 spec §3 一致：
  - `volume.threshold` / `atr_threshold` / `time_window` / `has_position` / `no_position`
  - 共有不变量：`effects = guard.block_entry_when_false.new_position`；`orderRequirements: []`
- [ ] Step 2：增 5 个 contract spec；提取 `gateBlockEntryEffect()` helper。
- [ ] Verify: `dx test unit quantify -t 'strategy-semantic-contracts'`
- [ ] Commit: `feat(ai-quant): declare phase-1 gate atom contracts`

### Task A4：semantic-contract-readiness 回归（critic Missing #5）

**Files:** `apps/quantify/.../services/__tests__/semantic-contract-readiness.service.spec.ts`

- [ ] Step 1：加 5 个 case：5 atom 各自满足 substrate / requiredParams 时进入 deployable canonical truth；`time_window` 缺 timezone 进 openSlot；混合 supported_executable + recognized_unsupported atom 时不能伪部署（沿 Phase 0 行为）。
- [ ] Step 2：跑测试，确认 readiness 现有逻辑无回归；如有需要微调（基本不需要——substrate 通用机制已在 Phase 0 落地）。
- [ ] Verify: `dx test unit quantify -t 'semantic-contract-readiness'`
- [ ] Commit: `test(ai-quant): readiness regression covers phase-1 gates`

## Phase B — Seed Extractor / State Builder / Projection（4 task，含关键不变量红测）

### Task B1：Seed extractor 识别 5 atom（含中英文模式）

**Files:** `apps/quantify/.../services/semantic-seed-extractor.service.ts` + spec

- [ ] Step 1：写失败测试 in `semantic-seed-extractor.service.spec.ts`，覆盖：
  - "成交量大于 100 BTC 才开仓" → `volume.threshold` `{metric:'base_volume', operator:'GT', value:100, unit:'base'}`
  - "成交额低于 10 万美元时不开仓" → `volume.threshold` `{metric:'quote_volume', operator:'LT', value:100000, unit:'usd'}`
  - "ATR 大于 1% 才开仓" → `volatility.atr_threshold` `{period:14, operator:'GT', threshold:1, thresholdUnit:'percent_of_close'}`
  - "Asia/Shanghai 9:30-15:00 才开仓" → `strategy.time_window` `{timezone:'Asia/Shanghai', windows:[{start:'09:30', end:'15:00'}]}`
  - "9:30-15:00 才开仓"（**无时区**）→ `strategy.time_window` 含 windows 但 timezone 缺 → openSlot；**critic C6 不变量：绝不默认 UTC**
  - "无仓时才开仓" → `position.no_position` `{}`，sideScope='both'（默认）
  - "已有多仓不重复开仓" → `position.no_position` `{}`，sideScope='long'（critic N1 修正：用户语义"不重复开仓"=要求"无仓"作为开仓前置条件，映射到 `no_position` 而不是 `has_position`；spec §3.4 已澄清两 atom 都是 positive gate）
  - "已有持仓时只允许加仓不允许新开"（罕见用例）→ `position.has_position` `{}`：表示"必须已有仓位才能进入此 entry"，少见但保留 atom key 以满足 issue 列表完整性
- [ ] Step 2：扩展 extractor 模式集（参考既有 `volume.relative_average` 等）。`time_window` 时区缺失分支必须显式生成 openSlot 而非默认值。
- [ ] Verify: `dx test unit quantify -t 'semantic-seed-extractor'`
- [ ] Commit: `feat(ai-quant): extract phase-1 gate atom seeds`

### Task B2：State builder 写 phase='gate'（critic C6 不变量：has_position 不进 add_position）

**Files:** `apps/quantify/.../services/semantic-seed-state-builder.service.ts` + spec

- [ ] Step 1：写失败测试断言：
  - 5 类 seed 映射到 `triggers[]` 且 `phase='gate'`
  - sideScope 默认 `'both'`，但 extractor 给的 `'long'/'short'` 透传不丢（**仅记录在 SemanticTriggerState；不下推到 IR guard.appliesTo，spec §9.4 修订 + critic N2**）
  - **`position.has_position` / `position.no_position` 不被映射到 `actions[]`，不被识别为 add_position action**（critic C6 不变量 + N3 充实）：在同一测试文件加对照组 case：`action.add_position` seed（虽然当前 unsupported）走 `actions[]` 路径——证明 builder 有 atom→action 通路存在；本 PR 的 5 atom 必须走 `triggers[]`，对照下不会假阴性
- [ ] Step 2：扩展 builder 路由表，5 atom 显式归入 trigger gate；明确 reject 把 `position.has_position` 当 action。
- [ ] Verify: `dx test unit quantify -t 'semantic-seed-state-builder'`
- [ ] Commit: `feat(ai-quant): build phase-1 gate triggers from seeds`

### Task B3：Projection 收集 phase='gate' 段（不外露新顶层字段）

**Files:** `apps/quantify/.../services/semantic-state-projection.service.ts` + spec

- [ ] Step 1：写失败测试：
  - phase='gate' trigger 不被错误投影到 `spec.entry` / `spec.exit`
  - `time_window` 缺 timezone → openSlot 出现在投影输出（critic C6 不变量）
  - 旧 fixture 无 gate trigger → 投影输出 byte-equal 既有 snapshot
- [ ] Step 2：projection 区分 phase；`phase==='gate'` 内部归入"gate 收集段"（spec §9.2 不下推为新 IR 顶层字段）。
- [ ] Verify: `dx test unit quantify -t 'semantic-state-projection'`
- [ ] Commit: `feat(ai-quant): project gate triggers as internal segment`

## Phase C — Canonical Spec Builder + IR Compiler（2 task，主要改动点）

### Task C1：Canonical spec builder 透传 gate 段

**Files:** `apps/quantify/.../services/canonical-spec-builder.service.ts` + spec

- [ ] Step 1：写失败测试：
  - builder 输入含 phase='gate' trigger 时，输出 spec 内可被 IR compiler 识别（具体落地形式由实施决定，不外露为顶层字段）
  - 旧 fixture（无 gate）输出 byte-equal snapshot
- [ ] Step 2：builder 把 gate trigger 透传给下游 IR compiler。
- [ ] Verify: `dx test unit quantify -t 'canonical-spec-builder'`
- [ ] Commit: `feat(ai-quant): pass gate triggers to ir compiler`

### Task C2：IR compiler 把 gate trigger 编译为 exprPool + guards 条目（含 operator flip 不变量）

**Files:** `apps/quantify/.../services/canonical-spec-v2-ir-compiler.service.ts` + spec

- [ ] Step 1：写失败测试 in `canonical-spec-v2-ir-compiler.service.spec.ts`：
  - 单 gate `volume.threshold metric=base_volume operator=GT value=100`：
    - `ir.exprPool` 含 `VOLUME` series + `CONST(100)` series + `LTE` predicate（**operator flip：用户 GT 翻成 guard 触发的 LTE**，spec §9.3）
    - `ir.guards` 含 `{kind:'EXPRESSION_GUARD', onBreach:'BLOCK_NEW_ENTRY', appliesTo:'both', predicateRef: <pred id>}`
    - **`appliesTo: 'both'` 硬钉，即使 SemanticTriggerState.sideScope='long' 也不下推**（critic N2 修正：`isGuardBreached` 在 EXPRESSION_GUARD `scope='position'` 分支会消费 appliesTo，避免与 Phase 1 简化矛盾；sideScope 仅保留在 canonical spec metadata 供 Phase 5 orchestration 使用）
    - `ir.topology.guardOrder` 末尾追加 guard id
  - `volatility.atr_threshold operator=GT` → ATR series + LTE predicate
  - `strategy.time_window` → 新 series kind `IN_TIME_WINDOW`（payload 含 windows + timezone，窗口内返回 1，窗口外返回 0）+ predicate `EQ` 与 `CONST(0)` → 窗口外 predicate=true → guard 触发 → block 新开仓；窗口内 predicate=false → guard 不触发
  - `position.has_position` "需要已有持仓才允许进入" → 新 series kind `HAS_POSITION` 当有仓位返回 1，predicate `EQ` const 0（即"has_position == false"）→ 当无仓时 predicate=true → guard 触发 block。
  - `position.no_position` "需要无持仓才允许进入" → `HAS_POSITION` series + predicate `EQ` const 1（即"has_position == true"）→ 当有仓时 predicate=true → guard 触发 block。
  - **critic N1 修正**：以上两条与 spec §3.4 修订一致。`has_position`（要求有仓）与 `no_position`（要求无仓）是对偶 positive gate，编译产物互为对称，绝不弄反。专属红测：构造 `ctx.position.qty=0` + `position.no_position` → guard 不触发；`ctx.position.qty=1` + `position.no_position` → guard 触发 → entry blocked。
  - **critic C6 不变量**：`position.has_position / no_position` 不被识别为 add_position
  - 旧 spec 无 gate trigger → IR snapshot 与 PR 之前 byte-equal（critic Missing #2 兼容路径）
- [ ] Step 2：实现 IR 编译路径：
  - 收集 gate triggers
  - 对每个生成 series 节点（VOLUME / ATR / IN_TIME_WINDOW / HAS_POSITION / CONST）+ predicate 节点（GT/GTE/LT/LTE/EQ）
  - operator flip 表（user→guard-trigger）：`GT→LTE / GTE→LT / LT→GTE / LTE→GT / EQ→NOT-EQ → 用 NOT predicate`；time_window / has_position 类已经写成 truthy 反，简化处理
  - guards push EXPRESSION_GUARD onBreach=BLOCK_NEW_ENTRY；topology guardOrder 同步追加
- [ ] Verify: `dx test unit quantify -t 'canonical-spec-v2-ir-compiler'`
- [ ] Commit: `feat(ai-quant): compile gate triggers into exprPool and guards`

## Phase D — Compiled Runtime 扩展（2 task，最小改动）

### Task D1：timezone-clock helper（critic Missing #6 性能）

**Files:** `packages/shared/src/script-engine/compiled-runtime/helpers/timezone-clock.ts`（新文件）+ spec

- [ ] Step 1：写失败测试 `helpers/__tests__/timezone-clock.spec.ts`：
  - `getWallClock(timestamp, 'Asia/Shanghai')` 返回 `{ hours, minutes, dayOfWeek }`
  - 非法 IANA tz 抛 `InvalidTimezoneError`
  - 同 timezone 重复调用复用 `Intl.DateTimeFormat` 实例（**critic Missing #6**：模拟构造计数 ≤1 per timezone）
  - DST 切换日的边界正确（如 `Australia/Sydney` 4 月转 DST）
- [ ] Step 2：实现 module-level `Map<string, Intl.DateTimeFormat>` cache；纯函数；不调 `Date.now()`。
- [ ] Verify: `npx nx test shared --testPathPattern=timezone-clock`
- [ ] Commit: `feat(shared): add timezone-clock runtime helper with Intl.DateTimeFormat cache`

### Task D2：新增 2 series kind `HAS_POSITION` / `IN_TIME_WINDOW`（含错误传播一致性 critic M7）

**Files:** `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.ts` + spec

- [ ] Step 1：写失败测试 in `evaluate-expr-pool.spec.ts` 加 case：
  - `HAS_POSITION` payload `{ kind:'HAS_POSITION', side?: 'long'|'short'|'any' }`：读 `ctx.position.qty`（`any` 默认）；qty != 0 → 1，否则 0；ctx 无仓位状态 → 0
  - `IN_TIME_WINDOW` payload `{ kind:'IN_TIME_WINDOW', timezone, windows: [{daysOfWeek?, start, end}] }`：调 timezone-clock；窗口内 → 1，否则 0
  - 错误一致性（critic M7）：非法 timezone / `Intl.DateTimeFormat` 抛错 → series 返回 `null`，与 `evaluateExprPool` 既有错误传播策略对齐（NOT 抛到上层；后续 predicate 收到 null → false）
- [ ] Step 2：在 `evaluateSeries` switch 加 2 case：
  - `HAS_POSITION` 直接读 ctx；try/catch 包 timezone-clock 调用
  - `IN_TIME_WINDOW` 同 try/catch 范式
- [ ] Verify: `npx nx test shared --testPathPattern=evaluate-expr-pool`
- [ ] Commit: `feat(shared): add HAS_POSITION and IN_TIME_WINDOW series kinds`

## Phase E — Parity 与 Corpus（2 task）

### Task E1：parity spec 追加 phase-1 gate 段（critic M5）

**Files:** `apps/quantify/.../services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`（修改既有）

- [ ] Step 1：在既有文件 `describe('phase-1 gate parity', ...)` 段加 5 组 fixture，每个 atom 一组：相同 OHLCV + position state + time → backtest path 与 live signal fast path 决策序列 **byte-equal**。
- [ ] Step 2：fixture 选取：
  - volume.threshold：bar volumes 跨阈值，断言 entry 在 bar 5 被 gate 阻塞
  - atr_threshold：lookback 内 ATR 跨阈值
  - time_window：bar timestamps 跨开仓窗口
  - has_position：模拟 ctx.position 序列
  - no_position：同
  - 加 1 个 invariant case：gate 失败 + 已有仓位 → exit 仍触发（spec §9.6）
- [ ] Verify: `dx test unit quantify -t 'phase-1 gate parity'`
- [ ] Commit: `test(ai-quant): backtest live parity for phase-1 gates`

### Task E2：Corpus 增量 8 case

**Files:** `apps/quantify/.../services/__tests__/fixtures/atom-coverage-golden-cases.ts` + `atom-coverage-golden-corpus.spec.ts`

- [ ] Step 1：按 spec §6.6 加 8 case：
  - 4 supported_executable 正例（volume / atr / position.has / position.no 各一）
  - 1 supported_requires_slot：time_window 缺 timezone
  - 1 mix supported+unsupported：gate + 一个 unsupported entry → 整策略路由 `unsupported_unknown` 优先（**critic Ambiguity #2 显式断言**：按 atom 路由不是按整策略 — 此 case 验证如果 strategy 中含 unsupported_unknown atom，整策略不应被宣告 supported_executable）
  - 1 gate + indicator.cross_over 完整可执行策略
  - 1 sideScope='long' 的 position.no_position：断言 sideScope 保留在 SemanticTriggerState（canonical metadata），但 **IR guard.appliesTo='both' 硬钉**（critic N2 + spec §9.4 修订）；runtime 行为：有仓时 block 全部新开仓（不区分 side）
- [ ] Step 2：corpus spec 显式断言旧 case 0 行为变化（snapshot diff = 0）。
- [ ] Verify: `dx test unit quantify -t 'atom-coverage-golden-corpus'`
- [ ] Commit: `test(ai-quant): extend coverage corpus with 8 phase-1 cases`

### Task E3：E2E happy-path 追加（critic round 3 P1）

**Files:** `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`（修改既有 11.3K 文件，append case）

- [ ] Step 1：在既有 e2e 文件加 1 个 happy-path case：
  - 用户描述含成交量阈值 + MA 金叉
  - 后端识别 → SemanticTriggerState 含 `phase='gate'` (volume.threshold) + entry trigger
  - canonical IR 含 ≥ 1 guard（gate）+ ≥ 1 decision program（entry）
  - 流程 success（HTTP 200 / status 'completed' 视既有契约而定）
- [ ] Step 2：参考既有 case 的 fixture 与 setup 风格，复用 `apps/quantify/e2e/helpers/` 与 `apps/quantify/e2e/fixtures/`。
- [ ] Verify: `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`
- [ ] Commit: `test(ai-quant): e2e happy path covers phase-1 gate atom`

## Phase F — 最终 Verify + Ship（含 contracts 检查 critic M6）

### Task F1：全验证流水线

- [ ] 并行（**run_in_background**）：
  - `dx lint`
  - `dx build quantify --dev`
  - `npx nx build shared`
  - `dx test unit quantify`
  - `npx nx test shared`
  - `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`（**critic round 3 P1**）
  - `dx build contracts --dev`（**critic M6**：验证 quantify swagger schema diff = 0；如有 diff，必须 commit `packages/api-contracts/src/generated/quantify.ts`）
- [ ] 全绿后进入 ship。

### Task F2：通过 git-pr-ship 收口

- [ ] 调用 `git-pr-ship` skill：commit / push / `gh pr create --base main` / critic PR diff / 双 comment / `gh pr merge --squash --auto`
- [ ] PR body 必含：
  - `Refs: #984`
  - `Spec: docs/superpowers/specs/2026-05-07-ai-quant-phase1-trigger-gates-design.md`（含 §9 修订）
  - `Plan: docs/superpowers/plans/2026-05-07-ai-quant-phase1-multi-pr.md`
  - `Plan critic round 1: .omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round1.md`
  - `Plan critic round 2: .omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round2.md`
  - `Plan critic round 3: .omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round3.md` (ACCEPT-WITH-RESERVATIONS)
- [ ] 等待 auto-merge 真正合并到 main（auto-merge stuck > 30 min 人工介入）

---

# PR 2: feat(ai-quant): Phase 1 risk.partial_take_profit reduce action

PR-1 ship 并 merge 到 main 后另起 brainstorming，独立 plan 文件 `docs/superpowers/plans/2026-05-XX-ai-quant-phase1-partial-take-profit.md`。本 plan 不预先扩写（critic M4）。

---

## 测试运行参考（实测命令）

| 指标 | 命令 |
|---|---|
| Lint | `dx lint` |
| Quantify build | `dx build quantify --dev` |
| Shared build | `npx nx build shared` |
| Quantify unit（按 case 名） | `dx test unit quantify -t '<name>'` |
| Shared unit（按文件） | `npx nx test shared --testPathPattern=<filename>` |
| Shared unit（按 case 名） | `npx nx test shared -t '<name>'` |
| Contracts 重生成验证 | `dx build contracts --dev`，检查 `packages/api-contracts/src/generated/quantify.ts` git diff |
| Backend build（如 contracts 受影响） | `dx build backend --dev` |
| Migration | 无（PR-1 零 schema 变更） |

## 回滚点

| 粒度 | 触发 | 动作 |
|---|---|---|
| 单 atom | 某 atom corpus / parity 不稳 | registry 单独退回 unsupported + replacement 兜底 |
| Gate 通道 | runtime IR 编译 / new series kind 出问题 | revert PR；Phase 0 substrate 不受影响 |
| 整 PR | 大面积异常 | `git revert` PR commit |

不引入 feature flag（YAGNI；spec §9.7：rev 2 设计 diff 极小，runtime evaluateGuards/runDecisionPrograms 零改动，回滚风险显著低于 rev 1）。

## 关键不变量与红测对照表（critic C6 兜底）

| # | 不变量 | 落到的 task 红测 |
|---|---|---|
| I1 | gate 失败时 exit/risk 仍能触发（已有仓位可退出） | E1 invariant case + run-decision-programs 现有行为（既有测试） |
| I2 | 旧 IR（无 gate 编译产物）byte-equal | C2 Step 1 snapshot test + E2 corpus snapshot |
| I3 | `position.has_position` / `no_position` 不被识别为 add_position action | B2 Step 1 显式断言 + corpus mix case |
| I4 | `time_window` 缺 timezone → openSlot，绝不默认 UTC | B1 Step 1 + B3 Step 1 + E2 corpus requires_slot case |
| I5 | gate predicate operator flip 正确（用户 GT → guard 触发 LTE） | C2 Step 1 |
| I6 | sideScope 透传但 Phase 1 runtime 不区分 side | C2 Step 1 + E2 corpus sideScope='long' case |
| I7 | `Intl.DateTimeFormat` 实例缓存 | D1 Step 1 |
| I8 | new series kind 错误传播一致：返回 null 不抛 | D2 Step 1 |
| I9 | gate guard 节点 `payload.scope` 不能设为 `'position'`（critic round 3 P2）：`evaluate-guards.ts:80` 的 EXPRESSION_GUARD 分支会在 `scope='position' && qty=0` 时短路返回 false，与 gate 语义冲突。要求 IR 编译器 omit `scope` 字段或显式设非 `'position'` 值 | C2 Step 1：`expect(ir.guards[*].payload.scope).not.toBe('position')` |

## 风险与缓解（spec §7 + §9 同步）

参见 spec §7.4 + §9.7。本 rev 2 主要降低风险：
- runtime 零改动 evaluateGuards / runDecisionPrograms → live 路径不变更
- 不新增 IR 顶层字段 → 反序列化兼容自动满足
- 不新建 onBar 阶段 → onBar 顺序的"评估顺序错放"风险不存在
- 仅 IR 编译器与 2 个 series kind 是新代码，TDD 红测覆盖

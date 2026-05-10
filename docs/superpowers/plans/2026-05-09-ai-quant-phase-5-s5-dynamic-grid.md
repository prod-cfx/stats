# AI Quant Phase 5 S5 — program.dynamic_grid Implementation Plan (v3)

## v3 关键修正 vs v2（critic round 2）

| critic round 2 | v2 缺陷 | v3 修正 |
|---|---|---|
| **C1 validator/builder 必须按 programKind 显式拆分** | v2 仍让 `isValidOrchestrationProgram` / `buildOrchestrationWorkingOrder` 全程序通用；现实代码 `run-order-programs.ts:108-117` 在 switch 之前直接 destructure `gridParams`，dynamic_grid 没有 `gridParams` 会被静默 cancelled；`buildOrchestrationWorkingOrder:131-157` 硬编码 `sourceRef: 'orchestration:program.fixed_grid_gated'` | **MUST rename + 拆分**：`isValidOrchestrationProgram → isValidFixedGridGated`；`buildOrchestrationWorkingOrder → buildFixedGridGatedWorkingOrder`；新增 `isValidDynamicGrid` + `buildDynamicGridWorkingOrder`（`sourceRef: 'orchestration:program.dynamic_grid'`）。**主循环入口**：`switch (program.programKind)` 必须发生在 destructure / sourceRef 写入之前；fixed_grid_gated 分支调 renamed validators / builder；dynamic_grid 分支调新建 validator / builder + 7 NOOP/rebuild 路径 |
| **M1 ProgramLifecycleStateNext 复杂 entry 必须深 freeze** | S0a 已要求"S5/S6 引入复杂 entry 时升级为深 freeze"；v2 只声明顶层 freeze；新增 `lastBuildLadder: readonly { id; level }[]` 是嵌套数组 | **Acceptance Runtime 加项**：写入 `programLifecycleStateNext[id]` 时 `Object.freeze(entry)` + `Object.freeze(entry.lastBuildLadder)`；Task 13 spec 必含"mutate entry.lastBuildLadder.push() throws / mutate entry.lastBuildAt = X throws"断言 |
| **M2 Live state map + cleanup hook 进 S5 scope** | v2 punt 到 follow-up；issue #1081 明确 S5/S6 必须建 live state map + cleanup hook | **拉进 S5 Task 15**：`signal-generator.service.ts` 维护 `programLifecycleStateByStrategyInstanceId: Map<string, Record<string, ProgramLifecycleState>>`；传入真 state map（不再 undefined）；从 `multiLegData[primaryLeg.id]?.[execution.timeframe]?.bars` 填 `ctx.bars`；attach cleanup hook 到 strategy-instance stop/delete 事件（grep `apps/quantify/src/modules/strategy-instances` 找现有 hook；若无则添加最小 cleanup callback 并在 plan 列出 file:line） |
| **M3 ctx.timestamp 必须确定性，禁止 Date.now() 回退到 backtest 路径** | v2 写 `ctx.timestamp ?? Date.now()`；backtest 中 Date.now() = 墙钟 → throttle 行为非确定性 | **runtime fail-closed**：`ctx.timestamp` undefined 时使用 `bars[bars.length - 1].timestamp`（从 K 线确定性派生）；任何分支都 **禁止** fallback Date.now()；Task 13 spec 加：backtest fixture 不 stub Date.now，断言 `lastBuildAt === bars[lastIdx].timestamp` |
| **M4 cancelOrderPrograms guard 分支必须 pass-through dynamic_grid lifecycle 状态** | 当前实现 `guardState.cancelOrderPrograms === true` 时所有 program 进 cancelledProgramIds；dynamic_grid lifecycle state 被 drop → 下一根 throttle 状态丢失 | **Acceptance Runtime 加项**：`guardState.cancelOrderPrograms === true` 且 `programKind === 'dynamic_grid'` → pass-through `programLifecycleStateIn?.[id]` 到 `programLifecycleStateNext[id]`（保留 throttle 状态）；若无 prev 则不写 entry；Task 13 spec 加 case |
| m1 display blacklist 'high'/'low'/'mid' 英文裸词 | 中文 display 表面无暴露；defense in depth | 不变更，标注为防御性 |

# AI Quant Phase 5 S5 — program.dynamic_grid Implementation Plan (v2)

**Goal:** 在 S4 program substrate + S0a program-lifecycle substrate 上注册第 4 个 supported orchestration capability `program.dynamic_grid`：anchor 跟随 lookback 窗口 high/low/mid 漂移，触发 ladder rebuild。关闭 issue Phase 5 验收 bullet `#8(dynamic)`。

**Track:** C（Phase 5 multi-pr train PR3，详见 `docs/superpowers/plans/2026-05-09-ai-quant-phase-5-multi-pr.md`）
**Total PRs:** 1（本 plan 即 PR3）
**Issue:** #984
**Spec:** `docs/superpowers/specs/2026-05-09-ai-quant-phase-5-s5-s6-design.md`
**Pattern reference:** S4 (#1069) `docs/superpowers/plans/2026-05-09-ai-quant-phase-5-s4-fixed-grid-gated.md` — 完整 program substrate 闭环模板（19 task TDD 范式），本 plan 严格继承
**Substrate baseline:** S0a (PR #1077) — `ProgramLifecycleState` union + `runOrderPrograms` 第 8 参 `programLifecycleStateIn` + `CompiledOrderState.programLifecycleStateNext` + `ctx.bars` 通道 + readiness vocab `state.read_write.program_lifecycle` / `runtime.provide.bar_ohlcv` 已就位
**Branch:** `feat/984-phase5-s5-dynamic-grid`
**Worktree:** 由执行者通过 `superpowers:using-git-worktrees` 创建

## v2 关键修正 vs v1

| critic round 1 | v1 缺陷 | v2 修正 |
|---|---|---|
| C1 substrate state channel | v1 假设需要新建 state 通道 | **由 S0a 提供**：复用 `ProgramLifecycleState` union（`packages/shared/src/script-engine/compiled-runtime/program-lifecycle-state.ts`）+ `runOrderPrograms` 第 8 参 + `CompiledOrderState.programLifecycleStateNext`；S5 仅在 union **追加成员** |
| C2 kline.window vocab | v1 写 `runtime.read.kline.window`（不存在 vocab key） | **改为 `runtime.provide.bar_ohlcv`**（S0a 已注册的现有 vocab，与 ATR 等指标统一） |
| C3 anchor wiring | v1 未指定 K 线读取通道 | **改为读 `ctx.bars`**（S0a 已 populate；类型 `Bar[] \| undefined`，来自 `@ai/shared` `helpers/technical-indicators.ts`） |
| C4 W5 close vs cancel 合成路径 | v1 含糊"撤旧 ladder + 重生成" | **显式拆分**：rebuild-trigger 引发的旧 ladder 撤单 → 进 `cancelledProgramIds`；onDeactivate=close → 进 `closeProgramIds`（与 S4 同语义）；rebuild_throttled / insufficient_kline / anchor_invalid NOOP 路径 → **不输出新 workingOrder，但通过 `programLifecycleStateNext` 透出 `lastBuildLadder`，由上层 `buildOrchestrationWorkingOrder` 还原成 keep-current-ladder 形态** |
| M1 anchorLookbackBars 运行时校验 | v1 仅 readiness 校验 | **追加 runtime fail-closed**：`if (!ctx.bars \|\| ctx.bars.length < anchorLookbackBars) → NOOP reason='compiled.orchestration.program.insufficient_kline_window'` |
| M2 CompiledOrchestrationProgram 离散联合 | v1 union 扩展未要求 discriminated by `programKind` | **强制 discriminated union by `programKind`**：保留 S4 fixed_grid_gated narrowing 安全；新增 `'dynamic_grid'` 变体含独立 `dynamicGridParams` 子节点 |
| M3 isValidOrchestrationProgram 拆分 | v1 未拆分校验函数 | **新增 `isValidDynamicGrid` companion**：与 S4 `isValidOrchestrationProgram`（fixed_grid_gated 专用）并列；evaluator 入口 switch by `programKind` 路由 |
| M4 公式锁定 | v1 anchor / mid 公式未明确 | **锁公式**：`anchorDriftPct = abs(currentAnchor - lastBuildAnchor) / lastBuildAnchor * 100`；`mid = (periodHigh + periodLow) / 2`；写进 acceptance + golden corpus fixture |
| M5 display blacklist 显式 | v1 仅说"零内部 key 泄漏" | **显式黑名单**：`['program.dynamic_grid', 'dynamic_grid', 'anchor_on_state_change', 'high', 'low', 'mid']`（这些 enum 字面量禁止出现在 display；publicName 用中文 "高点/低点/中点"） |
| m1 emitter / parser / preflight | v1 未声明 0 行变更 | **显式声明零变更**：emitter `ORCHESTRATION_PROGRAMS` const + parser `readRequiredConst` + preflight projection 完全复用 S4；本 PR 仅扩 `CompiledOrchestrationProgram` projection 类型 |
| m2 继承 S4 修复点 | v1 模糊"克隆 S4" | **显式列继承点**：4 参 readiness 签名 / closeProgramIds 旁路 / W5 不变量算法 / cross-node ref check 全部继承（不重复实现，仅 isSupportedDynamicGrid 走相同入口） |
| m3 substrate 相容性风险 | v1 风险段无 | **风险表加项**：S0a substrate 行为变化对 S5 的回归冲击（如 ProgramLifecycleState 占位 placeholder 形态） |

## PR 拓扑

| # | PR | 涵盖层 | 依赖 PR | 哨兵 |
|---|---|---|---|---|
| 1 | feat(ai-quant): #984 Phase 5 S5 - program.dynamic_grid | quantify codegen + packages/shared compiled-runtime（rebuild evaluator + lifecycle map 写回）+ golden corpus + parity | S1 (#1053) ✅ + S4 (#1069) ✅ + **S0a (#1077) ✅** | 否（无 schema；rebuild 由硬下限 60s + readiness 拒绝刷单） |

## Acceptance（每项必须有测试覆盖）

### 类型扩展（继承 S4 union；走 S0a substrate）

- [ ] `SemanticOrchestrationProgramKind` union 追加 `'dynamic_grid'`（合并后：`'fixed_grid_gated' | 'dynamic_grid'`）
- [ ] `SemanticOrchestrationProgramRebuildPolicy` union 追加 `'anchor_on_state_change'`（合并后：`'static' | 'anchor_on_state_change'`）
- [ ] `SemanticOrchestrationNode` 在 program-only 字段 group 内追加 dynamic-only 可选字段：`anchorLookbackBars?: number` / `anchorSide?: 'high' | 'low' | 'mid'` / `anchorDriftPct?: number` / `rebuildMinIntervalSec?: number` / `dynamicGridStep?: { mode: 'pct' | 'absolute'; value: number }`（与 S4 `gridParams` 同 group；optional 不破坏 S4 fixed_grid_gated 节点）
- [ ] `CodegenSemanticOrchestrationNodePatch` 加 dynamic_grid 变体（discriminated by `key === 'program.dynamic_grid'`）
- [ ] `SemanticDynamicGridFrame` 加入 `SemanticNaturalLanguageFrame` 联合
- [ ] `CompiledOrchestrationProgram` union（`packages/shared/src/script-engine/compiled-runtime/compiled-orchestration-program.ts`）**改为 discriminated by `programKind`**（critic round 1 M2）；追加 `'dynamic_grid'` 变体：`{ programKind: 'dynamic_grid'; id; activeWhenExprId; onDeactivate; rebuildPolicy: 'anchor_on_state_change'; dynamicGridParams: { anchorLookbackBars; anchorSide; anchorDriftPct; rebuildMinIntervalSec; levelCount; step: { mode; value } }; sizing }`
- [ ] **`ProgramLifecycleState` union 追加 dynamic_grid 成员**（critic round 1 C1 — 走 S0a substrate）：
  ```ts
  // packages/shared/src/script-engine/compiled-runtime/program-lifecycle-state.ts
  export type ProgramLifecycleState =
    | { readonly kind: 'fixed_grid_gated' }                          // S0a 占位
    | {                                                               // S5 追加
        readonly kind: 'dynamic_grid'
        readonly lastBuildAnchor: number
        readonly lastBuildAt: number  // ms epoch
        readonly lastBuildLadder: readonly { id: string; level: number }[]
      }
  ```

### Registry / NL gateway / readiness

- [ ] `SemanticOrchestrationRegistryService` 注册 `program.dynamic_grid`：
  - `capabilities`: `[{ orchestration, manage, dynamic_grid_ladder }]`
  - `effects`: `[{ guard, manage, limit_ladder }]`
  - `runtimeRequirements`: `[{ runtime, provide, limit_order }, { runtime, read, account.equity }, { runtime, provide, bar_ohlcv }]`（**critic round 1 C2 修复**：复用 S0a 已注册的 `bar_ohlcv` vocab，不引入新 key）
  - `stateRequirements`: `[{ state, read_write, program_lifecycle.<id> }]`（**critic round 1 C1 修复**：复用 S0a 已注册的 `program_lifecycle` vocab）
  - `orderRequirements`: `[{ order, support, limit_order }, { order, cancel, limit_order }]`
  - `openSlots`: 缺 `anchorLookbackBars` / `anchorSide` / `step` / `levelCount` / `sizing` / `activeWhenRef` / `rebuildMinIntervalSec` 任一 → open slot（key 命名 `orchestration.program.dynamic_grid.<param_snake_case>`）
  - `executableSinceVersion`: `CURRENT_SEMANTIC_VERSION`
- [ ] `parseDynamicGrid` 在 `natural-language-gateway.service.ts` 抽取 ≥ 6 主 utterance：
  1. "在 BTCUSDT 用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，趋势上涨时启用，停用时撤单"
  2. "围绕近 30 根 K 线 mid 挂 8 档动态网格，每档 100 USDT，停用时保留挂单"
  3. "ETHUSDT 最近 100 根 K 线低点动态网格，3 档 1% 步长，趋势下跌启用，停用平仓"
  4. "近 20 根 K 线高点漂移网格 6 档每档 0.3%，鲸鱼活跃时启用"
  5. "BTC 跟随 80 根 K 线中点的网格，10 档每档 200 USDT"
  6. "动态网格围绕近 60 根 K 线 high，5 档 0.8%，drift 1% 时重建，每次至少间隔 120 秒"
  缺参数 → frame 不抽（让 readiness 走 unsupported / open slot）
- [ ] frame normalizer `dynamic_grid` case → `patch.orchestration.nodes[0]`（kind:'program', key:'program.dynamic_grid'）
- [ ] `isSupportedDynamicGrid` helper 在 `semantic-contract-readiness.service.ts` 实现 **15 重 fail-closed**：
  1. `kind === 'program'`
  2. `key === 'program.dynamic_grid'`
  3. `programKind === 'dynamic_grid'`
  4. `onDeactivate ∈ {'cancel','keep','close'}`
  5. `rebuildPolicy === 'anchor_on_state_change'`
  6. `anchorLookbackBars` 整数且 `≥ 10` 且 `≤ 1000`
  7. `anchorSide ∈ {'high','low','mid'}`
  8. `dynamicGridStep.mode ∈ {'pct','absolute'}`，`dynamicGridStep.value > 0` finite
  9. `levelCount` 整数 ∈ [2, 100]
  10. `anchorDriftPct > 0` 且 `≤ 100` finite
  11. `rebuildMinIntervalSec` 整数 `≥ 60`（**硬下限拒绝刷单**）
  12. `sizing.mode` 在合法 enum 内（`fixed_quote` / `fixed_base` / `fixed_pct`）
  13. `sizing.value > 0` finite
  14. `activeWhenRef` cross-node check（**继承 S4** critic round 2 J4 升级的 4 参数签名 `applyOrchestrationReadinessForNode(node, registry, strategyVersion, siblingNodes)`；referenced gate 必须 `status: 'locked'` 且通过自身 readiness）
  15. 双 version-gate（contract.executableSinceVersion + strategy.deployedAtSemanticVersion）

### 类型守卫（继承 S4 m1 修复模板）

- [ ] 新增 `isDynamicGridProgram(program: CompiledOrchestrationProgram): program is Extract<CompiledOrchestrationProgram, { programKind: 'dynamic_grid' }>` 类型守卫
- [ ] 新增 `isValidDynamicGrid(program)` companion validator（critic round 1 M3）：
  - `dynamicGridParams.anchorLookbackBars ≥ 10`、`anchorSide ∈ {high,low,mid}`、`anchorDriftPct > 0`、`rebuildMinIntervalSec ≥ 60`、`step.value > 0`、`levelCount ≥ 2`、`sizing.value > 0`、`activeWhenExprId` 非空字符串
  - 任一失败 → false（runtime 进入 cancelled）

### Display / canonical / IR

- [ ] `SemanticPresentationRegistryService` 新增 `program.dynamic_grid` entry：
  - `publicName`: "动态网格"
  - `aliases`: `["跟随网格", "漂移网格", "dynamic grid"]`
  - `displayRenderer` 输出形如 "围绕最近 50 根 K 线高点的 5 档动态网格，每档 0.5%，趋势上涨时启用，停用时撤单"
  - **显式黑名单**（critic round 1 M5）：display 文本 **绝不出现** 以下字面量（grep-assertable）：
    ```
    ['program.dynamic_grid', 'dynamic_grid', 'anchor_on_state_change',
     'high', 'low', 'mid']  // anchorSide enum 字面量；显示用中文 "高点/低点/中点"
    ```
    publicName fragment "动态网格" / "高点" / "低点" / "中点" / "动态" 允许（用户友好 — 与 S6 `ATR(14)` 同模式）
  - `clarificationRenderer` 覆盖 7 个 open slot
- [ ] `semantic-state-projection.service.ts` display 投影新分支
- [ ] `canonical-spec-builder.service.ts` `buildOrchestrationPrograms` 处理 dynamic_grid union 成员（spec 输出含 `dynamicGridParams` 子节点；与 fixed_grid_gated 的 `gridParams` 同级互斥）
- [ ] `canonical-spec-v2-ir-compiler.service.ts` `compileOrchestrationPrograms` 处理 dynamic_grid（IR 输出 `dynamicGridParams`，`activeWhenExprId` 解引用）

### Runtime（核心 — rebuild evaluator + lifecycle 写回）

- [ ] `packages/shared/src/script-engine/compiled-runtime/run-order-programs.ts` 在 orchestration loop 内 switch by `program.programKind`：
  - `programKind === 'fixed_grid_gated'`：**不改** — 走 S4 `isValidOrchestrationProgram` + `buildOrchestrationWorkingOrder` 现有路径；写 `programLifecycleStateNext[id] = { kind: 'fixed_grid_gated' }`
  - `programKind === 'dynamic_grid'`：**新分支**，按以下 7 路径处理：
    1. **fail-closed**：`isValidDynamicGrid(program) === false` → 进 `cancelledProgramIds`，写 `programLifecycleStateNext[id] = { kind: 'dynamic_grid', lastBuildAnchor: 0, lastBuildAt: 0, lastBuildLadder: [] }` 占位
    2. **K 线不足**（critic round 1 M1 修复）：`!ctx.bars || ctx.bars.length < dynamicGridParams.anchorLookbackBars` → NOOP；若 `programLifecycleStateIn[id]?.lastBuildLadder` 存在则保留旧 ladder（输出 workingOrder with same levels）；否则进 `cancelledProgramIds`；reason `compiled.orchestration.program.insufficient_kline_window`
    3. **anchor 计算**：取 `bars.slice(-anchorLookbackBars)`；`periodHigh = max(bar.high)`；`periodLow = min(bar.low)`；按 `anchorSide` 取 `currentAnchor`：
       - `'high'` → `currentAnchor = periodHigh`
       - `'low'` → `currentAnchor = periodLow`
       - `'mid'` → `currentAnchor = (periodHigh + periodLow) / 2`（**critic round 1 M4 锁公式**）
    4. **anchor invalid**：`!Number.isFinite(currentAnchor) || currentAnchor <= 0` → NOOP；保留旧 ladder（同路径 2 fallback 语义）；reason `compiled.orchestration.program.anchor_invalid`
    5. **active 状态判断**：`isActive = exprValues[program.activeWhenExprId] === true`
    6. **inactive 分支**：按 `onDeactivate` 三模式（与 S4 一致）：
       - `'cancel'` → 进 `cancelledProgramIds`；保留 lastBuild* state
       - `'keep'` → 输出 workingOrder with `lastBuildLadder` levels；进 `activeProgramIds`
       - `'close'` → 进 `closeProgramIds`；保留 lastBuild* state
    7. **active + rebuild 决策**（核心）：
       - 读 `prev = programLifecycleStateIn?.[program.id]`；若不存在 prev OR `prev.kind !== 'dynamic_grid'` → **首次 build**（无 throttle 检查）
       - 若有 prev：
         - `anchorDriftPctActual = Math.abs(currentAnchor - prev.lastBuildAnchor) / prev.lastBuildAnchor * 100`（critic round 1 M4 锁公式）
         - `anchorDriftPctActual < dynamicGridParams.anchorDriftPct` → **不 rebuild**：输出 workingOrder with `prev.lastBuildLadder` levels；写 `programLifecycleStateNext[id] = prev`（透传）
         - `anchorDriftPctActual ≥ anchorDriftPct` 且 `(now - prev.lastBuildAt) / 1000 < rebuildMinIntervalSec` → **限速 NOOP**：输出 workingOrder with `prev.lastBuildLadder`（保留旧 ladder）；写 `programLifecycleStateNext[id] = prev`；reason `compiled.orchestration.program.rebuild_throttled`
       - 否则 → **rebuild**：
         - `step = dynamicGridStep.mode === 'pct' ? dynamicGridStep.value / 100 : dynamicGridStep.value / currentAnchor`（absolute → 相对 currentAnchor 的比例）
         - `decay = 1 - step`
         - 生成 levels：`levels[i] = round2(currentAnchor * decay ** (i+1))` for i ∈ [0, levelCount)
         - 输出 workingOrder（`sourceRef: 'orchestration:program.dynamic_grid'`）
         - 写 `programLifecycleStateNext[id] = { kind: 'dynamic_grid', lastBuildAnchor: currentAnchor, lastBuildAt: now, lastBuildLadder: levels.map((level, i) => ({ id: `${program.id}:${i}`, level })) }`
- [ ] `now` 来源（**critic round 2 M3 修复**）：优先 `ctx.timestamp`；undefined 时使用 `bars[bars.length - 1].timestamp`（K 线确定性派生）；**任何分支均禁止 fallback Date.now()**（backtest 路径 Date.now = 墙钟会破坏 throttle 确定性 + parity）
- [ ] **深 freeze**（critic round 2 M1 修复 — S0a 已要求 S5/S6 复杂 entry 升级深 freeze）：写入 `programLifecycleStateNext[id]` 时执行 `Object.freeze(entry)` + `Object.freeze(entry.lastBuildLadder)`；mutation 必须抛 TypeError
- [ ] **cancelOrderPrograms guard 分支 lifecycle pass-through**（critic round 2 M4 修复）：当 `guardState.cancelOrderPrograms === true` 且 `programKind === 'dynamic_grid'` → 进 `cancelledProgramIds` 同时把 `programLifecycleStateIn?.[id]` 透传到 `programLifecycleStateNext[id]`（保留 lastBuildAnchor / lastBuildAt / lastBuildLadder + throttle 状态）；若无 prev → 不写 entry（key 缺席）。fixed_grid_gated 不受影响（无 throttle 状态）
- [ ] `runOrderPrograms` **不增加新参数**（programState 通道 = S0a 第 8 参 `programLifecycleStateIn` + 返回 `programLifecycleStateNext`；S5 仅消费 + 写回）

### Backtest / Live

- [ ] `backtest-strategy-adapter.service.ts` 无新调用面（共用 S0a 已注入的第 8 参 `programLifecycleStateBySymbol` Map；新 dynamic_grid 状态自动流入）
- [ ] **`signal-generator.service.ts` 维护 live state map + cleanup hook**（critic round 2 M2 修复 — issue #1081 拉进 S5 scope）：
  - 新增成员：`private readonly programLifecycleStateByStrategyInstanceId = new Map<string, Record<string, ProgramLifecycleState>>()`
  - 调用 `runOrderPrograms` 时传入 `this.programLifecycleStateByStrategyInstanceId.get(strategyInstanceId)`（不再 undefined）；返回的 `programLifecycleStateNext` 写回 map（`set(strategyInstanceId, next)`）
  - **`ctx.bars` 来源**：从 `multiLegData[primaryLeg.id]?.[execution.timeframe]?.bars`（已 K 线流入）填充
  - **cleanup hook**：grep `apps/quantify/src/modules/strategy-instances/services/strategy-instance-lifecycle*.service.ts` + `strategy-instance.service.ts` 找现有 stop/delete 事件钩子；attach `programLifecycleStateByStrategyInstanceId.delete(strategyInstanceId)` 回调；若无现有 hook，则在 `strategy-instance-lifecycle.service.ts` 的 `stop()` 末尾添加一行 `signalGenerator.cleanupProgramLifecycleState(strategyInstanceId)`（plan 在 Task 15 列出 `file:line`）
- [ ] live 真实挂单/撤单 e2e 仍留 follow-up issue（同 S4 / S7 范式）；live state map 持久化跨进程重启（如 Redis 持久化）也留 follow-up

### Golden corpus（≥ 18 cases，critic round 1 m1）

- [ ] NL pipeline 6 case（覆盖 anchorSide 三态 / step 两 mode / sizing 三 mode）
- [ ] readiness 15 fail-closed 各 1 case
- [ ] display 不污染 deploy 1 case（grep 黑名单 6 字面量全部缺席）
- [ ] canonical → IR → runtime ladder rebuild 4 case：
  - **anchor 稳定**：drift < threshold → 不 rebuild，输出 prev.lastBuildLadder
  - **anchor 漂移触发 rebuild**：drift ≥ threshold + 距上次 ≥ minInterval → 新 ladder 生成
  - **限速拒绝**：drift ≥ threshold + 距上次 < minInterval → NOOP + 保留旧 ladder + reason='rebuild_throttled'
  - **K 线不足**：bars.length < anchorLookbackBars → NOOP + 无 prev 时 cancelled / 有 prev 时保留旧 ladder
- [ ] W5 不变量 3 case（**继承 S4 W5-A/B/C 模板**，针对 dynamic_grid）：
  - W5-A: 同 bar OPEN_LONG decision + dynamic_grid onDeactivate=close → final OPEN_LONG（不被 close 抢）
  - W5-B: 同 bar NOOP + 持仓 + dynamic_grid onDeactivate=close → final CLOSE_LONG
  - W5-C: 同 bar CLOSE_LONG + dynamic_grid onDeactivate=close → final CLOSE_LONG（不重复 emit）
- [ ] onDeactivate 三模式独立断言 3 case（cancel / keep / close × 配 dynamic_grid 已 build 过 lastBuildLadder）
- [ ] 公式锁定 fixture（critic round 1 M4）：
  - mid 公式：bars[low=100..high=200] anchorSide=mid → currentAnchor=150
  - drift 公式：lastBuildAnchor=100 currentAnchor=105 → anchorDriftPctActual=5.0

### Parity

- [ ] backtest vs live signal parity 5 case：anchor 稳定 / anchor 漂移触发 rebuild / 限速拒绝 / K 线不足 / onDeactivate 三模式（live 因无 state map，rebuild / 限速断言用 first-build 行为）

### 收尾

- [ ] `dx lint` / `dx build quantify --dev` / `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/` / `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出 0
- [ ] **emitter / parser / preflight 零变更回归**（critic round 1 m1）：
  - `compiled-script-emitter.service.ts` 的 `ORCHESTRATION_PROGRAMS` const 模板 0 行 diff
  - `compiled-script-parser.service.ts` 的 `readRequiredConst('ORCHESTRATION_PROGRAMS')` 0 行 diff
  - `backtest-compiled-snapshot-preflight.service.ts:92` projection 镜像 0 行 diff
  - **仅扩展点**：`compiled-script-projection.ts` 内 `orchestrationPrograms` 字段类型从 `CompiledOrchestrationProgram[]` 自动 narrow（discriminated union 扩展）→ 添加 1 个回归 spec 断言 projection 类型扩展不破坏既有用例
- [ ] PR critic ≤3 轮 + 双 comment + `gh pr merge --squash --auto`
- [ ] PR ship 时显式创建 follow-up issue：live 真实挂单/撤单 e2e + live state map 持久化（与 S0a follow-up #1081 模板对齐）

## Files

### Create

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-dynamic-grid-golden-corpus.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-dynamic-grid-parity.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/orchestration-dynamic-grid-formulas.fixture.ts`（公式锁定 fixture，critic round 1 M4）

### Modify

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`：union 扩展 + 5 个 dynamic-only optional 字段
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`：patch union 加 dynamic_grid 变体
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`：`SemanticDynamicGridFrame`
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`：`CanonicalOrchestrationProgram` discriminated union 加 dynamic_grid 变体
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`：`IrOrchestrationProgram` 加 dynamic_grid 变体（含 `dynamicGridParams`）
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts`：注册 `program.dynamic_grid`
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts`：`parseDynamicGrid`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts`：`dynamic_grid` case
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`：`toOrchestrationNode` 透传 5 字段
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`：`isSupportedDynamicGrid` 15 fail-closed；纳入 `applyOrchestrationReadinessForNode`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts`：`program.dynamic_grid` entry + 黑名单 grep-assertable
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`：display 投影新分支
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`：`buildOrchestrationPrograms` switch dynamic_grid
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`：`compileOrchestrationPrograms` switch dynamic_grid
- `packages/shared/src/script-engine/compiled-runtime/program-lifecycle-state.ts`：union 追加 `'dynamic_grid'` 成员（含 lastBuildAnchor / lastBuildAt / lastBuildLadder）
- `packages/shared/src/script-engine/compiled-runtime/compiled-orchestration-program.ts`：union 改为 discriminated by `programKind` + 加 dynamic_grid 变体
- `packages/shared/src/script-engine/compiled-runtime/run-order-programs.ts`：orchestration loop 内 switch programKind；新增 dynamic_grid 7 路径分支 + `now` 来源 + lifecycle state 写回
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`：增加 program.dynamic_grid supported_executable
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`：解锁 program.dynamic_grid executable

### Test 扩展（既有 spec 加 case）

- `semantic-orchestration-registry.service.spec.ts` / `natural-language-gateway.service.spec.ts` / `semantic-frame-normalizer.service.spec.ts` / `semantic-presentation-registry.service.spec.ts` / `semantic-contract-readiness.service.spec.ts` / `semantic-state-projection.service.spec.ts` / `canonical-spec-builder.service.spec.ts` / `canonical-spec-v2-ir-compiler.service.spec.ts` / `run-order-programs.spec.ts` / `semantic-gateway-golden-corpus.spec.ts` / `backtest-compiled-runtime-compat.spec.ts`

### **不改动**（critic round 1 m1）

- `compiled-script-emitter.service.ts`（ORCHESTRATION_PROGRAMS const 模板 0 行）
- `compiled-script-parser.service.ts`（readRequiredConst 0 行）
- `backtest-compiled-snapshot-preflight.service.ts`（projection 镜像 0 行）

### **新加入修改**（critic round 2 M2 — live state map 拉进 S5）

- `apps/quantify/src/modules/llm-strategy-codegen/services/signal-generator.service.ts`：维护 `programLifecycleStateByStrategyInstanceId: Map`、传 prev state 给 `runOrderPrograms`、回写 next、新增 `cleanupProgramLifecycleState(id)` 方法、从 `multiLegData[primaryLeg.id][timeframe].bars` 填 `ctx.bars`
- `apps/quantify/src/modules/strategy-instances/services/strategy-instance-lifecycle.service.ts`（或等价 stop/delete hook 文件）：在 stop / delete 末尾调用 `signalGenerator.cleanupProgramLifecycleState(strategyInstanceId)`

## Tasks（19 task TDD，严格继承 S4 模板）

### Task 1: 类型 union 扩展（`semantic-state.ts` + `codegen-semantic-patch.ts` + `semantic-natural-language-frame.ts`）

- 把 `SemanticOrchestrationProgramKind` 扩为 `'fixed_grid_gated' | 'dynamic_grid'`
- 把 `SemanticOrchestrationProgramRebuildPolicy` 扩为 `'static' | 'anchor_on_state_change'`
- `SemanticOrchestrationNode` 加 5 个 dynamic-only optional 字段
- `CodegenSemanticOrchestrationNodePatch` 加 dynamic_grid 变体
- `SemanticDynamicGridFrame` 入联合
- **Verify**: `pnpm exec tsc --noEmit -p apps/quantify/tsconfig.json` 0 error；S4 fixed_grid_gated 现有 spec 不挂
- **Commit**: `refactor(ai-quant): #984 Phase 5 S5 — 扩展 program union 支持 dynamic_grid`

### Task 2: `ProgramLifecycleState` union 追加 dynamic_grid 成员（packages/shared）

- 在 `packages/shared/src/script-engine/compiled-runtime/program-lifecycle-state.ts` 追加 dynamic_grid 成员（结构见 Acceptance）
- **Verify**: `pnpm exec tsc --noEmit -p packages/shared/tsconfig.json` 0 error；S0a `run-order-programs.spec.ts` 现有 placeholder 测试不挂
- **Commit**: `feat(shared): #984 Phase 5 S5 — ProgramLifecycleState union 加 dynamic_grid 成员`

### Task 3: `CompiledOrchestrationProgram` discriminated union 改造 + dynamic_grid 变体

- `compiled-orchestration-program.ts` 改为 discriminated by `programKind`（critic round 1 M2）
- 加 dynamic_grid 变体（结构见 Acceptance）
- **MUST rename**（critic round 2 C1）：
  - `isValidOrchestrationProgram` → `isValidFixedGridGated`（标注 fixed_grid_gated 专用，destructure `gridParams`）
  - `buildOrchestrationWorkingOrder` → `buildFixedGridGatedWorkingOrder`（hardcoded `sourceRef: 'orchestration:program.fixed_grid_gated'`）
  - 同步更新所有 call site（`run-order-programs.ts` + 现有 spec）
- **新增 companions**：`isValidDynamicGrid` validator + `buildDynamicGridWorkingOrder`（`sourceRef: 'orchestration:program.dynamic_grid'`，destructure `dynamicGridParams`）
- 新增 `isDynamicGridProgram` 类型守卫
- **Verify**: tsc 0 error；S4 fixed_grid_gated 现有 spec 引用 renamed 符号后仍 0 回归
- **Commit**: `refactor(shared): #984 Phase 5 S5 — CompiledOrchestrationProgram 改为 discriminated by programKind + 拆 validator/builder`

### Task 4: Registry 注册 dynamic_grid + spec

- `semantic-orchestration-registry.service.spec.ts` 加 case：`getContractByKey('program.dynamic_grid')` 返回完整 contract；缺各 required param 各报对应 openSlot key
- 实现 entry，`runtimeRequirements` 含 `bar_ohlcv`，`stateRequirements` 含 `program_lifecycle.<id>`
- `executableSinceVersion = CURRENT_SEMANTIC_VERSION`
- **Verify**: spec 全绿
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — registry 注册 program.dynamic_grid`

### Task 5: NL gateway `parseDynamicGrid` + spec

- spec 6 utterance（见 Acceptance）；缺参 → 不抽帧
- 实现抽取规则：anchorSide 中文映射（高点/低点/中点）+ step 两 mode + sizing 三 mode + activeWhenRef + onDeactivate + 可选 anchorDriftPct / rebuildMinIntervalSec
- **Verify**: 6 utterance 全过；缺参回 frame=undefined
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — NL gateway parseDynamicGrid`

### Task 6: Frame normalizer `dynamic_grid` case + spec

- 输出 `patch.orchestration.nodes[0]` with `kind:'program', key:'program.dynamic_grid'`
- spec 4 case（包含 anchorSide 三态 × step 两 mode 部分覆盖）
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — frame normalizer dynamic_grid 分支`

### Task 7: Seed extractor / state builder 透传 + spec

- `toOrchestrationNode` 接受 5 dynamic-only 字段
- spec：透传 5 字段不丢失
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — state builder dynamic_grid 字段透传`

### Task 8: Contract readiness `isSupportedDynamicGrid` + spec

- 15 fail-closed 完整覆盖
- 复用 S4 升级的 4 参数签名 `applyOrchestrationReadinessForNode(node, registry, strategyVersion, siblingNodes)`
- spec 15 路径（每 fail-closed 1 case + 完整通过 1 case = 16 case）
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — readiness isSupportedDynamicGrid 15 fail-closed`

### Task 9: Presentation registry entry + 黑名单 grep + spec

- entry 字段完整；displayRenderer / clarificationRenderer 输出
- **黑名单 grep-assertable spec**：6 字面量（见 Acceptance）必不出现
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — presentation registry program.dynamic_grid + 黑名单`

### Task 10: Display projection 新分支 + spec

- `semantic-state-projection.service.ts` switch programKind === 'dynamic_grid'
- spec 含"frame 有但 state 缺 node → display 不渲染"反向用例
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — display projection dynamic_grid 分支`

### Task 11: Canonical spec v2 emit dynamic_grid + spec

- `CanonicalOrchestrationProgram` discriminated union 扩展（by `programKind`）
- snapshot 测试：dynamic_grid 节点序列化形态稳定
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — canonical spec emit dynamic_grid`

### Task 12: IR compile dynamic_grid + spec

- `IrOrchestrationProgram` 加 dynamic_grid 变体含 `dynamicGridParams`
- `compileOrchestrationPrograms` 解引用 `activeWhenExprId`（与 S4 同 dedupe 模式）
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — IR compile dynamic_grid`

### Task 13: `run-order-programs.ts` rebuild evaluator 7 路径 + spec（核心）

- **主循环入口（critic round 2 C1）**：进入 program 循环立即 `switch (program.programKind)`；**严禁** 在 switch 之前 destructure `gridParams` / `dynamicGridParams` 或写 sourceRef
  - `'fixed_grid_gated'` 分支 → 调用 renamed `isValidFixedGridGated` + `buildFixedGridGatedWorkingOrder`
  - `'dynamic_grid'` 分支 → 调用新建 `isValidDynamicGrid` + `buildDynamicGridWorkingOrder` + 7 NOOP/rebuild 路径
- 实现 7 NOOP/rebuild/keep 路径（见 Acceptance Runtime 章节细节）
- **深 freeze 写入（critic round 2 M1）**：`Object.freeze(entry)` + `Object.freeze(entry.lastBuildLadder)`
- **ctx.timestamp 确定性（critic round 2 M3）**：`now = ctx.timestamp ?? bars[bars.length - 1].timestamp`；禁止 Date.now()
- **cancelOrderPrograms guard pass-through（critic round 2 M4）**：`guardState.cancelOrderPrograms === true` + dynamic_grid → 入 cancelledProgramIds 同时透传 prev lifecycle state
- 公式锁定 fixture 引入：`anchorDriftPctActual = abs(curr - prev) / prev * 100`；`mid = (high + low) / 2`
- spec 必含：
  - anchor 稳定 → keep prev.lastBuildLadder
  - anchor 漂移 ≥ driftPct + 距上次 ≥ minInterval → rebuild
  - 限速拒绝（drift ≥ + 距上次 < minInterval）→ NOOP + 保留旧 ladder + reason
  - K 线不足（无 prev）→ cancelled
  - K 线不足（有 prev）→ 保留旧 ladder
  - anchor NaN → 同 K 线不足语义
  - activeWhen=false × onDeactivate 三模式
  - 首次 build（无 prev）→ 直接 rebuild 不 throttle
  - mid / high / low 三 anchorSide 公式断言
  - **主循环入口 switch 顺序断言**（critic round 2 C1）：构造 dynamic_grid program **不带** `gridParams` 字段 → 不应进入 fixed_grid_gated destructure 路径而被静默 cancelled；显式断言走入 dynamic_grid 分支
  - **深 freeze mutation throws**（critic round 2 M1）：`expect(() => entry.lastBuildAt = 0).toThrow()`；`expect(() => entry.lastBuildLadder.push(...)).toThrow()`
  - **ctx.timestamp 确定性**（critic round 2 M3）：fixture 不 stub Date.now；ctx.timestamp undefined 时断言 `lastBuildAt === bars[bars.length - 1].timestamp`
  - **cancelOrderPrograms guard pass-through**（critic round 2 M4）：guardState.cancelOrderPrograms=true + 有 prev dynamic_grid state → 进 cancelledProgramIds + `programLifecycleStateNext[id]` 等于 prev（深相等）；无 prev → key 缺席
- programLifecycleStateNext 写入 `lastBuildAnchor` / `lastBuildAt` / `lastBuildLadder`
- **Verify**: S0a `run-order-programs.spec.ts` 现有 case + S5 新 case 全绿；S4 fixed_grid_gated 0 回归
- **Commit**: `feat(shared): #984 Phase 5 S5 — runOrderPrograms dynamic_grid rebuild evaluator`

### Task 14: Backtest 接入回归 spec

- `backtest-compiled-runtime-compat.spec.ts` 加 dynamic_grid 4 case（rebuild 触发 / 限速 / K 线不足 / activeWhen=false × close）
- 验证 `programLifecycleStateBySymbol` Map 跨 K 线持续含 dynamic_grid state
- **Commit**: `test(ai-quant): #984 Phase 5 S5 — backtest dynamic_grid 接入回归`

### Task 15: Live signal state map + cleanup hook + 接入回归 spec（critic round 2 M2 — 拉进 S5 scope）

- **实现 live programLifecycleState 持久化**（in-memory，跨进程持久化留 follow-up）：
  - `signal-generator.service.ts` 新增 `programLifecycleStateByStrategyInstanceId: Map<string, Record<string, ProgramLifecycleState>>`
  - 每次 `runOrderPrograms` 调用：`const prev = map.get(strategyInstanceId); const result = runOrderPrograms(..., prev); map.set(strategyInstanceId, result.programLifecycleStateNext)`
  - `ctx.bars` 来源：`multiLegData[primaryLeg.id]?.[execution.timeframe]?.bars`（已 K 线流入；需确认字段路径与 backtest-strategy-adapter 一致）
- **Cleanup hook**：
  - 先 `grep -rn "stop\|delete\|destroy" apps/quantify/src/modules/strategy-instances/services/` 找 lifecycle 钩子
  - 优先 attach 到 `strategy-instance-lifecycle.service.ts` 的 `stop(strategyInstanceId)`；调用 `signalGenerator.cleanupProgramLifecycleState(strategyInstanceId)`
  - 若无现有 hook → 在 `strategy-instance-lifecycle.service.ts` 添加最小 callback；plan PR 中显式列出 `<file>:<line>` 修改点
  - 新增 `signal-generator.service.ts` 的 `cleanupProgramLifecycleState(id: string): void { this.programLifecycleStateByStrategyInstanceId.delete(id) }` 方法
- **spec**：
  - 跨 K 线连续调用：anchor 漂移触发 rebuild → 第二根 K 线 throttle NOOP（验证 state 跨调用持久化）
  - cleanup hook：调用 `cleanupProgramLifecycleState(id)` 后 map.has(id) === false；下次 runOrderPrograms 视为首次 build
  - dynamic_grid 4 case 与 Task 14 对称（rebuild / 限速 / K 线不足 / activeWhen=false × close）
- **Commit**: `feat(ai-quant): #984 Phase 5 S5 — live signal state map + cleanup hook + dynamic_grid 接入回归`

### Task 16: Backtest vs live signal parity test

- 5 cases：anchor 稳定 / anchor 漂移触发 rebuild / 限速拒绝 / K 线不足 / onDeactivate 三模式
- 注意 live 无 state 持久化的差异（在 spec 中显式标注）
- **Commit**: `test(ai-quant): #984 Phase 5 S5 — backtest vs live parity 5 case`

### Task 17: Golden corpus & atom-coverage 标记 dynamic_grid executable

- `orchestration-dynamic-grid-golden-corpus.spec.ts` 18+ cases（NL 6 + readiness 15 + display 1 + runtime 4 + W5 3 + onDeactivate 3 + 公式 fixture）
- 扩展 `atom-coverage-golden-cases.ts` 加 dynamic_grid path
- 解锁 `atom-coverage-golden-corpus.spec.ts` dynamic_grid executable
- **Commit**: `test(ai-quant): #984 Phase 5 S5 — golden corpus 18+ + atom-coverage 解锁`

### Task 18: 全面回归

- 并行：`dx lint &` + `dx build quantify --dev &` + `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/ &`
- contracts diff 强制 0
- emitter snapshot 必 0 变更（critic round 1 m1）
- S4 fixed_grid_gated 现有 golden corpus + parity + signal-generator 全套 0 回归
- S0a `run-order-programs.spec.ts` 现有 placeholder + freeze 测试 0 回归
- 失败逐一修复
- **Commit**: `chore(ai-quant): #984 Phase 5 S5 — 修复回归`

### Task 19: PR push + critic + ship

- Push `feat/984-phase5-s5-dynamic-grid`
- `gh pr create --base main --title "feat(ai-quant): #984 Phase 5 S5 - program.dynamic_grid"`
- 派 `oh-my-claudecode:critic` 审 PR diff（≤ 3 轮，第 3 轮仍有 Critical / Major escalate 回 brainstorming）
- 双 comment（review-report + fix-report）
- `gh pr merge <num> --squash --auto`
- 等 auto-merge 成功
- **创建 follow-up issue**（critic round 1 m4 — 模板对齐 S0a follow-up #1081）：
  - title: `feat(ai-quant): live programLifecycleState 持久化 + dynamic_grid 真实挂单/撤单 e2e`
  - body 含：依赖 PR、目标行为、验收标准（live signal-generator 维护 state map、cleanup hook、live e2e 跨 K 线 rebuild 真实下单）

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| rebuild 频率失控刷单 | runtime 硬下限 60s + readiness 拒绝 < 60 用户参数 + e2e 含 anchor 抖动场景断言 rebuild 计数 |
| anchor 计算 NaN 静默 NOOP 误导用户 | runtime 标记 reason `compiled.orchestration.program.anchor_invalid`；golden corpus 显式断言；保留旧 ladder（有 prev 时） |
| K 线窗口数据缺失 | runtime fail-closed `insufficient_kline_window` + readiness `runtime.provide.bar_ohlcv` 必填 |
| anchor / mid / drift 公式漂移 | 公式 fixture（`orchestration-dynamic-grid-formulas.fixture.ts`）锁定数值断言 |
| **S0a substrate 行为变化对 S5 回归冲击**（critic round 1 m3） | S5 spec 必须同跑 S0a `run-order-programs.spec.ts` 现有 placeholder + freeze 测试；S0a `programLifecycleStateNext` 顶层 Object.freeze 语义不破坏 |
| 与 S4 / S6 共享 substrate 路径回归 | S4 fixed_grid_gated 现有 golden corpus + parity + signal-generator-orchestration-program 全套通过；S6 rebase 后再次回归 |
| 回滚 | 单 PR squash revert；S4 / S0a path 不受影响（dynamic_grid 是 union 追加；ProgramLifecycleState dynamic_grid 成员单独删除） |

## 与 S6 的协调

- **S5 与 S6 worktree 并行起，但 S5 必先 merge**
- S6 在 S5 merge 后必须 rebase onto main，解决 union 追加冲突
- 共改文件冲突点（S6 rebase 时按字母顺序追加自身成员）：
  - `semantic-state.ts`（program union）
  - `codegen-semantic-patch.ts`
  - `semantic-natural-language-frame.ts`
  - `canonical-strategy-spec-v2.ts`
  - `canonical-strategy-ir.ts`
  - `semantic-orchestration-registry.service.ts`（registry 新 entry）
  - `natural-language-gateway.service.ts`（新 parser）
  - `semantic-frame-normalizer.service.ts`（新 case）
  - `semantic-seed-state-builder.service.ts`
  - `semantic-contract-readiness.service.ts`（新 isSupported helper）
  - `semantic-presentation-registry.service.ts`（新 entry）
  - `semantic-state-projection.service.ts`
  - `canonical-spec-builder.service.ts`
  - `canonical-spec-v2-ir-compiler.service.ts`
  - `compiled-orchestration-program.ts`（discriminated union 追加成员）
  - `program-lifecycle-state.ts`（**S6 在 S5 dynamic_grid 后追加 adaptive_volatility_grid**）
  - `run-order-programs.ts`（switch 新 case）
  - `__tests__/fixtures/atom-coverage-golden-cases.ts`
  - `__tests__/atom-coverage-golden-corpus.spec.ts`
- rebase 完成后必跑回归：S4 + S5 + S6 三 program key 的 golden corpus 全部 0 回归

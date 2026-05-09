# AI Quant Phase 5 S4 — program substrate + fixed_grid_gated Implementation Plan

**Goal:** 落地第三个 supported orchestration capability：`program.fixed_grid_gated`。建立 program substrate（kind:'program' contract / IR / runtime lifecycle），关闭 Phase 5 验收 bullet #5(orderProgram 子集) #7 #8(fixed)。

**Track:** C
**Total PRs:** 1（S4 是单 slice 闭环；S5/S6/S12 后续基于本 PR 的 program substrate）
**Issue:** #984
**Roadmap:** docs/superpowers/specs/2026-05-09-ai-quant-phase-5-orchestration-roadmap.md § S4
**Pattern reference:** S1 (PR #1053) / S7 (PR #1057) — 同 substrate + capability 闭环范式

## PR 拓扑

| # | PR | 涵盖层 | 依赖 PR | 哨兵 |
|---|---|---|---|---|
| 1 | feat(ai-quant): #984 Phase 5 S4 - program substrate + fixed_grid_gated | quantify codegen + packages/shared compiled-runtime + backtest order lifecycle + live signal | S1 (#1053) ✅ + S7 (#1057) ✅ | 否（无 schema；活动 program 由 fail-closed 不输出哨兵；observe-style 不存在 — gated grid 默认必须有 gate） |

## Acceptance（每项必须有测试覆盖）

- [ ] `SemanticOrchestrationContract` 复用 S1 substrate；新增 `SemanticOrchestrationProgramKind = 'fixed_grid_gated'`、`SemanticOrchestrationProgramOnDeactivate = 'cancel' | 'keep' | 'close'`、`SemanticOrchestrationProgramRebuildPolicy = 'static'`
- [ ] `SemanticOrchestrationNode` 在 portfolio 字段后扩展 program-only optional：`programKind?` / `activeWhenRef?`(gate id 引用) / `onDeactivate?` / `rebuildPolicy?` / `gridParams?: { anchorPrice, levelCount, stepPct, lowerBound?, upperBound? }` / `sizing?: { mode, value }`
- [ ] `SemanticOrchestrationRegistryService` 注册 `program.fixed_grid_gated`，effects=`[{guard,manage,limit_ladder}]`，runtimeRequirements=`[runtime/provide/limit_order, runtime/read/account.equity]`，stateRequirements=`[state/read_write/program_lifecycle.<id>]`，orderRequirements=`[order/support/limit_order, order/cancel/limit_order]`，executableSinceVersion=CURRENT_SEMANTIC_VERSION
- [ ] NL gateway `parseFixedGridGated` 抽取"BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用，停用时撤单"等显式表达（含 anchor / range / count / step / activeWhen ref / onDeactivate）
- [ ] frame normalizer 归一化 `fixed_grid_gated` frame → `patch.orchestration.nodes[]`(kind:'program', key:'program.fixed_grid_gated')
- [ ] `SemanticContractReadinessService.normalizePhase0Orchestration` 新增 `isSupportedFixedGridGated` helper，**14 重 fail-closed**（critic round 1 M4 修复）：
  1. kind === 'program'
  2. key === 'program.fixed_grid_gated'
  3. programKind === 'fixed_grid_gated'
  4. onDeactivate ∈ {'cancel','keep','close'}
  5. rebuildPolicy === 'static'
  6. gridParams.anchorPrice > 0 finite
  7. gridParams.levelCount 正整数 ≥2 且 ≤100（防超大 ladder）
  8. gridParams.stepPct > 0 且 ≤100 finite
  9. gridParams.lowerBound (如有) > 0 finite，且 < upperBound
  10. gridParams.upperBound (如有) > 0 finite
  11. sizing.mode 在合法 enum 内（fixed_quote / fixed_base / fixed_pct）
  12. sizing.value > 0 finite
  13. activeWhenRef 必须为非空字符串，且引用同 state.orchestration.nodes 中存在 kind:'gate' && status:'locked' && key:'gate.regime' 的节点 id（**critic round 2 J4 修复：cross-node ref check 需要 readiness 签名升级**）
  14. 双 version-gate fail-closed：contract.executableSinceVersion 缺失 / strategy.deployedAtSemanticVersion === null → phase0 unsupported

- [ ] **Readiness 签名升级（critic round 2 J4 修复）**：
  - `applyOrchestrationReadinessForNode(node, registry, strategyVersion)` 升级为 `applyOrchestrationReadinessForNode(node, registry, strategyVersion, siblingNodes: readonly SemanticOrchestrationNode[])`
  - 同步把 `isSupportedRegimeGate` / `isSupportedPortfolioDrawdownBlock` 接受相同的 4 参数签名（保持一致风格；前两者目前不使用 siblingNodes，参数加上不读取，未来扩展无需再改签名）
  - `isSupportedFixedGridGated(node, registry, strategyVersion, siblingNodes)` 通过 siblingNodes 实现 cross-node activeWhenRef 引用检查
  - `normalizePhase0Orchestration` 主循环入口处把 `state.orchestration.nodes` 作为 siblingNodes 传入 helper
  - **附加 fail-closed 语义**（critic round 2 K4 修复）：referenced gate node 必须 status:'locked' AND 该 gate 通过 readiness 自身的 supported check（不能引用一个 status 锁但 readiness fail 的 gate）— 实现：在主循环里先解析所有 gates 的 supported 集合，再做 program 的 cross-node check
- [ ] **类型守卫 `isProgramNode(node: SemanticOrchestrationNode): node is SemanticOrchestrationNodeProgram`**（critic round 1 M3 修复）：所有读取 program-only 字段（programKind / activeWhenRef / onDeactivate / rebuildPolicy / gridParams / sizing）处必须先 narrow，避免 union 膨胀引发 narrowing 蔓延（与 S7 portfolioRisk 同模式 — 但抽出可复用 helper）
- [ ] `SemanticPresentationRegistryService` 注册 `program.fixed_grid_gated` entry，零内部 key 泄漏（不含 `program.fixed_grid_gated` / `orchestration.` / `cancel|keep|close` / `fixed_grid_gated` 等内部 key；**注意：display 可以露出"趋势/状态过滤"等 gate 的 publicName**——critic round 1 m1 修复——但不能露出 `gate.regime` / gate id 字面量）
- [ ] `CanonicalSpecBuilderService` 在 canonical spec v2 输出 `orchestration.programs[]`；与 gates / portfolioRisks 三者全空时整字段省略；任一非空时输出 orchestration 对象
- [ ] `CanonicalSpecV2IrCompilerService` 编译 `IR.orchestrationPrograms[]`（携带 activeWhenExprId 解引用 gate 的 exprId、onDeactivate 行为、grid metadata；纯 metadata + 解引用，无新表达式编译）
- [ ] `packages/shared/.../run-order-programs.ts` 在 `runOrderPrograms` **增加第 7 参数**（critic round 1 C1 修复 — 第 6 参数已被 `_executionModel?` 占用）`orchestrationPrograms?: readonly CompiledOrchestrationProgram[]`：
  - `CompiledOrchestrationProgram` 类型新建于 `packages/shared/.../compiled-runtime/compiled-orchestration-program.ts`，与 `CompiledOrchestrationGate` / `CompiledOrchestrationPortfolioRisk` 同目录
  - `activeWhen=true`（exprValues[activeWhenExprId]===true）→ 输出 workingOrders（grid ladder 由 anchor/step/levelCount 在 levels 数组生成）
  - `activeWhen=false + onDeactivate='cancel'` → 该 program 进入 `cancelledProgramIds`，不输出 workingOrders
  - `activeWhen=false + onDeactivate='keep'` → 仍输出 workingOrders（保单子），不进 cancelledProgramIds
  - `activeWhen=false + onDeactivate='close'` → 不输出 workingOrders **且不进入 cancelledProgramIds**（独立旁路），通过新增 `closeProgramIds` 数组通知上层
  - 缺 activeWhenExprId 或 grid params 不全 → fail-closed 进 cancelledProgramIds（与 cancel 等价）
  - `CompiledOrderState` 新增 `closeProgramIds: readonly string[]` 字段（与 cancelledProgramIds 语义独立）
- [ ] `runDecisionPrograms` 不需要新增参数（program lifecycle 走 order programs 通道，与 decision 决策正交）
- [ ] **CLOSE_* 合成路径**（critic round 1 M2 锁死）：在 `backtest-strategy-adapter.service.ts` 的 onBar 中：
  1. 先 `runDecisionPrograms` 拿到 decision
  2. 再 `runOrderPrograms` 拿到 orderState（含 closeProgramIds）
  3. 合并算法伪码：
     ```ts
     // 不覆盖 decision，仅当不冲突时补 close 伴生信号
     if (orderState.closeProgramIds.length > 0
         && decision.action !== 'CLOSE_LONG' && decision.action !== 'CLOSE_SHORT'
         && decision.action !== 'REDUCE_LONG' && decision.action !== 'REDUCE_SHORT'
         && decision.action !== 'NOOP') {
       // decision 是 OPEN_* 或其他 entry → 不抢，丢弃 closeProgramIds（不挂伴生 close）
       // entry 优先；本根 K 线不 emit close（critic round 2 J3 — closeProgramIds 不绕道 manifest.meta）
     }
     if (orderState.closeProgramIds.length > 0
         && decision.action === 'NOOP'
         && currentPositionQty !== 0) {
       // decision NOOP 且持仓 → 把 closeProgramIds 翻译成 CLOSE_LONG/SHORT
       decision = synthesizeCloseDecision(currentPositionQty, closeProgramIds)
     }
     ```
  4. **绝不取代 OPEN_***（W5 不变量保护）；entry 决策永远优先；close-position 仅作为"NOOP+持仓"窗口的伴生信号
  5. **closeProgramIds 流转单一路径**（critic round 2 J3 修复）：onBar 闭包内合成 close decision 后通过 `buildCompiledManifest` 入参 (decision, orderState, ...) 传入；buildCompiledManifest 仅扩展 manifest.decision 字段；**closeProgramIds 不污染 manifest**（不进 manifest.meta，不进 manifest.orderState 顶层）
- [ ] **`synthesizeCloseDecision` helper（critic round 2 J1 修复）**：新建 private helper 在 `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts` 内部（live 侧需要时同 import 路径暴露）。签名与三态映射：
  - `qty > 0` (long position) → `{ action: 'CLOSE_LONG', reason: 'compiled.orchestration.program.close_position', meta: { closeProgramIds } }`
  - `qty < 0` (short position) → `{ action: 'CLOSE_SHORT', ... }`
  - `qty === 0` → `{ action: 'NOOP', reason: 'compiled.orchestration.program.no_position_to_close' }`
- [ ] backtest-strategy-adapter 接入：调用 `runOrderPrograms(_ctx, programs, exprValues, guardState, orderProgramOrder, executionModel, ir.orchestrationPrograms ?? [])`（第 7 参数）；后接 closeProgramIds 合成（上方算法）；engine 的 limit-order matching 消费 levels
- [ ] live signal fast path 同步接入：与 backtest 共用同 import path `@ai/shared/script-engine/compiled-runtime/run-order-programs`；live 侧 limit-order 挂单/撤单走现有 strategy-signals 已有的 working order 协议；live closeProgramIds 真实启用留 follow-up issue（同 S7 模式）
- [ ] golden corpus 18+ cases：5 段（NL pipeline / readiness 14 fail-closed / display 不污染 / canonical→IR→runtime program lifecycle / W5 close 不抢主决策）+ 三种 onDeactivate 行为各自独立断言
- [ ] **W5 不变量 golden corpus case 形式化**（critic round 1 W6）：
  - case W5-A: 同 bar entry rule 输出 OPEN_LONG + gate 失活 onDeactivate=close → final decision === OPEN_LONG（绝不被改写为 CLOSE_LONG）；orderState.closeProgramIds 含该 program id（**critic round 3 J3-residual 修复**：信号在 onBar 闭包内被消费但不改写 decision；不污染 manifest；下一根若仍 NOOP+持仓再合成 CLOSE）
  - case W5-B: 同 bar 无 entry decision (NOOP) + 持仓 long + gate 失活 onDeactivate=close → final decision === CLOSE_LONG（NOOP+持仓时合成）
  - case W5-C: 同 bar exit decision (CLOSE_LONG) + gate 失活 onDeactivate=close → final decision === CLOSE_LONG（不重复 emit；不冲突）
- [ ] backtest vs live signal parity 5 cases（含 onDeactivate 三模式 + activeWhen=true 正常挂单 + W5 close 不影响主决策）
- [ ] `dx lint` / `dx build quantify --dev` / TS 0 errors / `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出 0
- [ ] **Paper trading drill 边界澄清**（critic round 1 W7）：
  - **Backtest 不需要 paper trading**（backtest 是模拟环境，limit-order matching 与 grid lifecycle 由 backtest engine 内部模拟；本 PR backtest 侧完整闭环）
  - **Live 侧才需要 paper trading**（真实交易所挂单/撤单）；live 侧本 PR 仅做 read-only 接入（runOrderPrograms 调用 + closeProgramIds 收集），**不直接挂单**；live 真实启用挂单/撤单 e2e 留 follow-up issue（与 S7 live drawdownPct 同范式 — PR ship 时创建并显式列编号）
- [ ] PR critic ≤3 轮 + 双 comment + `gh pr merge --squash --auto`

## Files

### Create
- `packages/shared/src/script-engine/compiled-runtime/compiled-orchestration-program.ts`（critic round 1 W3 — `CompiledOrchestrationProgram` 类型独立文件，与 evaluate-orchestration-gates / evaluate-orchestration-portfolio-risks 同目录）
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-fixed-grid-gated-golden-corpus.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-fixed-grid-gated-parity.spec.ts`

### Modify
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`：增加 program kind/onDeactivate/rebuildPolicy 类型；`SemanticOrchestrationNode` 扩展 program optional 字段
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`：扩展 `CodegenSemanticOrchestrationNodePatch` 联合类型加入 program 变体
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`：新增 `SemanticFixedGridGatedFrame`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts`：注册 `program.fixed_grid_gated`
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts`：增 `parseFixedGridGated`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts`：增 `fixed_grid_gated` case
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`：`toOrchestrationNode` 接受 program 字段
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`：增 `isSupportedFixedGridGated` 14 fail-closed + 升级 `applyOrchestrationReadinessForNode` 接受 siblingNodes 第 4 参数；同步 isSupportedRegimeGate / isSupportedPortfolioDrawdownBlock 签名
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts`：增 program.fixed_grid_gated entry
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`：display 投影 program
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`：增加 `CanonicalOrchestrationProgram` + `spec.orchestration.programs?`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`：`buildOrchestrationPrograms(state)`；orchestration 对象在三者任一非空时输出
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`：增加 `IrOrchestrationProgram` + `IR.orchestrationPrograms?`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`：`compileOrchestrationPrograms(spec)`，解引用 activeWhenRef → gate exprId
- `packages/shared/src/script-engine/compiled-runtime/run-order-programs.ts`：`runOrderPrograms` 加**第 7 参数** `orchestrationPrograms?`（critic round 2 J2 — 保留 `_executionModel?` 第 6 参数不动）；`CompiledOrderState` 加 `closeProgramIds: readonly string[]`
- `packages/shared/src/script-engine/compiled-runtime/run-order-programs.spec.ts`：扩展（新文件 if not exists）
- `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`：接入 orchestrationPrograms + closeProgramIds 转 CLOSE_LONG/SHORT
- `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`：同步接入
- `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-emitter.service.ts`（critic round 1 C2）：emit `ORCHESTRATION_PROGRAMS` 常量；FIXED_STRATEGY_WRAPPER 模板增 `'      ORCHESTRATION_PROGRAMS,'`（与 ORCHESTRATION_GATES / ORCHESTRATION_PORTFOLIO_RISKS 同位置）
- `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-parser.service.ts`（critic round 1 C2）：`readRequiredConst('ORCHESTRATION_PROGRAMS')` 解析 IR.orchestrationPrograms
- `apps/quantify/src/modules/llm-strategy-codegen/types/compiled-script-projection.ts`（如有）：增加 `orchestrationPrograms?: readonly CompiledOrchestrationProgram[]` 字段
- `apps/quantify/src/modules/backtesting/services/backtest-compiled-snapshot-preflight.service.ts:92`（critic round 1 C2）：projection 镜像 orderProgramOrder 一致姿势 `orchestrationPrograms: this.projectByOrder(astSnapshot.orchestrationPrograms ?? [], topology.orchestrationProgramOrder ?? [])`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`：增加 program.fixed_grid_gated supported_executable
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`：解锁 program.fixed_grid_gated executable

## Tasks (sub-agent dispatch friendly)

执行采 S1/S7 已验证的分波模式：

### Wave 1（types — 单 task 由本会话直接做）
- T1: types/semantic-state.ts + codegen-semantic-patch.ts + semantic-natural-language-frame.ts 扩展

### Wave 2（4 parallel sub-agents）
- T2 registry: semantic-orchestration-registry.service.ts 注册 program.fixed_grid_gated + 14 fail-closed validate
- T3 NL gateway: parseFixedGridGated
- T6 presentation: program.fixed_grid_gated entry
- T10 evaluator base: 不需要单独 evaluator（program lifecycle 走 runOrderPrograms 现有路径），改为在 run-order-programs.ts 内嵌 program lifecycle 状态机

### Wave 3（3 parallel after Wave 2）
- T4 frame normalizer: fixed_grid_gated case
- T5 state builder: program 字段透传
- T7 readiness lift: isSupportedFixedGridGated

### Wave 4（2 parallel）
- T8 display projection: program 渲染分支
- T11 run-order-programs lifecycle: activeWhen + onDeactivate(cancel/keep/close) + closeProgramIds + grid levels（**第 7 参数**）

### Wave 4.5（critic round 1 C2 — emitter/parser/preflight, sequential after Wave 4）
- T11.5 compiled-script-emitter ORCHESTRATION_PROGRAMS const + wrapper 第 7 参数
- T11.6 compiled-script-parser readRequiredConst('ORCHESTRATION_PROGRAMS')
- T11.7 backtest-compiled-snapshot-preflight projection 镜像 + projection 类型扩展

### Wave 5（sequential）
- T9 canonical spec: buildOrchestrationPrograms + orchestration 对象 fallthrough
- T10 IR compile: compileOrchestrationPrograms + 解引用 gate exprId → IR 阶段 inline `activeWhenExprId: string`（critic round 1 W4 — 不留 ref + runtime 再查的延迟解析；IR 阶段固化 exprId 字面量）

### Wave 6（2 parallel）
- T12 backtest接入: 第 7 参数 orchestrationPrograms 注入 + 不取代 OPEN_* 的 closeProgramIds 旁路合成（详见 Acceptance 算法伪码）
- T13 live signal接入: 同上 + 共用同 import + live closeProgramIds 真实启用留 follow-up issue（同 S7 模式）

### Wave 7（2 parallel）
- T14 parity spec: 5 cases (gate active normal挂单 / gate inactive cancel / gate inactive keep / gate inactive close / W5)
- T15 golden corpus: 18+ cases 5 段（含 W5 不变量 A/B/C 三 case）

### Wave 8（regression + ship）
- T16 全回归：lint + 4 模块 jest + api-contracts zero diff
- T17 push + critic + 双 comment + auto-merge

## Risk & Rollback

- **最大风险：order lifecycle 真挂限价单**。S4 ship 前必须 paper trading drill；live 侧 enforce 真实挂单留 follow-up issue（与 S7 live drawdown 同范式：本 PR 提供 backtest 闭环；live 侧 limit-order 提交/撤单 e2e 留后续 PR）
- **回滚边界**：单 PR；revert 即恢复（registry / contract / runtime 全 additive，向后兼容）
- **fail-closed 强约束**：缺 activeWhenRef / 缺 grid params / activeWhenRef 引用的 gate 不存在 → 不挂单（cancelled）
- **W5 不变量**：onDeactivate='close' 触发的 close-position 信号不抢主决策的 entry/exit/risk 优先级；通过新 closeProgramIds 数组旁路标记，由上层 backtest/live 决定如何转 CLOSE_*

## Acceptance Mapping (issue #984)

| Bullet | 状态 |
|---|---|
| #5(orderProgram) orchestration.gates 控制 orderProgram 启停 | **closed**（fixed_grid_gated 通过 activeWhenRef 引用 gate.regime；inactive 触发 onDeactivate）|
| #7 趋势/状态门控网格 activeWhen / onDeactivate cancel/keep/close 行为明确 | **closed** |
| #8(fixed) 固定区间网格声明 activeWhen / onDeactivate / rebuildPolicy / orderRequirements | **closed**（rebuildPolicy:'static'；dynamic + adaptive 由 S5 + S6 闭合） |

其余 #5 子级 (strategy/subStrategy) 由 S10 闭合；#8 dynamic/adaptive 由 S5/S6。

# AI Quant Phase 5 Orchestration Multi-PR Implementation Plan

**Goal:** 把 Phase 5 全部 13 条验收 bullet 拆成 12 个独立闭环 PR，按依赖图分 7 轮交付，每 PR 用 git-pr-ship 收口。

**Track:** C（Step 0 命中 D1/D2/D5/D6/D7，D2 硬升级）

**Total PRs:** 12

**Issue:** #984

**Roadmap spec:** `docs/superpowers/specs/2026-05-09-ai-quant-phase-5-orchestration-roadmap.md`

**本会话范围：** PR1（S1 — gate.regime + 编排 substrate）完整闭环并 merge 到 main。S2-S12 plan 在本文档落定，不在本会话执行。

**Plan amendment（rebase 于 origin/main d7d4cebd 后）：** PR #1044（issue #1043）已合入 main，引入 atom 翻牌基建：
1. `VersionedAtomContract { executableSinceVersion?: string }` 与 `isAtomExecutableForStrategy(contract, strategy)`（路径 `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/version-gate/version-gate.ts`），双 fail-closed
2. `LlmStrategyInstance.deployedAtSemanticVersion String?` 字段 + `markDeployedWithSemanticVersion` writer（在 publication gate 同事务写入）
3. 4 个新 ErrorCode + DomainException：`INTERNAL_KEY_LEAK_DETECTED` / `SEMANTIC_PRESENTATION_TOKEN_NOT_FOUND` / `ATOM_VERSION_GATE_VALIDATION_FAILED` / `UTTERANCE_GOLDEN_CORPUS_PARSE_ERROR`
4. `nl-gateway/` 模块骨架已装入 `LlmStrategyCodegenModule`

S1 必须遵守：
- `SemanticOrchestrationContract` 增加 `executableSinceVersion?: string` 字段（已在 Task 1 实现追加）
- `gate.regime` registry entry 必须声明 `executableSinceVersion: CURRENT_SEMANTIC_VERSION`（Task 3 实现时设为合并周）
- Task 7 readiness 在原 phase0 unsupported 之上叠加 version-gate：旧策略（`deployedAtSemanticVersion === null`）即便有 supported gate.regime 节点也走 phase0 unsupported（双 fail-closed）
- 新增 ErrorCode 抛出请使用既有 DomainException 子类，不再裸 throw Error
- nl-gateway 子模块若需扩展新增 frame 抽取（Task 4），考虑放到 `nl-gateway/regime-gate/` 子目录与 version-gate 并列；本 PR 选择最小侵入：parseRegimeGate 仍合并到 `services/natural-language-gateway.service.ts`，不新增子目录

---

## PR 拓扑（按硬依赖拓扑序）

| # | Slice | PR 标题 | 关 bullet | 依赖 PR | 何时 merge | 与 A/B/C 关系 |
|---|---|---|---|---|---|---|
| 1 | S1 | feat(ai-quant): #984 Phase 5 S1 - gate.regime + 编排 substrate | #5(entry 子集)、#6 | 无 | 立即 merge | 完全并行 |
| 2 | S4 | feat(ai-quant): #984 Phase 5 S4 - program substrate + fixed_grid_gated | #5(orderProgram 子集)、#7、#8(fixed) | S1 | 等 S5/S6 完再 merge + paper trading drill | 与 A/B/C 文件冲突面小 |
| 3 | S5 | feat(ai-quant): #984 Phase 5 S5 - program.dynamic_grid | #8(dynamic) | S4 | S4 之后 merge + paper trading drill | 不冲突 |
| 4 | S6 | feat(ai-quant): #984 Phase 5 S6 - program.adaptive_volatility_grid | #8(adaptive) | S4 | S4 之后 merge + paper trading drill | 不冲突 |
| 5 | S7 | feat(ai-quant): #984 Phase 5 S7 - portfolioRisk.drawdown_block | #10(portfolio) | S1 | S8 前 merge + observe 一周后切 enforce | 不冲突 |
| 6 | S2 | feat(ai-quant): #984 Phase 5 S2 - scope.symbol substrate + 多标的绑定 | #1、#2 | S1，A/B/C 收尾 | 必须 merge | **必须等 A/B/C** |
| 7 | S3 | feat(ai-quant): #984 Phase 5 S3 - scope.timeframe 升级 | #1、#3 | S2 | S2 之后 | 间接受 A/B/C 影响 |
| 8 | S9 | feat(ai-quant): #984 Phase 5 S9 - scope.dataSource | #1、#4 | S2 | S12 前 merge | 间接 |
| 9 | S10 | feat(ai-quant): #984 Phase 5 S10 - scope.subStrategy + 切换 gate(strategy/subStrategy 子集) | #1、#9、#5(strategy/subStrategy 子集) | S2 | S8 前 merge | 间接 |
| 10 | S11 | feat(ai-quant): #984 Phase 5 S11 - scope.leg + 多腿绑定 | #1、#11 | S2 | 独立 | 间接 |
| 11 | S8 | feat(ai-quant): #984 Phase 5 S8 - portfolioRisk.symbol/subStrategy exposure cap | #10(symbol/subStrategy) | S2、S10 | 独立 + observe 一周 | 间接 |
| 12 | S12 | feat(ai-quant): #984 Phase 5 S12 - program.event_listener(合并 external.signal) | #4、#12 | S4、S9 | 独立 + paper trading drill | 间接 |

**Sentinel 说明：** Phase 5 不涉及异步写入路径（无 Prisma schema 变更、无 scheduler/cron 新增），不需要 SQL 哨兵证据。每个 PR 通过 unit + golden corpus + runtime parity 测试覆盖，等价于"哨兵跑过"。

**最长串行链：** S1 → S2 → S10 → S8 = 4 PR 串行；其余通过依赖图并行收敛。

---

## PR1 Detail — S1: gate.regime + 编排 substrate

### Goal

在现有 Phase 0 substrate（`SemanticOrchestrationContract` / `SemanticOrchestrationState` / `SemanticState.orchestration?` 已声明）基础上，落地第一个 supported orchestration capability `gate.regime`，通过 contract → canonical → IR → compiled runtime → backtest → live signal → presentation → NL gateway frame → golden corpus 完整执行链，关闭 Phase 5 验收 bullet #5 和 #6。

### Acceptance（每项必须有测试覆盖）

- [ ] `SemanticOrchestrationContract`（模板级）补齐 spec line 229 列的 7 个字段：`runtimeRequirements / stateRequirements / orderRequirements / target / capabilities / requires / openSlots`（**不**含 activeWhen / effectWhenFalse —— 这两个是 per-node 运行时表达式，仅在 Node 上）
- [ ] `SemanticOrchestrationNode` 在节点级承载 `target / activeWhen / effectWhenFalse / key`，gate 节点的 `target.phase = 'entry'`、`activeWhen: SemanticExpression`、`effectWhenFalse = 'block_new_entries'`
- [ ] `SemanticOrchestrationRegistryService` 注册 `gate.regime` capability，required params: `sideScope`、`activeWhen`
- [ ] `NaturalLanguageGatewayService` 抽取 `RegimeGateFrame`，覆盖"上涨趋势才允许做多"等 P0 utterance
- [ ] `SemanticFrameNormalizerService` 将 `RegimeGateFrame` 归一化到 `patch.orchestration.nodes[]`
- [ ] `SemanticContractReadinessService` 对 `kind: 'gate'` 且 key 为 `gate.regime` 的节点解除 Phase 0 unsupported 锁
- [ ] `SemanticPresentationRegistryService` 提供 `gate.regime` 的 publicName "趋势/状态过滤" + aliases + positive/negative examples + display/clarification renderer
- [ ] `CanonicalSpecBuilderService` 在 canonical spec v2 输出 `orchestration.gates[]`
- [ ] `CanonicalSpecV2IrCompilerService` 编译 `activeWhen` 进入 expr pool，IR 输出 `orchestrationGates[]` 节点
- [ ] `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.ts` 实现 gate 评估
- [ ] `runDecisionPrograms` 在 entry phase 检查 gate；`block_new_entries` 触发时 entry 决策转 NOOP，exit/risk 决策不受影响
- [ ] backtest 路径与 live signal fast path 都消费同一份 compiled runtime → gate 行为一致
- [ ] golden corpus 用例覆盖："只在上涨趋势时做多"、"震荡市才启用策略 → 走 fail-closed open slot（待后续 regime classifier，本 PR 不做）"、"已有空仓时仍能正常退出"、"缺 activeWhen 参数 fail-closed"、"未知 gate key（kind:'gate' 但 key 不是 gate.regime）保持 phase0 unsupported"、"非法 target.phase / 非法 activeWhen 表达式 fail-closed"
- [ ] backtest vs live signal parity 测试：相同行情、相同 strategy spec、相同输出；专门覆盖"已有空仓 + gate=false → CLOSE_SHORT 信号正常发出"在两条决策路径都通过
- [ ] Display projection 仅从 `state.orchestration.nodes[]` + presentation registry 渲染 gate.regime；不读 frame.evidence、不读 raw input 文本（spec test：传入一个 frame 但 state 缺对应 node → display 不渲染 gate）
- [ ] `dx lint`、`dx build quantify --dev`、相关 unit + golden corpus + parity 测试全绿
- [ ] `dx build contracts --dev` 后 `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出码 0（gate.regime 是内部语义，不应触发 swagger 变更）
- [ ] PR critic 双 comment 完成（review-report + fix-report），merge --squash --auto 到 main

### Files

**Create:**
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-orchestration-registry.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-gate-regime-golden-corpus.spec.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.spec.ts`

**Modify:**
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts` — `SemanticOrchestrationContract` 补齐 `runtimeRequirements / stateRequirements / orderRequirements / target / activeWhen / effectWhenFalse`；新增 `SemanticOrchestrationGateNode`、`SemanticOrchestrationGateTarget`、`SemanticOrchestrationGateEffect` 类型
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts` — 增加 `orchestration?: { nodes?: Array<...> }` 字段
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts` — 加入 `SemanticRegimeGateFrame` 到联合类型
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts` — 增加 `orchestration?: { gates: ... }` 输出字段
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts` — 增加 `orchestrationGates: Array<{ id, condition, target, effectWhenFalse, sideScope? }>` 字段
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts` — 增加 `parseRegimeGate(text)` 抽取规则
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts` — 增加 `regime_gate` case，发射 patch.orchestration.nodes
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts` — 透传 `patch.orchestration` 到 seed state
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` — 从 patch 构建 `state.orchestration.nodes`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts` — `normalizePhase0Orchestration` 排除 supported `gate.regime`，对 supported gate 走 registry-driven readiness
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts` — 增加 `gate.regime` entry
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts` — display 投影 `orchestration.gates`，使用 presentation registry，不暴露内部 key
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` — 在 canonical spec v2 输出末追加 `orchestration: { gates: [...] }`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` — 编译 gate.activeWhen 进 expr pool，输出 `orchestrationGates`
- `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts` — 注册 `SemanticOrchestrationRegistryService`
- `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts` — 接受 `orchestrationGateState`，在 OPEN_LONG/OPEN_SHORT 决策前检查
- `packages/shared/src/script-engine/compiled-runtime/build-compiled-manifest.ts` — 包含 orchestrationGates 字段
- `apps/quantify/src/modules/backtesting/<runner>` — 在 decision loop 注入 orchestration gate evaluator（具体文件名 Task 14 时定位）
- `apps/quantify/src/modules/strategy-signals/<fastpath>` — 在 live signal fast path 注入同样的 evaluator（具体文件名 Task 15 时定位）

**Test:**
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-orchestration-registry.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-gate-regime-golden-corpus.spec.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.spec.ts`
- 扩展现有：
  - `semantic-natural-language-gateway.service.spec.ts`
  - `semantic-frame-normalizer.service.spec.ts`
  - `semantic-presentation-registry.service.spec.ts`
  - `semantic-seed-extractor.service.spec.ts`
  - `semantic-state-projection.service.spec.ts`
  - `canonical-spec-builder.service.spec.ts`
  - `semantic-gateway-golden-corpus.spec.ts`
  - `evaluate-expr-pool.spec.ts`（gate 表达式入池）
  - `run-decision-programs.spec.ts`（gate 阻挡 entry）
  - `atom-coverage-golden-corpus.spec.ts`（标记 gate.regime executable）

### Tasks

#### Task 1: Substrate 类型补齐（types/semantic-state.ts）

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`

- [ ] **Step 1.1:** 在现有 `SemanticOrchestrationContract`（约 line 278-286）之上补齐 spec line 229 要求的 7 字段，并新增 gate-specific 类型。**注意：activeWhen / effectWhenFalse 不在 contract 接口里——它们是 per-node 运行时表达式，仅在 Node 上**：

```typescript
export interface SemanticOrchestrationGateTarget {
  phase: 'entry'
  sideScope?: 'long' | 'short' | 'both'
}

export type SemanticOrchestrationGateEffect = 'block_new_entries'

export interface SemanticOrchestrationContract {
  id: string
  kind: SemanticOrchestrationContractKind
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
  effects?: readonly SemanticEffect[]
  target?: SemanticOrchestrationGateTarget  // 模板声明该 contract 的 target 形态约束（gate kind 时使用）
  executableSinceVersion?: string  // 接入 PR #1044 atom 翻牌基建：声明翻牌起效版本（YYYY.MM.WNN）
}
```

- [ ] **Step 1.2:** 同样为 `SemanticOrchestrationNode`（约 line 288-297）补齐 `target / activeWhen / effectWhenFalse` 可选字段，使具体 gate 节点可携带评估表达式：

```typescript
export interface SemanticOrchestrationNode {
  id: string
  kind: SemanticOrchestrationContractKind
  key?: string  // 'gate.regime' 等具体 atom key
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: readonly SemanticSlotState[]
  contracts: readonly SemanticOrchestrationContract[]
  target?: SemanticOrchestrationGateTarget
  activeWhen?: SemanticExpression
  effectWhenFalse?: SemanticOrchestrationGateEffect
  support?: SemanticAtomSupportMetadata
}
```

- [ ] **Step 1.3:** Verify type compiles：

```bash
pnpm exec tsc --noEmit -p apps/quantify/tsconfig.json
```

Expected: 无新错误（旧 callers 全部使用可选字段）

- [ ] **Step 1.4:** Commit：

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts
git commit -F - <<'MSG'
refactor(ai-quant): #984 Phase 5 S1 — 补齐 SemanticOrchestrationContract 字段

为 gate.regime 闭环补齐 runtimeRequirements / stateRequirements /
orderRequirements / target / activeWhen / effectWhenFalse 字段，
保持向后兼容（全部可选）。

Refs: #984
MSG
```

#### Task 2: Patch 与 Frame 类型扩展

**Files:**
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`

- [ ] **Step 2.1:** patch 类型增加 orchestration nodes 字段：

```typescript
// codegen-semantic-patch.ts 末尾追加
export interface CodegenSemanticOrchestrationNodePatch {
  kind: 'gate'
  key: 'gate.regime'
  params: Record<string, unknown>
  target: { phase: 'entry'; sideScope?: 'long' | 'short' | 'both' }
  activeWhen: SemanticExpression
  effectWhenFalse: 'block_new_entries'
  evidence?: SemanticEvidence
}

// 修改 CodegenSemanticPatch 接口加入：
//   orchestration?: { nodes?: CodegenSemanticOrchestrationNodePatch[] }
```

- [ ] **Step 2.2:** frame 联合类型加入：

```typescript
// semantic-natural-language-frame.ts
export interface SemanticRegimeGateFrame extends SemanticFrameBase {
  kind: 'regime_gate'
  sideScope: 'long' | 'short' | 'both'
  // MVP: 用 indicator 比较表达 "趋势"
  indicator: 'ema' | 'sma' | 'ma'
  period: number
  operator: 'GT' | 'LT'
}

export type SemanticNaturalLanguageFrame =
  | SemanticContextFrame
  | SemanticIndicatorCompareFrame
  | SemanticBoundaryTouchFrame
  | SemanticActionFrame
  | SemanticRiskFrame
  | SemanticCombinationFrame
  | SemanticRegimeGateFrame
```

- [ ] **Step 2.3:** Build verify：`pnpm exec tsc --noEmit -p apps/quantify/tsconfig.json`，无错误。
- [ ] **Step 2.4:** Commit：

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts \
        apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts
git commit -F - <<'MSG'
feat(ai-quant): #984 Phase 5 S1 — 引入 RegimeGateFrame 与 patch.orchestration

Refs: #984
MSG
```

#### Task 3: SemanticOrchestrationRegistryService（新文件 + spec）

**Files:**
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts`
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-orchestration-registry.service.spec.ts`

- [ ] **Step 3.1:** 写测试 first (TDD)：测试 `getContractByKey('gate.regime')` 返回正确 contract；缺 `activeWhen` 参数时 `validate(node)` 返回 missing slot；valid node 通过 validate。
- [ ] **Step 3.2:** 实现 service：注册 `gate.regime`，capabilities=`[{ domain: 'orchestration', verb: 'gate', object: 'entry_phase' }]`，runtimeRequirements=`[{ domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' }]`，effects=`[{ domain: 'guard', verb: 'block', object: 'new_entries' }]`，缺 activeWhen → openSlot key `orchestration.gate.regime.active_when`。

  **接入 PR #1044 翻牌基建：** contract 声明 `executableSinceVersion: CURRENT_SEMANTIC_VERSION`（从 `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/version-gate/version-gate.ts` 导入）。Service 暴露 `isExecutableForStrategy(contract, strategy: StrategyVersionInfo): boolean`，内部调用 `isAtomExecutableForStrategy`，让 readiness（Task 7）和 runtime gate 评估（Task 12/13/14/15）按当前策略的 deployedAtSemanticVersion 决定是否启用。
- [ ] **Step 3.3:** Run spec：

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-orchestration-registry.service.spec.ts
```

Expected: PASS
- [ ] **Step 3.4:** 在 `llm-strategy-codegen.module.ts` providers 列表注册新 service。审 `SemanticContractReadinessService` constructor 当前注入参数清单（Task 7 将注入 registry）；如发现循环依赖（registry 与 presentation registry 互相依赖等），当场决定 `forwardRef` 或拆 service，**不得**靠后期发现再回填。
- [ ] **Step 3.5:** Commit：`feat(ai-quant): #984 Phase 5 S1 - SemanticOrchestrationRegistryService 注册 gate.regime`。

#### Task 4: NL gateway parseRegimeGate

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts` + extend its spec.

- [ ] **Step 4.1:** 写测试：输入 `"价格高于 EMA50 才允许做多"` → frame `{ kind: 'regime_gate', sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }`（这是 P0 主路径 utterance）；输入 `"震荡市才启用策略"` → **不**抽 regime_gate frame，保留 unsupported（本 PR 不做 regime classifier，缺 indicator/period 时不静默默认；后续 Round B 引入 state.market_regime 后再覆盖）；输入纯 `"上涨趋势才允许做多"`（无显式 EMA 周期）→ 不抽 frame，让 user 通过澄清提供 indicator/period。
- [ ] **Step 4.2:** 实现 `parseRegimeGate(text)`：识别 "(上涨|下跌)趋势 + (才|只) + (做多|做空|开多|开空)" 与 "价格高于/低于 EMA(\d+) + (才|只)..." 两类模式。MVP：仅支持显式 EMA 周期；纯 "上涨趋势" 缺 indicator/period 时进入 open slot（不静默默认）。
- [ ] **Step 4.3:** 在 `parse()` drafts 数组追加 `parseRegimeGate(text)`。
- [ ] **Step 4.4:** Run spec PASS。
- [ ] **Step 4.5:** Commit：`feat(ai-quant): #984 Phase 5 S1 — NL gateway 抽取 regime gate frame`。

#### Task 5: Frame normalizer 归一化 regime_gate

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts` + spec.

- [ ] **Step 5.1:** 写测试：单条 `RegimeGateFrame` → `patch.orchestration.nodes[0]` 含 `kind:'gate'`、`key:'gate.regime'`、`target:{phase:'entry',sideScope:'long'}`、`activeWhen` 为 `predicate(close > EMA(50))` 形态、`effectWhenFalse:'block_new_entries'`。
- [ ] **Step 5.2:** normalizer `switch(frame.kind)` 增加 `case 'regime_gate'` 分支，构造 patch orchestration node。
- [ ] **Step 5.3:** Run spec PASS。
- [ ] **Step 5.4:** Commit。

#### Task 6: Seed extractor / state builder 透传 orchestration

**Files:**
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`

- [ ] **Step 6.1:** 写测试（扩展 `semantic-seed-extractor.service.spec.ts`）：raw input `"价格高于 EMA50 才允许做多"` → state.orchestration.nodes 长度=1。
- [ ] **Step 6.2:** seed-extractor 把 normalizer 返回的 `patch.orchestration` 透传到 patch；seed-state-builder 在构建 SemanticState 时读取 `patch.orchestration.nodes` 写入 `state.orchestration = { nodes: [...], contracts: [...] }`。
- [ ] **Step 6.3:** Run spec PASS。
- [ ] **Step 6.4:** Commit。

#### Task 7: Contract readiness 解锁 supported gate.regime

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`

- [ ] **Step 7.0（前置审计，不可省）：** Grep 整仓 `state.orchestration` 与 `node.kind === 'gate'`、`node.kind === 'scope'`、`node.kind === 'program'`、`node.kind === 'portfolioRisk'` 的所有读取点（涉及 projection 76K、merge 24K、seed-state-builder 67K、readiness 33K）：

```bash
grep -rn "state\.orchestration\|node\.kind === 'gate'\|node\.kind === 'scope'" apps/quantify/src/modules/llm-strategy-codegen/
```

逐点确认 `node.key === 'gate.regime'` 路径的现有行为；若任一消费方对未知 orchestration node 已有"phase 0 unsupported"硬编码假设，本 Task 必须额外修复（不能仅改 normalizePhase0Orchestration 一处）。审计输出落到本 Task commit message。

- [ ] **Step 7.1:** 写测试覆盖 5 条 fail-closed 路径：
  1. `kind:'gate' && key:'gate.regime' && activeWhen` 完整 → readiness 不产 phase0 unsupported；状态 supported_executable。
  2. `kind:'gate' && key:'gate.regime'` 缺 activeWhen → 走 registry openSlot（key=`orchestration.gate.regime.active_when`），不上 phase0。
  3. `kind:'gate' && key:'unknown_gate_atom'` → 仍走 phase0 unsupported（兼容未来未知 gate kind）。
  4. `kind:'gate' && key:'gate.regime' && activeWhen` 不是合法 SemanticExpression（运行 `validateSemanticExpressionContract` 失败）→ phase0 unsupported（不允许伪装 supported）。
  5. `kind:'gate' && key:'gate.regime' && target.phase !== 'entry'`（违反 contract）→ phase0 unsupported。
  6. 其它 kind（scope/program/portfolioRisk）任意输入 → 走原 phase0 unsupported（保兼容）。

- [ ] **Step 7.2:** 修改 `normalizePhase0Orchestration`（line ~322）增加分支：

```typescript
function isSupportedRegimeGate(
  node: SemanticOrchestrationNode,
  strategy: StrategyVersionInfo,
  registry: SemanticOrchestrationRegistryService,
): boolean {
  if (node.kind !== 'gate') return false
  if (node.key !== 'gate.regime') return false
  if (node.target?.phase !== 'entry') return false
  if (!node.activeWhen) return false
  if (!validateSemanticExpressionContract(node.activeWhen).ok) return false
  // 翻牌门：旧策略（deployedAtSemanticVersion === null）/ contract executableSinceVersion 缺失 → 走 phase0
  const contract = registry.getContractByKey('gate.regime')
  if (!contract) return false
  if (!isAtomExecutableForStrategy(contract, strategy)) return false
  return true
}
```

`isSupportedRegimeGate(node, strategy, registry)` 为 true 时跳过 phase0 unsupported 注入，转交 `SemanticOrchestrationRegistryService.validate(node)` 决定剩余 readiness（如缺其他 required params 走 registry openSlot）。其它一律走原 phase0 unsupported（包含未翻牌的旧策略）。

**注入要求：** `SemanticContractReadinessService` constructor 注入 `SemanticOrchestrationRegistryService` + 取得当前策略的 `StrategyVersionInfo`（从 `LlmStrategyInstance.deployedAtSemanticVersion` 读，调用上下文按现有 readiness 调用方式拿）。如调用方上下文目前不传 strategy version，本 Task 同时改造调用方传入。

- [ ] **Step 7.3:** Run spec PASS；同时跑现有 `codegen-conversation.service.spec.ts` 中 `'returns orchestration.phase0.unsupported from orchestration node open slots'` 用例（用 scope kind 节点测试），确保未回归；Step 7.0 审计点出的所有消费方相关 spec 也跑过。
- [ ] **Step 7.4:** Commit。

#### Task 8: Presentation registry entry

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts` + spec.

- [ ] **Step 8.1:** 写测试：`getEntry('gate.regime')` 返回 `publicName:'趋势/状态过滤'`；displayRenderer 输入 `{params:{sideScope:'long',indicator:'ema',period:50,operator:'GT'}}` 输出 `"只在价格高于 EMA50 时允许做多"`；clarificationRenderer 对 missing activeWhen 槽位输出"请确认趋势过滤的指标与周期"；displayRenderer 输出不能包含 `gate.regime`、`activeWhen`、`block_new_entries` 等内部 key。
- [ ] **Step 8.2:** registry `register` 调用追加 entry，aliases=`['趋势过滤','状态过滤','regime gate']`，positiveExamples=`['上涨趋势才允许做多','价格高于 EMA50 才做多']`，negativeExamples=`['形态像头肩顶']`，goldenUtterances 与 positiveExamples 一致。
- [ ] **Step 8.3:** Run spec PASS。
- [ ] **Step 8.4:** Commit。

#### Task 9: Display projection 输出 orchestration gates

**Files:** Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts` + spec.

- [ ] **Step 9.1:** 写测试：state 含一个 gate.regime 节点 → projection display 输出包含 publicName "趋势/状态过滤" 与 displayRenderer 文本，不暴露 `gate.regime` 字符串。
- [ ] **Step 9.2:** projection 增加 orchestration gate 渲染分支，从 presentation registry 取 entry，落到 display graph 的 orchestration 区段（与 trigger/action 区段并列）。
- [ ] **Step 9.3:** Run spec PASS。
- [ ] **Step 9.4:** Commit。

#### Task 10: Canonical spec v2 emit orchestration.gates

**Files:**
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` + spec

- [ ] **Step 10.1:** spec v2 类型增加 `orchestration?: { gates: Array<CanonicalOrchestrationGate> }`，定义 `CanonicalOrchestrationGate { id, target:{phase,sideScope?}, activeWhen:CanonicalExpression, effectWhenFalse }`。
- [ ] **Step 10.2:** 写测试（扩展 `canonical-spec-builder.service.spec.ts`）：semantic state with gate.regime → built spec v2 contains `orchestration.gates[0]` 携带 canonical expression。
- [ ] **Step 10.3:** canonical builder 添加 `buildOrchestrationGates(state)` 方法，遍历 `state.orchestration?.nodes` 中 `kind:'gate' && status:'locked' && key:'gate.regime'` 节点。将每个节点的 `activeWhen` 通过现有私有方法 `buildConditionFromSemanticExpression(expression)`（位于 `canonical-spec-builder.service.ts:1816`）转为 `CanonicalConditionNode`。**前置子任务：** 该方法当前为 private，需要么改为 `protected` 内部直接复用，要么保持 private 在同一类内调用——本 Task 选**保持 private 直接调用**（new method 也在同一 service 内），无需提升可见性。canonical 形态：

```typescript
private buildOrchestrationGates(state: SemanticState): CanonicalOrchestrationGate[] {
  const nodes = state.orchestration?.nodes ?? []
  return nodes
    .filter(node =>
      node.kind === 'gate'
      && node.key === 'gate.regime'
      && node.status === 'locked'
      && node.activeWhen
      && this.isValidSemanticExpression(node.activeWhen),
    )
    .map(node => {
      const condition = this.buildConditionFromSemanticExpression(node.activeWhen!)
      if (!condition) return null
      return {
        id: node.id,
        target: node.target!,
        activeWhen: condition,
        effectWhenFalse: node.effectWhenFalse ?? 'block_new_entries',
      }
    })
    .filter((gate): gate is CanonicalOrchestrationGate => gate !== null)
}
```

注入到 spec v2 输出（在末尾追加 `orchestration: { gates: this.buildOrchestrationGates(state) }`，gates 为空数组时整个 orchestration 字段省略，保 spec snapshot 兼容）。
- [ ] **Step 10.4:** Run spec PASS。
- [ ] **Step 10.5:** Commit。

#### Task 11: IR compile orchestration gates

**Files:**
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` + spec

- [ ] **Step 11.1:** IR 类型增加 `orchestrationGates: Array<{ id, exprId, target:{phase,sideScope?}, effectWhenFalse }>`。
- [ ] **Step 11.2:** 写测试：spec v2 with one gate → IR has `orchestrationGates.length===1`，`exprId` 指向 expr-pool 已注册的表达式 id；同表达式如已存在则复用 expr id（dedupe）。
- [ ] **Step 11.3:** IR compiler 在现有编译流程后追加 `compileOrchestrationGates(spec)`：对每个 `spec.orchestration?.gates[]` 调用现有私有方法 `compileExpressionCondition(condition, context, seed)`（位于 `canonical-spec-v2-ir-compiler.service.ts:818`）。**关键：必须捕获该 helper 返回值作为 `exprId`，不可使用本地 seed 字符串字面量**——helper 内部 `upsertPredicate`（line 1765-1802）会做 dedupe + id 标准化（`.` `-` 全部转 `_`），返回的才是真实可用的 predicate id。

```typescript
private compileOrchestrationGates(
  spec: CanonicalStrategySpecV2,
  context: ExpressionCompilationContext,
  seed: IrCompilationSeed,
): IrOrchestrationGate[] {
  const gates = spec.orchestration?.gates ?? []
  return gates.map((gate) => {
    // 关键：捕获 helper 返回的真实 predicate id（含 dedupe 复用 + 字符规范化）
    const exprId = this.compileExpressionCondition(
      gate.activeWhen,
      context,
      `${seed}_orchestration_gate_${gate.id}`,
    )
    return {
      id: gate.id,
      exprId,
      target: gate.target,
      effectWhenFalse: gate.effectWhenFalse,
    }
  })
}
```

dedupe 由 `compileExpressionCondition` 内部 expr pool 实现（同表达式字面相等时返回已存在 predicate id）。把 `orchestrationGates` 数组作为 IR 顶层字段（与 `decisionPrograms` 并列），在 spec.orchestration 缺失时输出空数组。

- [ ] **Step 11.2 补强：** 测试除"基本编译成功"外，必须断言 dedupe 复用：构造一份 spec，**triggers 中已有** `condition.expression` 为 `close > EMA(50)`，**orchestration.gates[]** 也含 `close > EMA(50)` 作为 activeWhen → 编译后 `IR.orchestrationGates[0].exprId === <triggers 那条已注册的 predicate id>`（同字面表达式只编译一次，gate 复用）；同时断言两个不同 activeWhen 的 gate 各自得到不同 exprId。
- [ ] **Step 11.4:** Run spec PASS。
- [ ] **Step 11.5:** Commit。

#### Task 12: Compiled-runtime evaluator（新文件）

**Files:**
- Create `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.ts`
- Create `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-gates.spec.ts`

- [ ] **Step 12.1:** 写测试：`evaluateOrchestrationGates(gates, exprValues)` 输入两个 gate（long/short），exprValues 中 long expr=`true`、short expr=`false`（**bare boolean，CompiledRuntimeValue 是裸 union 不是 wrapped**）→ 输出 `{ blockEntryLong: false, blockEntryShort: true }`；missing exprValue（`exprValues[id]` 为 undefined）→ fail-closed `blockEntryLong: true`（"无法评估即阻止新开仓"）；非 boolean 值（number / string / null / `{levels:[]}`）→ 也走 fail-closed。
- [ ] **Step 12.2:** 实现（**注意 `CompiledRuntimeValue` 在 `evaluate-expr-pool.ts:5` 是 `number | string | boolean | null | { levels: number[] }`，不是 wrapped 形态**；现有 `run-decision-programs.ts:151` 的判断 `exprValues[program.when] !== true` 也证实 boolean 直接是 `true`/`false`）：

```typescript
import type { CompiledRuntimeValue } from './evaluate-expr-pool'

export interface CompiledOrchestrationGate {
  id: string
  exprId: string
  target: { phase: 'entry'; sideScope?: 'long' | 'short' | 'both' }
  effectWhenFalse: 'block_new_entries'
}

export interface OrchestrationGateState {
  blockEntryLong: boolean
  blockEntryShort: boolean
}

export function evaluateOrchestrationGates(
  gates: readonly CompiledOrchestrationGate[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): OrchestrationGateState {
  let blockLong = false
  let blockShort = false
  for (const gate of gates) {
    if (gate.target.phase !== 'entry') continue
    const raw = exprValues[gate.exprId]
    const isTrue = raw === true   // 严格 true：number/null/{levels} 全不算 true，走 fail-closed 分支
    if (isTrue) continue
    const sideScope = gate.target.sideScope ?? 'both'
    if (sideScope === 'long' || sideScope === 'both') blockLong = true
    if (sideScope === 'short' || sideScope === 'both') blockShort = true
  }
  return { blockEntryLong: blockLong, blockEntryShort: blockShort }
}
```

- [ ] **Step 12.3:** Run spec PASS。
- [ ] **Step 12.4:** Commit。

#### Task 13: run-decision-programs 接入 gate state

**Files:** Modify `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts` + spec.

- [ ] **Step 13.1:** 写测试（扩展 `run-decision-programs.spec.ts`）：传入 `orchestrationGateState = { blockEntryLong: true, blockEntryShort: false }`：
  - OPEN_LONG 决策被改写为 NOOP，reason `compiled.orchestration.gate.block_entry_long`（采用 `compiled.${domain}.${segment}` 命名规约，与现有 `compiled.${program.id}.*` 风格分段对齐——`orchestration` 与 program.id 占同一段，下游 ops 切分稳定）。
  - OPEN_SHORT 决策正常发出。
  - CLOSE_LONG/CLOSE_SHORT 决策不受任何影响。
  - REDUCE_LONG/REDUCE_SHORT 决策不受影响。
  - **W5 关键 case：** state 含已有 short 仓位 + `orchestrationGateState = { blockEntryLong: true, blockEntryShort: true }` → 当 program 决策是 CLOSE_SHORT（exit）时正常发出，证明 entry 阻塞不影响 exit 退出语义（issue bullet #6 安全保证）。
- [ ] **Step 13.2:** 修改 `runDecisionPrograms` 签名增加 `orchestrationGateState?: OrchestrationGateState`（可选保兼容，缺省视为不阻挡任何 entry）；在选择 entry decision 处（OPEN_LONG/OPEN_SHORT 分支）增加 gate 检查；exit/reduce/forceExit 路径不动。reason 字符串规约：`compiled.orchestration.gate.block_entry_long` / `compiled.orchestration.gate.block_entry_short`，**不**带具体 gate.id（多 gate 同时阻挡时不便聚合，落到日志上 ops 解析也不友好；具体 gate 触发哪条由 evaluator 输入聚合，仅 reason 命名稳定）。
- [ ] **Step 13.3:** Run spec PASS。
- [ ] **Step 13.4:** Commit。

#### Task 14: Backtest 接入 gate evaluator

**Files:**
- Modify `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`（call site 在 line 111）
- Extend `apps/quantify/src/modules/backtesting/services/backtest-compiled-runtime-compat.spec.ts`（已有 9 处 runDecisionPrograms 调用 case，复用其 fixture 风格）

- [ ] **Step 14.0（前置审计）：** Grep 全 backtesting 模块第二条决策路径：

```bash
grep -rln 'runDecisionPrograms\|StrategyDecisionV1\|decisionPrograms' apps/quantify/src/modules/backtesting/
```

确认 `services/backtest-strategy-adapter.service.ts:111` 是唯一决策入口（`jobs/`、`execution/`、`portfolio/`、`risk/` 子目录已被 grep 验证不含独立决策循环）；如有第二处必须本 Task 同时注入。审计输出落到本 Task commit message。

- [ ] **Step 14.1:** 写测试（扩展 `backtest-compiled-runtime-compat.spec.ts`），3 条 case：
  1. backtest IR 含 regime gate，K 线 close > EMA50（gate=true）→ OPEN_LONG 决策正常发出。
  2. K 线 close ≤ EMA50（gate=false）→ OPEN_LONG 决策被改写 NOOP，reason `compiled.orchestration.gate.block_entry_long`。
  3. **W5 关键：** state 含已有 short 仓位 + gate=false → CLOSE_SHORT 决策正常发出（entry 阻塞不影响 exit）。

- [ ] **Step 14.2:** 在 backtest-strategy-adapter.service.ts:111 调用 `runDecisionPrograms` 之前，先调用：

```typescript
const orchestrationGateState = evaluateOrchestrationGates(
  projection.orchestrationGates ?? [],
  exprValues,
)
const decision = runDecisionPrograms(
  ctx,
  decisionPrograms,
  exprValues,
  guardState,
  decisionOrder,
  orchestrationGateState,  // 新增第 6 参数
)
```

evaluator 与 Task 12 的 `evaluateOrchestrationGates` **必须是同一个 import**（不允许 backtest 与 live signal 各自重新实现 evaluator 逻辑——M5 critic 显式要求）。

- [ ] **Step 14.3:** Run spec PASS。
- [ ] **Step 14.4:** Commit。

#### Task 15: Live signal fast path 接入 gate evaluator

**Files:**
- Modify `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`（call site 在 line 732）
- Extend signal-generator 现有 spec（如不存在则新增）

- [ ] **Step 15.0（前置审计）：** Grep 全 strategy-signals 与 strategy-instances 是否有第二决策路径：

```bash
grep -rln 'runDecisionPrograms' apps/quantify/src/modules/strategy-signals/ apps/quantify/src/modules/strategy-instances/
```

确认 `signal-generator.service.ts:732` 是唯一 fast-path 决策入口；strategy-instances 不含 runDecisionPrograms 调用（已 grep 验证）。

- [ ] **Step 15.1:** 写测试，与 Task 14.1 完全对称的 3 条 case（gate=true / gate=false / 已有空仓 + gate=false → CLOSE_SHORT）。**断言**：spec test 文本与 Task 14 测试 fixture 形态可文本 diff 出"gate-related"部分应只在 import 路径不同（同 evaluator 调用、同 reason 字符串、同 case 排列），证明 backtest 与 live signal 真正共用同一 evaluator 抽象。

- [ ] **Step 15.2:** 在 signal-generator.service.ts:732 调用 `runDecisionPrograms` 前，与 Task 14.2 完全相同的 evaluator 调用（同 import 来源）：

```typescript
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'

// ...
const orchestrationGateState = evaluateOrchestrationGates(
  projection.orchestrationGates ?? [],
  exprValues,
)
const decision = runDecisionPrograms(
  ctx,
  decisionPrograms,
  exprValues,
  guardState,
  decisionOrder,
  orchestrationGateState,
)
```

- [ ] **Step 15.3:** Run spec PASS。
- [ ] **Step 15.4:** Commit。

#### Task 16: Backtest vs runtime parity test

**Files:** Create or extend a parity-style spec (sit alongside existing parity tests if any; otherwise new file `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-gate-regime-parity.spec.ts`).

- [ ] **Step 16.1:** 写测试：构造同一 strategy spec（含 gate.regime），相同 K 线序列，分别走 backtest decision loop 与 live signal fast path → 决策序列逐根相同；尤其包括"gate=false 时段 entry 被拦截"的关键 case。
- [ ] **Step 16.2:** Run PASS。
- [ ] **Step 16.3:** Commit。

#### Task 17: Golden corpus & atom-coverage 标记 gate.regime executable

**Files:**
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-gate-regime-golden-corpus.spec.ts`
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`（标记 gate.regime 路径 executable）
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`（解除 orchestration "not executable" 断言对 gate.regime 的覆盖）
- 扩展 `semantic-gateway-golden-corpus.spec.ts` 增加 P0 case：raw input → frames → state → readiness → display → canonical → IR → runtime gate eval。

- [ ] **Step 17.0（fixture 路径验证）：** `ls apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts` 确认存在（已 grep 验证存在 78.7K 文件）；如不存在则同目录下其它 fixture 文件名是真值，按真值更新本 Task。
- [ ] **Step 17.1:** 写 P0 case：
  - input：`"价格高于 EMA50 才允许做多。15min BTCUSDT 永续合约。亏损 5% 止损。"`
  - 期望 frames：context×4 + regime_gate×1 + action open_long + risk stop_loss
  - 期望 state.orchestration.nodes：1 个 supported gate.regime
  - 期望 readiness：not blocked by phase0
  - 期望 display：包含 "趋势/状态过滤"，不含 "gate.regime"
  - 期望 canonical spec v2.orchestration.gates.length=1
  - 期望 IR.orchestrationGates.length=1
  - 期望 evaluateOrchestrationGates 在 close>EMA50 时 blockEntryLong=false，反之 true
- [ ] **Step 17.2:** 写 fail-closed case 共 4 条：
  1. 缺 activeWhen → readiness 产生 open slot，不进 supported_executable。
  2. 未知 gate key（kind='gate' 但 key 不是 'gate.regime'）→ phase0 unsupported。
  3. 非法 target.phase → phase0 unsupported。
  4. activeWhen 不是合法 SemanticExpression → phase0 unsupported。
- [ ] **Step 17.3:** 写"已有空仓时仍能正常退出"case：state with short position + gate=false → CLOSE_SHORT 信号正常发出。
- [ ] **Step 17.4:** 写"display 不读 frame.evidence"case（W2）：构造 state 中**没有** orchestration node 但 frames 中有 regime_gate frame → display 不渲染 gate（证明 display 仅读 state，不绕过 state 直接读 frame 内部 evidence）。
- [ ] **Step 17.5:** Run all PASS。
- [ ] **Step 17.6:** Commit。

#### Task 18: 全面回归 & 修补

- [ ] **Step 18.1:** 并行跑：

```bash
dx lint &
dx build quantify --dev &
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/ &
wait
```

- [ ] **Step 18.2:** 失败项逐个修复 → 重跑直至全绿。
- [ ] **Step 18.3:** 跑 `dx build contracts --dev` 后强制断言 contracts 产物零 diff：

```bash
dx build contracts --dev
git diff --exit-code packages/api-contracts/src/generated/quantify.ts
# exit 0 = 无变更（期望）；非 0 = 阻断
```

非 0 时**必须** inline review diff，确认是否泄漏 orchestration 类型；如确实有意暴露则需在 PR body 显式声明并加 contracts spec test，否则回退。已 grep 当前 `quantify.ts` 不含 `Orchestration` 字符串，零 diff 是可达基线。
- [ ] **Step 18.4:** Final commit：`chore(ai-quant): #984 Phase 5 S1 - 修复回归`。

#### Task 19: PR push + critic + ship

- [ ] **Step 19.1:** Push：

```bash
git push -u origin feat/984-phase5-s1-gate-regime
```

- [ ] **Step 19.2:** 创建 PR：

```bash
gh pr create --base main --title "feat(ai-quant): #984 Phase 5 S1 - gate.regime + 编排 substrate" --body-file - <<'MSG'
## 变更目的

为 Issue #984 Phase 5 落地第一个 supported orchestration capability，关闭验收 bullet #5 与 #6：
- "上涨趋势才允许做多"等表达进入 runtime gate 而非仅 display graph
- gate=false 时阻止新开仓，已有仓位仍可正常退出

## 主要改动

- 补齐 SemanticOrchestrationContract / SemanticOrchestrationNode 的 runtimeRequirements / stateRequirements / orderRequirements / target / activeWhen / effectWhenFalse 字段
- 新增 SemanticOrchestrationRegistryService 注册 gate.regime
- NL gateway 抽取 RegimeGateFrame，frame normalizer 归一化为 patch.orchestration.nodes
- 解锁 contract readiness 中对 supported gate.regime 的 Phase 0 unsupported 锁
- presentation registry / display projection 新增 gate.regime 渲染，零内部 key 泄漏
- canonical spec v2 输出 orchestration.gates；IR compiler 编译 activeWhen 进 expr pool
- packages/shared 新增 evaluate-orchestration-gates，run-decision-programs 在 entry phase 检查 gate
- backtest 与 live signal fast path 共用同一 evaluator，parity 测试通过
- golden corpus 覆盖 raw input → frames → state → readiness → display → canonical → IR → runtime 完整链路
- atom coverage golden corpus 标记 gate.regime 为 executable

## 验证情况

- [x] `dx lint`
- [x] `dx build quantify --dev`
- [x] `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/`
- [x] `dx test unit quantify`（run-decision-programs / evaluate-expr-pool / evaluate-orchestration-gates）

## 关联

Refs: #984

本 PR 关闭 Phase 5 验收 bullet #6（"上涨趋势才允许做多" 进入 runtime gate）。
Partially 关闭 bullet #5（仅 entry 级 — orchestration.gates 控制 entry phase）；bullet #5 中 strategy/subStrategy/orderProgram 三个子级分别由 S10 与 S4 闭合。
其余 11 条 bullet（#1/#2/#3/#4/#7/#8/#9/#10/#11/#12/#13）由 S2-S12 分别交付。

不使用 `Closes` keyword（GitHub 会自动关闭 issue），保持 issue 开放至所有 12 个 slice merge。

Plan: docs/superpowers/plans/2026-05-09-ai-quant-phase-5-multi-pr.md
Spec: docs/superpowers/specs/2026-05-09-ai-quant-phase-5-orchestration-roadmap.md

Refs: #984
MSG
```

- [ ] **Step 19.3:** 派 `oh-my-claudecode:critic` 审 PR diff（critic round 上限 3 轮，第 3 轮仍有 Critical/Major → escalate 回 brainstorming，不接受 minor 妥协）。
- [ ] **Step 19.4:** 落 review-report comment + 落实修复 + 落 fix-report comment（双 comment gate）。
- [ ] **Step 19.5:** Merge：

```bash
gh pr merge <PR_NUMBER> --squash --auto
```

- [ ] **Step 19.6:** 等 auto-merge 成功；超时 30 分钟人工介入。

---

## PR2 Detail — S4: program substrate + fixed_grid_gated

**Closes bullets:** #5、#7、#8(fixed)
**Depends on:** S1
**Files (高层):** types `semantic-state.ts`（program 节点扩展）+ `canonical-strategy-spec-v2.ts`（programs section）+ `canonical-strategy-ir.ts`（orderPrograms section）+ canonical builder + IR compiler + new evaluator `evaluate-order-programs.ts`（packages/shared）+ run-order-programs.ts 接入 + backtest order lifecycle + live signal order placement + presentation entry + golden corpus。
**Key Tasks:**
1. program kind contract 扩展（activeWhen / onDeactivate{cancel|keep|close} / rebuildPolicy:'static' / orderRequirements）
2. fixed_grid_gated atom 注册（params: anchor, step, levels, lowerPct, upperPct, sizing）
3. NL gateway frame `OrderProgramFrame`（"上涨趋势时启用网格"等）
4. 接入 order lifecycle：activate 时挂 limit ladder；deactivate 走 cancel/keep/close
5. 三种 onDeactivate 行为各自独立回归
6. paper trading drill 文档化于 PR body

**Acceptance:** 同 S1 验收模板 12 项，外加：onDeactivate 三种行为独立 e2e；`activeWhen` 引用 S1 gate 时自动联动启停。

**Critic 重点：** 是否真接到 order lifecycle（不止 IR 输出）；onDeactivate=cancel 是否真撤单；rebuild 频率是否有上限保护。

---

## PR3 Detail — S5: program.dynamic_grid

**Closes:** #8(dynamic)
**Depends on:** S4
**Key Tasks:** rebuildPolicy `anchor_on_state_change`，rebuild 频率上限（默认 ≤1 次/分钟），anchor 从 state.remember_level 读取（如 Round B 已 ship；否则 MVP 用静态 anchor + lookback bar）。
**Acceptance:** anchor 变更触发重建；超过频率上限不重建；golden corpus 覆盖 anchor 变更前后 ladder 状态对比。

---

## PR4 Detail — S6: program.adaptive_volatility_grid

**Closes:** #8(adaptive)
**Depends on:** S4
**Key Tasks:** rebuildPolicy `atr_window`，根据 ATR(14) 调整 step 与 range；rebuild 冷却时间（默认 5 分钟）；step 上下限（参数化）。
**Acceptance:** ATR 区间变更触发 rebuild；冷却内不 rebuild；golden corpus 覆盖 ATR 上升/下降时 ladder 调整。

---

## PR5 Detail — S7: portfolioRisk.drawdown_block

**Closes:** #10(portfolio)
**Depends on:** S1
**Key Tasks:** portfolioRisk kind contract 扩展；新增 account-level drawdown 聚合通道（读取所有 active strategy 的 PnL 状态）；effect block_new_entries 在所有受影响策略起作用；先以 `mode:'observe'` 灰度 1 周（PR body 标注），再切 `mode:'enforce'`。
**Acceptance:** 观察模式不阻止任何决策但记录指标；强制模式阻止新开仓；exit 不受影响；golden corpus 覆盖。

---

## PR6 Detail — S2: scope.symbol substrate + 多标的绑定

**Closes:** #1、#2
**Depends on:** S1，**A/B/C 收尾**
**Key Tasks:**
1. scope kind contract 扩展（symbols 列表）
2. ambient default：单标的策略 readiness 行为不变
3. 多标的绑定：所有现有 trigger/action/risk/position 增加可选 `scopeBinding.symbol`；readiness 在 `scope.symbols.length>1` 且某 atom 缺绑定时 fail-closed
4. NL gateway 解析"BTCUSDT 和 ETHUSDT 同时按同一策略"等表达
5. canonical spec / IR / runtime 解析 scope binding，把每标的视作独立执行上下文
6. backtest 多 symbol feed 接入

**Acceptance:** 单标的策略行为不变；多标的策略缺绑定 fail-closed；多标的 e2e 各 symbol 独立决策。

**Critic 重点：** ambient default 的 readiness 路径是否真的零侵入；现有 atom 是否被迫修改类型签名（应保持 optional 字段）。

---

## PR7 Detail — S3: scope.timeframe 升级

**Closes:** #1、#3
**Depends on:** S2
**Key Tasks:** 把 Phase 3 已 ship 的 `multi_timeframe`（#1008 MVP）的 contract 提升为 `kind:'scope'`，明确 primaryTimeframe + requiredTimeframes；runtime 对数据缺失/未对齐/延迟 fail-closed；保留兼容性，不破坏现有 multi_timeframe golden corpus。
**Acceptance:** 现有 multi_timeframe 测试不回归；新 fail-closed 路径覆盖。

---

## PR8 Detail — S9: scope.dataSource

**Closes:** #1、#4
**Depends on:** S2
**Key Tasks:** scope.dataSource kind 增加 source role（primary/confirmation/event）；schema 与权限校验（与 #1042 frame schema 对齐）；未授权或 schema 不匹配 fail-closed。
**Acceptance:** primary feed 缺失 fail-closed；confirmation feed 不一致时阻止 entry；event source 通过 webhook 入口走 S12 闭环。

---

## PR9 Detail — S10: scope.subStrategy + 切换 gate

**Closes:** #1、#9
**Depends on:** S2
**Key Tasks:**
1. subStrategy 容器（list of nested strategy specs）
2. 切换 gate（基于 regime 或 volatility）
3. 切换时 handover 策略：默认保守模式"先平仓再切换"；handover 模式作为 follow-up
4. 切换条件不明确 fail-closed
**Acceptance:** 切换 gate 触发时旧 subStrategy 仓位先平掉，再激活新 subStrategy；条件不明确进入 unsupported。

---

## PR10 Detail — S11: scope.leg + 多腿绑定

**Closes:** #1、#11
**Depends on:** S2
**Key Tasks:** legScope substrate；每腿 trigger/action/risk/position 必须绑定 legScope；未绑定不得执行；多腿独立 sizing 与独立 risk。
**Acceptance:** 多腿 e2e 各腿独立决策；缺 legScope 的动作 fail-closed。

---

## PR11 Detail — S8: portfolioRisk.symbol/subStrategy exposure cap

**Closes:** #10(symbol/subStrategy)
**Depends on:** S2、S10
**Key Tasks:** scope-bound exposure 聚合（symbol 级、subStrategy 级）；effect reduce_exposure / pause_subStrategy；建议 observe → enforce 灰度。
**Acceptance:** exposure 超限触发对应 effect；exit/reduce 决策不受 cap 影响。

---

## PR12 Detail — S12: program.event_listener（合并 external.signal）

**Closes:** #4、#12
**Depends on:** S4、S9
**Key Tasks:** event-driven program；schema/source/权限/幂等 key/去重/过期；与现有 webhook external signal 路径整合并清理 deprecation。
**Acceptance:** 事件 schema 不匹配 unsupported；幂等 key 重复事件去重；过期事件丢弃；webhook 鉴权失败 401。

---

## 收尾 Hard Gates 一览

每个 PR 必须满足：

1. Plan critic（≤3 轮，本文档涵盖 S1，S2-S12 起 PR 时各自再写细化 plan）
2. 每 PR 有 issue link `Refs: #984`
3. 每 PR 完整 12 项 acceptance（contract/canonical/IR/runtime/backtest/live signal/parity/presentation/gateway frame/golden corpus/fail-closed/不污染 deploy truth）
4. PR critic 双 comment（review-report + fix-report）
5. `gh pr merge --squash --auto`，CI 绿后自动合并
6. 任一 critic 第 3 轮仍未过 → escalate 回 brainstorming，不接受 minor 妥协

每 PR 之间不需要 SQL 哨兵（无 schema 变更），但**金融订单类 PR（S4-S6、S12）必须 paper trading drill 后再 merge**。

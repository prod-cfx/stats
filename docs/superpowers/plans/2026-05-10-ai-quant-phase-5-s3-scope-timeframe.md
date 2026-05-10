# AI Quant Phase 5 S3 — `scope.timeframe` 升级 + 多周期 runtime fail-closed

**Issue:** #1109
**Refs:** #984（Phase 5 总规划）、#1107（S2 `scope.symbol` substrate 已合入 main，PR id db50d648）
**Master plan:** `docs/superpowers/plans/2026-05-09-ai-quant-phase-5-multi-pr.md` PR7 detail
**Track:** C — 完整 plan + critic ≤3 + execute + ship 单 PR 闭环
**Branch:** `feat/1109-phase5-s3-scope-timeframe`

---

## 1. Goal

在 S2 (#1107) 已落地的 `kind:'scope'` substrate 上扩 **第二个 supported scope kind `scope.timeframe`**，关闭 #984 验收 bullet #1（scopes 扩 timeframe）和 #3（多周期 runtime 数据对齐 fail-closed），不破坏单周期旧策略 / 不替代 Phase 3 已 ship 的 `strategy.multi_timeframe` HTF filter atom（#1008）。

完整执行链路：types → registry contract → readiness fail-closed → canonical spec → IR → AST → projection → emitter/parser（兼容路径）→ runtime alignment fail-closed → caller wiring（signal-gen / backtest）→ NL gateway parser → presentation registry → display token table → golden corpus + parity。

**非目标（明确划出）：**
- **不替代** Phase 3 `strategy.multi_timeframe` atom（atom 表"高周期过滤、低周期执行"信号语义；scope 表节点对 timeframe 的绑定关系）。两者并存。
- **不实现** 生产级多周期市场数据 feed 接入与时序保证：本 PR 的 runtime alignment check 消费 `ctx.timeframeBarStatus`，由 caller 从既有 `ctx.bars`（primary）+ `ctx.data[symbol][tf]`（多 timeframe 数据，量化引擎已按 strategy.requiredTimeframes 拉取）派生最小可用状态；exchange feed 时序鲁棒性（如断线重连后的对齐保证）跟进 follow-up issue（与 #1108 fan-out 同优先级）。
- **不实现** scope.timeframe 与 scope.symbol 的多 scope 联合 fan-out（S10/S11 issue 范畴）。

---

## 2. 与 S2 (#1107) substrate 复用边界

S2 已完成的 substrate 部分本 PR **直接复用、不改**：
- `SemanticOrchestrationContractKind = 'scope' | 'gate' | 'program' | 'portfolioRisk'`（已含 `'scope'`）
- `SemanticOrchestrationContract` 完整字段（capabilities/requires/runtimeRequirements/...）
- `SemanticOrchestrationRegistryService` 注册基建 + `validate(node, siblingNodes)` 签名
- `applyOrchestrationReadinessForNode` dispatch 框架（已有 6 条 `isSupportedXxx` 分支）
- `applyRegistryDrivenReadiness` open-slot 合并逻辑
- `CanonicalOrchestrationScope` / `IrOrchestrationScope` / `CompiledOrchestrationScope` interface 名（升级为 discriminated union）
- canonical spec v2 → IR → AST → projection 透传链
- emitter/parser `ORCHESTRATION_SCOPES` const 兼容路径（仅当非空才输出，单/0 scope 字节等价）
- `applySymbolScopeBindingFailClosed`（≥2 scope 时 owner 节点缺 ref → fail-closed）的设计模式（S3 镜像出 `applyTimeframeScopeBindingFailClosed`）
- caller 对 scope 透传：`signal-generator.service.ts` line 783-796、`backtest-strategy-adapter.service.ts` 的 orchestrationScopes 入参

S2 与 S3 的 **关键差别**：
- S2 scope.symbol 的 runtime 是 **routing**（多 symbol 时 caller fan-out 各 scope，runtime 路由到匹配 program；单 scope 走兜底）。
- S3 scope.timeframe 的 runtime 是 **data alignment 校验**（per-program 检查 primary/required tf 已收 bar 是否按 alignmentPolicy 对齐；不对齐 fail-closed NOOP；与 fan-out 解耦——同一 strategy 在 primary bar close 时单次 onBar，无需多次 invoke）。
- 因此 S3 不需要 follow-up "fan-out caller"（S2 的 #1108）；S3 只需要 caller 在既有单次 onBar 路径里把 `ctx.timeframeBarStatus` 注入即可。

---

## 3. Acceptance（完整对齐 #1109 验收 + 落到测试）

每条 bullet 对应至少 1 个 spec/golden corpus/parity 测试，executable check 标注 ✅。

- [ ] **A1** `scope.timeframe` 在 `SemanticOrchestrationRegistryService` 注册：capabilities（`orchestration.declare.timeframe_scope`）/ requires(`[]`) / runtimeRequirements（`runtime.read.bar_status_by_timeframe`）/ stateRequirements(`[]`) / orderRequirements(`[]`) / openSlots(`[]`) / effects（`orchestration.bind.timeframe_scope`）/ executableSinceVersion = `CURRENT_SEMANTIC_VERSION`
- [ ] **A2** readiness gate：`kind:'scope'` + `key:'scope.timeframe'` 解锁；其他 scope key（`scope.dataSource`/`scope.subStrategy`/`scope.leg`）保持 phase0 unsupported；`scope.timeframe` 节点 10 条 fail-closed 检查：
  - **A2.1** kind === 'scope'
  - **A2.2** key === 'scope.timeframe'
  - **A2.3** timeframeScopeKind === 'timeframe'
  - **A2.4a** primaryTimeframe 是字符串、非空、命中 `TIMEFRAME_FORMAT_PATTERN`
  - **A2.4b** requiredTimeframes 是非空数组
  - **A2.4c** requiredTimeframes 每项命中 pattern + 去重
  - **A2.4d** requiredTimeframes 长度 ∈ [1, 8]（≥9 fail-closed）
  - **A2.4e** primaryTimeframe ∉ requiredTimeframes（自引用拒绝）
  - **A2.4f** primary 粒度严格细于所有 required：`parseTimeframeMs(primary) < min(...requiredTimeframes.map(parseTimeframeMs))`（**critic Round 2 C2-R2 修正**：bar-bucket 数学的隐含前提；缺失校验时 primary=1h required=[15m] 颠倒会通过 readiness 但 runtime 公式语义破坏）
  - **A2.5** alignmentPolicy ∈ {'strict','tolerant'}
  - **A2.6** 多 scope 间 (primaryTimeframe, sortedRequired) 元组不重复
  - **A2.7** registry contract 存在 + version-gate（strategyVersion 不为 undefined + atom 对该策略可执行）
- [ ] **A3** trigger / action / risk / positionConstraint 节点支持可选 `timeframeScopeRef?: string`；**只要有 ≥1 个 supported `scope.timeframe` locked 节点**，readiness `applyTimeframeScopeBindingFailClosed` 即对每个 status='locked' 的 owner 检查 ref：缺失 / trim 后空 / 不在 supportedScopeIds 集合 → 加 `orchestration.scope.timeframe.missing_binding` open slot + status 降为 'open'。同一 owner 同时缺 `symbolScopeRef` + `timeframeScopeRef` 时，两个 missing_binding slot 各自单独上报。**S3 与 S2 (≥2 才强制) 不同**：理由——timeframe alignment 是 per-program runtime 校验，必须有显式绑定，不允许 ambient 兜底（与 §4.7.3 决策表呼应；plan §8 风险表说明）
- [ ] **A4** canonical spec v2 → IR：`CanonicalOrchestrationScope` 升级为 discriminated union（`SymbolScope | TimeframeScope`）；`IrOrchestrationScope` 同步；spec builder 在 `spec.orchestration.scopes[]` 输出含 timeframe 子项；IR compiler `compileOrchestrationScopes` 透传所有 kind；rule.metadata 透传 `timeframeScopeRef?`（与 `symbolScopeRef?` 平级）
- [ ] **A4b** spec builder 在 spec.orchestration.scopes[] 含 timeframe locked 节点时，把 `(primaryTimeframe ∪ requiredTimeframes)` 合并 union dedup 写入 `spec.dataRequirements.requiredTimeframes`，让既有 backtest HTF 拉数路径（`backtest-runner.service.ts` resolveRequiredHtfTimeframes）自动覆盖；spec 输出顺序稳定（按 timeframe ms 升序）
- [ ] **A5** AST + projection + emitter/parser：`StrategyAstV1.orchestrationScopes` / `CompiledScriptProjection.orchestrationScopes` 类型同步 union；emitter `ORCHESTRATION_SCOPES` 仅当 `length > 0` 输出（与 S2 byte-equal 兼容路径相同；spec 验证：单 scope.symbol（无 timeframe）旧策略 `structuralDigest` 不变；含 timeframe scope 的 ast 经 emit/parse round-trip `structuralDigest` 稳定）
- [ ] **A6** compiled runtime alignment fail-closed：新增 `applyTimeframeScopeAlignment(program, ctx, scopes)` 在 `runDecisionPrograms` 主循环中 **在 `applySymbolScopeRouting` 之后、`applyOrchestrationGate` 之前** 调用；决策表：
  - 0 个 timeframe scope（projection 中无 scopeKind='timeframe' 子项）→ `'continue'`（旧策略 / 单周期零侵入）
  - ≥1 个 timeframe scope + program 无 `metadata.timeframeScopeRef` → fail-closed `compiled.orchestration.scope.timeframe.fail_closed.unbound_program`（**任意数量都强制要求显式绑定，不做 ambient 兜底**——理由：alignment 是 per-program 决策，binding 不可省略；与 §4.3 readiness ≥1 强制绑定呼应）
  - program 已绑定 ref：
    - ref 不在 scopes id 集合 → fail-closed `compiled.orchestration.scope.timeframe.fail_closed.unknown_scope`
    - 命中 scope，进入对齐校验：
      - `ctx.timeframeBarStatus` 缺失 → fail-closed `compiled.orchestration.scope.timeframe.fail_closed.data_unavailable`
      - primary tf 在 status 中缺失或 `lastClosedBarTs` 不是有限数 → fail-closed `primary_missing`
      - 任一 required tf 缺失或 `lastClosedBarTs` 不是有限数 → fail-closed `required_missing`
      - 任一 required tf bucket diff 超限（按 bar-bucket 比较；strict / tolerant 见 §4.7.3）→ fail-closed `alignment_lag`
- [ ] **A7** `applyTimeframeScopeAlignment` 失败 decision 经过 `applyOrchestrationGate` 二次包裹（与 S2 路径一致），保留 portfolioRisk `observedBreaches` 上报
- [ ] **A8** 单周期旧策略（无 scope.timeframe 节点）行为完全不变：legacy spec snapshot 不变；旧 v1 compiled script 字节等价；`ctx.timeframeBarStatus` 不注入也不会触发 alignment 检查
- [ ] **A9** caller wiring：
  - **A9.1（backtest 路径，本 PR 落地）** `backtest-strategy-adapter.service.ts`：在 spawn `runDecisionPrograms` 前，从 `ctx.legs[0].id`（默认 `'primary'`）+ `ctx.data[legId][tf].bars` 构建 `ctx.timeframeBarStatus`；`lastClosedBarTs = bars.at(-1)?.timestamp`（毫秒，与 backtest-runner.service.ts `ts: bar.closeTime` 同源）；`lastClosedBarIndex = bars.length - 1`。仅当 `projection.orchestrationScopes` 含 `scopeKind: 'timeframe'` 子项时才注入。
  - **A9.2（live 路径，本 PR 防呆）** `signal-generator.service.ts` / `signal-generation-decision.stage.ts.buildPublishedStrategyContext` 当前走 single-leg `buildStrategyContext()` **不携带多 timeframe 数据**。本 PR 处理：
    - decision stage 检测 `projection.orchestrationScopes` 是否含 timeframe scope；若含且 caller 未注入 `multiLegData` → 强制写入 `ctx.timeframeBarStatus = undefined`（不注入），runtime 自动走 `data_unavailable` fail-closed（NOOP），不静默通过；
    - 在 publication 链路上加 `validateScopeTimeframePublishability(spec, callerCapabilities)`：当 strategy spec 含 scope.timeframe + 部署 target=live + caller 无 `multiLegRuntime` capability flag → publication gate 抛 `DomainException(ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED)`，阻止用户在 UI/API 把 scope.timeframe 策略部署到 live；backtest path 不受影响。
  - 当上游缺多 timeframe 数据（如某 required tf bars 为空），对应 tf 不写入 status，runtime 自然 `required_missing` fail-closed。
- [ ] **A9-followup** Live 端完整 multi-timeframe 数据接入跟进 follow-up issue（与 §11 一并描述）。Plan 显式声明：本 PR 完成 backtest 路径 + live publication-gate；live 端运行时多 tf 数据 feed 整合不在 S3 substrate 范畴。
- [ ] **A10** golden corpus ≥ 8 case：双周期 supported（primary=15m, required=[1h]）/ 三周期 supported（primary=5m, required=[15m,1h]）/ ≥1 timeframe scope 缺绑定 fail-closed / 多 timeframe scope 缺绑定双 slot fail-closed / requiredTimeframes 长度 9 fail-closed / scope.dataSource 仍 unsupported_kind / data_unavailable / primary_missing / required_missing / alignment_lag（strict bucket diff=1 vs bucket diff=0 边界 + tolerant bucket diff=1 vs diff=2 边界）+ 1 negative（单周期 utterance 不产 timeframe_scope frame）+ 1 negative（HTF filter atom utterance "1h 高周期过滤 15m 信号" 不被 timeframe_scope 误命中）
- [ ] **A11** backtest vs live signal parity 多周期：受 A9.2 限制，live 路径在 A11 范围内只验证 publication gate **拒** scope.timeframe deploy；backtest 路径独立 parity（同行情同 spec → backtest 内决策序列稳定），4 个边界 case：normal supported（同 bucket 通过）/ data_unavailable（ctx.timeframeBarStatus 空 → fail-closed NOOP）/ required_missing（required tf 不在 status → fail-closed NOOP）/ alignment_lag（required bucket 落后超阈值 → fail-closed NOOP）
- [ ] **A12** NL gateway 6 件套：
  - `parseTimeframeScope(text)` 命中表：≥6 positive utterance（中文 + 英文）+ 2 negative（单周期 + HTF filter atom utterance）
  - 双门槛：≥2 个 distinct timeframe vocab 命中（`{1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w}`）+ 触发短语精准多 OR——**锁定到 scope-binding 词组**：`(主周期|执行周期|primary timeframe|primary tf|多周期|multi[-\s]?timeframe|多时间框架|严格对齐|strict alignment|宽松对齐|tolerant alignment|require[ds]?\s+timeframes?)`，**移除 "高周期"/"低周期"/"周期过滤"** 等与 `strategy.multi_timeframe` HTF filter atom（#1008）撞车的短语
  - frame normalizer 增加 `timeframe_scope` case，发射 `patch.orchestration.nodes`；alignmentPolicy 默认 `'strict'`（utterance 显式 "宽松对齐"/"tolerant" 才落 tolerant）
  - presentation registry 加 `scope.timeframe` entry：publicName=`周期范围`、aliases=`['多周期范围', '多时间框架', 'timeframe scope']`、positiveExamples / negativeExamples / goldenUtterances / displayRenderer / clarificationRenderer
  - display token table 加 `atom.scope.timeframe.name`、`atom.scope.timeframe.display.with_required`、`slot.orchestration.scope.timeframe.primary_timeframe`、`slot.orchestration.scope.timeframe.required_timeframes`、`slot.orchestration.scope.timeframe.alignment_policy`、`slot.orchestration.scope.timeframe.missing_binding`、`slot.orchestration.scope.timeframe.lag`、`slot.orchestration.scope.timeframe.required_length` 共 8 个
  - clarification slot：参数缺失时 question hint 中文表达
- [ ] **A13** version-gate：`SCOPE_TIMEFRAME_CONTRACT.executableSinceVersion = CURRENT_SEMANTIC_VERSION`；`isSupportedTimeframeScope` 8 重 fail-closed（含 A2 全 7 项 + version-gate）
- [ ] **A14** `dx lint` ✅ + `dx build quantify --dev` ✅ + 受影响 unit + golden corpus + parity 测试 ✅
- [ ] **A15** `dx build contracts --dev` 后 `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出码 0
- [ ] **A16** PR critic 第 1 轮双 comment（review-report + fix-report）+ `gh pr merge --squash --auto` 自动合入

---

## 4. Proposed Solution

### 4.1 Type 层（types/）

#### 4.1.1 `semantic-state.ts`

新增 timeframe scope contract 类型；扩展 `SemanticOrchestrationNode` 增加 timeframe-only 字段；trigger / action / risk / positionConstraint 节点加 `timeframeScopeRef?: string`。

```ts
// 新增（与 SemanticTimeframeScopeContract 镜像 #1107 SemanticSymbolScopeContract pattern）
export type SemanticOrchestrationScopeKind = 'symbol' | 'timeframe'  // 与 SemanticOrchestrationContractKind='scope' 子类型
export type SemanticOrchestrationTimeframeAlignmentPolicy = 'strict' | 'tolerant'

// 单一 source-of-truth（critic Round 2 M2-R2）：从 packages/shared TIMEFRAME_MS 派生
// 避免 quantify types 与 runtime 双 white-list drift
import { TIMEFRAME_MS } from '@ai/shared/script-engine/compiled-runtime/parse-timeframe-ms'
export const SEMANTIC_SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAME_MS)) as readonly (keyof typeof TIMEFRAME_MS)[]
export type SemanticSupportedTimeframe = keyof typeof TIMEFRAME_MS

// SemanticOrchestrationNode 扩展（保持向后兼容；timeframe 字段全 optional）
export interface SemanticOrchestrationNode {
  ...
  // scope.symbol 节点专属（已有）
  symbolScopeKind?: 'symbol'
  symbols?: readonly string[]
  primarySymbol?: string
  // scope.timeframe 节点专属（新增；与 symbolScopeKind 互斥）
  timeframeScopeKind?: 'timeframe'
  primaryTimeframe?: SemanticSupportedTimeframe
  requiredTimeframes?: readonly SemanticSupportedTimeframe[]
  alignmentPolicy?: SemanticOrchestrationTimeframeAlignmentPolicy
  ...
}

// trigger/action/risk/positionConstraint 各加 timeframeScopeRef? optional 字段（镜像 symbolScopeRef）
```

#### 4.1.2 `codegen-semantic-patch.ts`

新增 `CodegenSemanticOrchestrationTimeframeScopeNodePatch` 与 `CodegenSemanticOrchestrationSymbolScopeNodePatch` 平级，加入联合类型；frame normalizer 把 `timeframe_scope` frame 归一化到此 patch type。

#### 4.1.3 `semantic-natural-language-frame.ts`

新增 `SemanticTimeframeScopeFrame { kind: 'timeframe_scope'; primaryTimeframe; requiredTimeframes; alignmentPolicy?; evidenceText }` 加入联合类型。

#### 4.1.4 `canonical-strategy-spec-v2.ts`

`CanonicalOrchestrationScope` 升级 discriminated union：

```ts
export interface CanonicalOrchestrationSymbolScope {
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}
export interface CanonicalOrchestrationTimeframeScope {
  id: string
  scopeKind: 'timeframe'
  primaryTimeframe: string
  requiredTimeframes: readonly string[]
  alignmentPolicy: 'strict' | 'tolerant'
}
export type CanonicalOrchestrationScope =
  | CanonicalOrchestrationSymbolScope
  | CanonicalOrchestrationTimeframeScope
```

`CanonicalRuleMetadata` 加 `timeframeScopeRef?: string`。

#### 4.1.5 `canonical-strategy-ir.ts`

`IrOrchestrationScope` 同步升级 discriminated union（`scopeKind: 'symbol' | 'timeframe'`）。

`RuleBlock.metadata` 加 `timeframeScopeRef?: string`。

#### 4.1.6 `canonical-strategy-ast.ts`

`DecisionProgramNode.metadata` 加 `timeframeScopeRef?: string`。

#### 4.1.7 `compiled-script-projection.ts`

`CompiledScriptProjection.orchestrationScopes?: IrOrchestrationScope[]`（已存在；类型自动通过 union 升级生效）。

### 4.2 Registry 层（`semantic-orchestration-registry.service.ts`）

新增常量与 contract：

```ts
const SCOPE_TIMEFRAME_KEY = 'scope.timeframe'

const TIMEFRAME_FORMAT_PATTERN = /^(?:1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)$/u
// 由 SEMANTIC_SUPPORTED_TIMEFRAMES 派生，单一来源避免 drift

const SCOPE_TIMEFRAME_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.timeframe',
  kind: 'scope',
  capabilities: [{ domain: 'orchestration', verb: 'declare', object: 'timeframe_scope', shape: {} }],
  requires: [],
  params: {},
  runtimeRequirements: [
    { domain: 'runtime', verb: 'read', object: 'bar_status_by_timeframe' },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [{ domain: 'orchestration', verb: 'bind', object: 'timeframe_scope' }],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}
```

注册到 contracts map：

```ts
[SCOPE_TIMEFRAME_KEY, SCOPE_TIMEFRAME_CONTRACT],
```

`validate(node, siblings)` 在 `node.kind === 'scope'` 分支内细分 by `node.key`。**关键约束**：S2 已经把现有 `validateScopeNode` 实现为 `key === 'scope.symbol'` 命中走 symbol 校验、其他 key 返回 `unsupported_kind` slot；S3 把这个分支拆为 by-key dispatch，**保留 `unsupported_kind` 作为兜底**，不破坏 S2 既有 spec 行为。

```ts
if (node.kind === 'scope') {
  if (node.key === SCOPE_SYMBOL_KEY) return this.validateSymbolScopeNode(node, siblings)
  if (node.key === SCOPE_TIMEFRAME_KEY) return this.validateTimeframeScopeNode(node, siblings)
  // 兜底：scope.dataSource / scope.subStrategy / scope.leg 仍 unsupported（与 S2 一致）
  return {
    ok: false,
    missingSlots: [{
      slotKey: 'orchestration.scope.unsupported_kind',
      fieldPath: `orchestration.scope[${node.id}]`,
      status: 'open',
      priority: 'core',
      questionHint: '当前仅支持 scope.symbol / scope.timeframe',
      affectsExecution: true,
    }],
  }
}
```

S2 already-shipped specs 必须保持绿色：`semantic-orchestration-registry.service.spec.ts` 现存的 symbols_overlap / primary_collision / 多 scope 隔离 case，以及 `orchestration-symbol-scope-golden-corpus.spec.ts` Section B 全部 case，T2 commit 前列出名单跑一遍。golden corpus 加 1 case：locked scope.symbol + locked scope.timeframe sibling 共存 → 各自独立 ok=true，互不污染 missingSlot。

`validateTimeframeScopeNode` 10 重检查（与 issue acceptance A2 完整对齐）：
1. `key === 'scope.timeframe'`
2. `timeframeScopeKind === 'timeframe'`
3. `primaryTimeframe` 字符串 + 非空 + 命中 `TIMEFRAME_FORMAT_PATTERN`
4. `requiredTimeframes` 是数组
5. `requiredTimeframes` 长度 ≥ 1 且 ≤ 8（≥9 fail-closed slot key `orchestration.scope.timeframe.required_length`）
6. `requiredTimeframes` 每项命中 pattern + 去重
7. `primaryTimeframe ∉ requiredTimeframes`（自引用拒绝，slot key `orchestration.scope.timeframe.required_timeframes`）
8. **粒度顺序**（critic Round 2 C2 修正）：`parseTimeframeMs(primaryTimeframe) < min(...requiredTimeframes.map(parseTimeframeMs))`——primary 必须比所有 required 粒度细。slot key `orchestration.scope.timeframe.primary_granularity`。理由：bar-bucket 数学（§4.7.3）的隐含前提是 primary tf 比 required 细，否则 `floor(primaryTs/requiredDurMs)` 退化、bucket 比较语义破坏。
9. `alignmentPolicy ∈ {'strict','tolerant'}`
10. 与其它 status='locked' 且 key='scope.timeframe' 的 siblings 比较：`JSON.stringify([primary, sorted required])` 元组不能完全相同（重复 scope 拒绝；slot key `orchestration.scope.timeframe.duplicate_definition`）

### 4.3 Readiness 层（`semantic-contract-readiness.service.ts`）

新增 `isSupportedTimeframeScope(node, registry, strategyVersion, siblingNodes)` 9 重 fail-closed：

1. `kind === 'scope'`
2. `key === 'scope.timeframe'`
3. `timeframeScopeKind === 'timeframe'`
4. `primaryTimeframe` 合法（非空字符串 + TIMEFRAME_FORMAT_PATTERN）
5. `requiredTimeframes` 非空数组 + 长度 ∈ [1, 8] + 每项 pattern 命中 + 去重
6. `primaryTimeframe ∉ requiredTimeframes`
7. **粒度顺序**（critic Round 2 C2-R2）：`parseTimeframeMs(primary) < min(...requiredTimeframes.map(parseTimeframeMs))`
8. `alignmentPolicy ∈ {'strict','tolerant'}`
9. registry contract 存在 + version-gate（`strategyVersion !== undefined` + `isExecutableForStrategy`）+ 与其它 locked sibling 不重复

`applyOrchestrationReadinessForNode` dispatch 新增分支：

```ts
if (isSupportedTimeframeScope(node, registry, strategyVersion, siblingNodes)) {
  return applyRegistryDrivenReadiness(node, registry, siblingNodes)
}
```

新增 `applyTimeframeScopeBindingFailClosed(state)`。**关键决策（与 S2 ≥2 阈值不同）**：当 supported `scope.timeframe` locked 节点 **≥1** 即对每个 status='locked' 的 trigger/action/risk/positionConstraint 强制检查 `timeframeScopeRef`：缺失 / trim 后空 / 不在 supportedScopeIds 集合 → 加 `orchestration.scope.timeframe.missing_binding` open slot 并 status 降为 'open'。

理由：S2 symbol scope 是 routing 维度，单 scope 时 fan-out 退化为单进程执行，可省 binding；S3 timeframe scope 是 per-program runtime alignment 决策维度，每次 onBar 都要按 binding 找到 active scope 校验对齐——若没有显式 binding，runtime 不能假设 ambient（避免 §4.7.3 决策表与 readiness 不一致带来的隐藏 fail-closed）。这是 S3 与 S2 在 binding 强制阈值上的**显式分歧**。

owner 节点同时缺 `symbolScopeRef` + `timeframeScopeRef` 时，两个 missing_binding slot 各自单独追加（不合并；UX 上让用户分别看到两个维度的缺口）。

**open → locked 流转语义**（critic Round 2 M4-R2）：scope 节点 `status='open'`（参数 clarification 中）期间 spec builder 不输出该节点（§4.4 filter `status === 'locked'`），`applyTimeframeScopeBindingFailClosed` 也不强制 owner ref（因 supportedScopeIds 集合不包含 open scope）。当用户填齐参数 status 转 'locked' → readiness 下一轮 normalize 立即 cascading 检查所有 owner ref：缺 ref 即触发 missing_binding。golden corpus Section B 加 1 case 验证：scope status='open' + owner 无 ref → ok=true（无 missing_binding）；同 scope 改 'locked' → 立刻冒出 missing_binding。

`normalize()` 末尾在 `applySymbolScopeBindingFailClosed` 之后串联调用：

```ts
const symbolBound = applySymbolScopeBindingFailClosed(baseNextState)
const timeframeBound = applyTimeframeScopeBindingFailClosed(symbolBound.state)
return {
  state: timeframeBound.state,
  ready: ... && !symbolBound.hasBlockingSlots && !timeframeBound.hasBlockingSlots,
  ...
}
```

### 4.4 Canonical Spec Builder（`canonical-spec-builder.service.ts`）

在已有 `buildOrchestrationScopes`（symbol）相邻位置加 timeframe 分支；输出 `spec.orchestration.scopes[]` 含两类元素；rule.metadata 透传：

```ts
// 现有：symbolScopeRef silent skip 透传 → 同段落加 timeframeScopeRef
const timeframeScopeIds = new Set<string>(
  state.orchestration?.nodes
    ?.filter(n => n.kind === 'scope' && n.key === 'scope.timeframe' && n.status === 'locked')
    .map(n => n.id) ?? []
)
const timeframeScopeRef = readSilentTimeframeScopeRef(owner, timeframeScopeIds)
if (timeframeScopeRef) metadata.timeframeScopeRef = timeframeScopeRef
```

**dataRequirements 一致性（A4b）**：spec builder 在输出末尾对 `spec.dataRequirements.requiredTimeframes` 做合并 union dedup：

```ts
private mergeTimeframeScopeIntoDataRequirements(spec: CanonicalStrategySpecV2): void {
  const tfScopes = (spec.orchestration?.scopes ?? [])
    .filter((s): s is CanonicalOrchestrationTimeframeScope => s.scopeKind === 'timeframe')
  if (tfScopes.length === 0) return
  const tfSet = new Set<string>(spec.dataRequirements.requiredTimeframes)
  for (const tfScope of tfScopes) {
    tfSet.add(tfScope.primaryTimeframe)
    tfScope.requiredTimeframes.forEach(tf => tfSet.add(tf))
  }
  // 按 ms 升序稳定排序，保证 spec 输出 deterministic
  spec.dataRequirements.requiredTimeframes = [...tfSet].sort((a, b) => parseTimeframeMs(a)! - parseTimeframeMs(b)!)
}
```

理由：既有 backtest 路径（`backtest-runner.service.ts` resolveRequiredHtfTimeframes）从 `dataRequirements.requiredTimeframes` 派生 HTF 拉数；若 scope.timeframe 声明的 tf 不写入 dataRequirements，runner 不会拉对应数据 → runtime 永远 `required_missing` fail-closed。合并后既有 backtest 拉数自动覆盖。

**ID 命名空间隔离**：scope 节点 ID 已具备命名空间分隔（`orchestration-scope-symbol-N` vs `orchestration-scope-timeframe-N`），spec builder 不需额外处理。

### 4.5 IR Compiler（`canonical-spec-v2-ir-compiler.service.ts`）

`compileOrchestrationScopes` 升级支持 union：

```ts
private compileOrchestrationScopes(spec: CanonicalStrategySpecV2): IrOrchestrationScope[] {
  const scopes = spec.orchestration?.scopes ?? []
  return scopes.map((scope): IrOrchestrationScope => {
    if (scope.scopeKind === 'symbol') return { id: scope.id, scopeKind: 'symbol', symbols: [...scope.symbols].sort(), ... }
    return {
      id: scope.id, scopeKind: 'timeframe',
      primaryTimeframe: scope.primaryTimeframe,
      requiredTimeframes: [...scope.requiredTimeframes].sort(),
      alignmentPolicy: scope.alignmentPolicy,
    }
  })
}
```

`compileRuleMetadata` 增加 `timeframeScopeRef?` 透传（与 `symbolScopeRef?` 同段落）。

### 4.6 AST Compiler / Emitter / Parser

- **AST compiler**：`canonical-strategy-ast-compiler.service.ts` 已透传 `orchestrationScopes`，类型自动随 union 升级；`DecisionProgramNode.metadata.timeframeScopeRef` 透传与 `symbolScopeRef` 平行。
- **Emitter**：`compiled-script-emitter.service.ts` 已有 `ORCHESTRATION_SCOPES` 兼容路径（仅当 `length > 0` 输出常量）。验证：单 scope.symbol（无 timeframe）旧 ast 字节等价 spec 仍通过。
- **Parser**：`compiled-script-parser.service.ts` 透传不变。
- 不破坏 spec：`compiled-script-emitter-scope-byte-equal.spec.ts`（S2 落地）扩 1 个 case：含 scope.timeframe 的 ast 经 emit/parse round-trip 后 `structuralDigest` 稳定。

### 4.7 Compiled Runtime（`packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`）

#### 4.7.1 类型扩展

```ts
export interface CompiledTimeframeScope {
  id: string
  scopeKind: 'timeframe'
  primaryTimeframe: string
  requiredTimeframes: readonly string[]
  alignmentPolicy: 'strict' | 'tolerant'
}
export interface CompiledSymbolScope {  // 抽出现有
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}
export type CompiledOrchestrationScope = CompiledSymbolScope | CompiledTimeframeScope
```

`StrategyExecutionContextV1` 在 `packages/shared/src/strategy-protocol.ts` 增加：

```ts
/**
 * Phase 5 S3 (#1109): 多周期 scope.timeframe 数据对齐
 * key 是 timeframe identifier ('1m'|'5m'|'15m'|...)；val 是 caller 已收 bar 状态
 * 单周期 / 无 scope.timeframe 节点策略不注入；runtime 自动跳过 alignment 检查
 */
timeframeBarStatus?: Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }>
```

#### 4.7.2 helper — 单一 source-of-truth（critic Round 2 M2-R2 修正）

避免双 white-list drift 风险，**packages/shared 持唯一权威 mapping**（quantify types 反向 import）：

```ts
// packages/shared/src/script-engine/compiled-runtime/parse-timeframe-ms.ts （新文件）
export const TIMEFRAME_MS: Readonly<Record<string, number>> = Object.freeze({
  '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000, '6h': 21_600_000,
  '8h': 28_800_000, '12h': 43_200_000,
  '1d': 86_400_000, '3d': 259_200_000, '1w': 604_800_000,
})

// quantify types/semantic-state.ts 反向 import 派生
// import { TIMEFRAME_MS } from '@ai/shared/script-engine/compiled-runtime/parse-timeframe-ms'
// export const SEMANTIC_SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAME_MS)) as readonly (keyof typeof TIMEFRAME_MS)[]

export function parseTimeframeMs(tf: string): number | null {
  return Object.prototype.hasOwnProperty.call(TIMEFRAME_MS, tf) ? TIMEFRAME_MS[tf] : null
}
```

readiness `validateTimeframeScopeNode` 与 NL gateway 都用 `parseTimeframeMs` 校验 timeframe 合法性；`TIMEFRAME_FORMAT_PATTERN` 仅在需要正则匹配的场景（如 NL parser）使用，由 `Object.keys(TIMEFRAME_MS)` 派生 OR 串拼。

加 spec：`parse-timeframe-ms.spec.ts` 单测 14 项 vocab 全部 round-trip + 未知 tf 返回 null + 原型链污染防御（`__proto__` / `constructor`）。

**drift gate 已消解**（M1-R2 / M2-R2 合并修复）——单一权威常量，无需双 source 对齐 spec。

#### 4.7.3 alignment routing — bar-bucket 比较（不用 ms lag）

**Critical 修正**（plan critic Round 1 C3）：用 bar-bucket 对齐取代 ms lag 公式。每根 required tf 已收 bar 落在哪个时间 bucket（`bucket(ts) = Math.floor(ts / requiredDurationMs)`）；strict 要求 primary 与 required 同 bucket，tolerant 容忍 1 bucket 落后。

```ts
export function applyTimeframeScopeAlignment(
  program: { metadata?: { timeframeScopeRef?: string } },
  ctx: StrategyExecutionContextV1,
  scopes: readonly CompiledOrchestrationScope[] | undefined,
): 'continue' | StrategyDecisionV1 {
  const timeframeScopes = (scopes ?? []).filter(
    (s): s is CompiledTimeframeScope => s.scopeKind === 'timeframe',
  )
  if (timeframeScopes.length === 0) return 'continue'

  // 任意数量 timeframe scope 都强制 program 显式 ref（与 §4.3 readiness ≥1 强制呼应；§4.7.3 决策表与 §4.3 同步）
  const refRaw = program.metadata?.timeframeScopeRef
  const ref = typeof refRaw === 'string' ? refRaw.trim() : ''
  if (ref === '') return failClosed('unbound_program')

  const activeScope = timeframeScopes.find(s => s.id === ref)
  if (!activeScope) return failClosed('unknown_scope')

  const status = (ctx as { timeframeBarStatus?: Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }> }).timeframeBarStatus
  if (!status) return failClosed('data_unavailable')

  const primary = status[activeScope.primaryTimeframe]
  if (!primary || !Number.isFinite(primary.lastClosedBarTs)) return failClosed('primary_missing')

  for (const requiredTf of activeScope.requiredTimeframes) {
    const required = status[requiredTf]
    if (!required || !Number.isFinite(required.lastClosedBarTs)) return failClosed('required_missing')

    const requiredDurationMs = parseTimeframeMs(requiredTf)
    if (requiredDurationMs === null || requiredDurationMs <= 0) return failClosed('required_missing')

    // bar-bucket 比较：bucket(ts) = floor(ts / requiredDurationMs)
    //   strict   : primaryBucket === requiredBucket（同 required tick 内）
    //   tolerant : primaryBucket - requiredBucket ≤ 1（required 容许落后 1 根 required bar）
    // 前置条件（A2.4f readiness 已 fail-closed 保证）：parseTimeframeMs(primary) < parseTimeframeMs(required)。
    //   primary tf 严格比 required 细，所以 primary.lastClosedBarTs 总 >= required.lastClosedBarTs；
    //   bucketDiff 总是 >= 0（primaryBucket 不可能比 requiredBucket 小）。
    const primaryBucket = Math.floor(primary.lastClosedBarTs / requiredDurationMs)
    const requiredBucket = Math.floor(required.lastClosedBarTs / requiredDurationMs)
    const bucketDiff = primaryBucket - requiredBucket
    const maxBucketDiff = activeScope.alignmentPolicy === 'strict' ? 0 : 1
    if (bucketDiff > maxBucketDiff) {
      return failClosed('alignment_lag', { required: requiredTf, primaryBucket, requiredBucket, bucketDiff })
    }
  }

  return 'continue'

  function failClosed(stage: string, meta?: Record<string, unknown>): StrategyDecisionV1 {
    return {
      action: 'NOOP',
      reason: `compiled.orchestration.scope.timeframe.fail_closed.${stage}`,
      ...(meta ? { meta } : {}),
    }
  }
}
```

**bucket 数学证明（spec 必须覆盖）**：

设 primary=15m, required=1h（requiredDurationMs=3,600,000ms）：
- 14:00 primary bar close（ts=14:00:00.000）+ 14:00 required bar close（ts=14:00:00.000）→ primaryBucket = 14, requiredBucket = 14 → diff=0 → strict ✓ tolerant ✓
- 14:15 primary bar close（ts=14:15:00.000，bucket=14）+ required 还停在 13:00（ts=13:00:00.000，bucket=13）→ diff=1 → strict ✗ tolerant ✓
- 15:15 primary（ts=15:15:00.000，bucket=15）+ required 停在 13:00（bucket=13）→ diff=2 → strict ✗ tolerant ✗
- 15:00 primary（bucket=15）+ required 15:00 收（bucket=15）→ diff=0 → 都通过

每个边界都有对应的 spec case（apply-timeframe-scope-alignment.spec.ts T6）。

**与 §4.3 readiness 一致**：runtime 不做 ambient 兜底，readiness 强制 ≥1 timeframe scope 时 owner 必须显式绑 ref；两侧约束闭合，不存在"readiness 通过但 runtime fail-closed unbound_program"的不一致路径。

#### 4.7.4 主循环接入

`runDecisionPrograms` 主循环序：S2 symbol routing → S3 timeframe alignment → guard check → ...

```ts
for (const program of orderedPrograms) {
  const symbolRouting = applySymbolScopeRouting(program, ctx, orchestrationScopes)
  if (symbolRouting === 'skip') continue
  if (symbolRouting !== 'continue') {
    return Object.freeze(applyOrchestrationGate(symbolRouting, ...))
  }

  // S3 alignment（在 symbol routing 之后；alignment 失败也走 applyOrchestrationGate 二次包裹）
  const timeframeAlignment = applyTimeframeScopeAlignment(program, ctx, orchestrationScopes)
  if (timeframeAlignment !== 'continue') {
    return Object.freeze(applyOrchestrationGate(timeframeAlignment, orchestrationGateState, portfolioRiskState, ctx))
  }

  // ... 后续不变
}
```

`runDecisionPrograms` 入参签名维持不变（`orchestrationScopes` 已存在）；`StrategyExecutionContextV1` 字段加 optional `timeframeBarStatus`，旧 caller 不传不影响。

### 4.8 Caller 层（backtest 完整接通 + live publication-gate 防呆）

#### 4.8.1 共用 helper

`packages/shared/src/script-engine/helpers/build-timeframe-bar-status.ts`（新建）：

```ts
import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledOrchestrationScope } from '../compiled-runtime'

/**
 * Phase 5 S3 (#1109): 从 ctx.data 派生 timeframeBarStatus
 *
 * 字段事实（#1107 caller 路径已具备）：
 *   - ctx.legs[0]?.id 默认 'primary'（backtest-runner.service.ts:959 注入）
 *   - ctx.data[legId][tf].bars 是 packages/shared Bar[]（{open,high,low,close,volume,timestamp}）
 *   - bar.timestamp 是毫秒（与 backtest-runner.service.ts:990 ts: bar.closeTime 同源）
 *
 * 缺失策略：
 *   - 任一 required tf 在 ctx.data 缺失或 bars 为空 → 不写入对应 tf 状态，runtime 自然 required_missing
 *   - 全部 tf 缺失 → 返回 undefined，runtime 走 data_unavailable
 */
export function buildTimeframeBarStatus(
  ctx: StrategyExecutionContextV1,
  scopes: readonly CompiledOrchestrationScope[],
): Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }> | undefined {
  const tfScopes = scopes.filter(s => s.scopeKind === 'timeframe')
  if (tfScopes.length === 0) return undefined

  const allTimeframes = new Set<string>()
  for (const s of tfScopes) {
    if (s.scopeKind === 'timeframe') {
      allTimeframes.add(s.primaryTimeframe)
      s.requiredTimeframes.forEach(tf => allTimeframes.add(tf))
    }
  }

  const legId = ctx.legs?.[0]?.id ?? 'primary'
  const legData = ctx.data?.[legId] ?? {}
  const status: Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }> = {}
  for (const tf of allTimeframes) {
    const bars = legData[tf]?.bars
    const last = Array.isArray(bars) && bars.length > 0 ? bars[bars.length - 1] : null
    if (!last || !Number.isFinite(last.timestamp)) continue  // 缺失 → 不写入
    status[tf] = { lastClosedBarTs: last.timestamp, lastClosedBarIndex: bars.length - 1 }
  }
  return Object.keys(status).length > 0 ? status : undefined
}
```

#### 4.8.2 Backtest 路径（本 PR 完整接通）

`backtest-strategy-adapter.service.ts` 在 spawn `runDecisionPrograms` 前注入：

```ts
const tfBarStatus = buildTimeframeBarStatus(ctx, projection.orchestrationScopes ?? [])
const ctxWithStatus = tfBarStatus !== undefined ? { ...ctx, timeframeBarStatus: tfBarStatus } : ctx
runDecisionPrograms(ctxWithStatus, programs, exprValues, guardState, decisionOrder, gateState, riskState, projection.orchestrationScopes)
```

backtest-runner 现有 `ctx.data[primaryLegId='primary'][tf].bars` 路径完整可用——helper 直接消费。

#### 4.8.3 Live 路径（本 PR 防呆 + follow-up issue）

事实约束（plan critic Round 1 C2 已验证）：`signal-generation-decision.stage.ts:454-481` `buildPublishedStrategyContext` 调用 single-leg `buildStrategyContext()`，返回 ctx 不含 `data` 字段——live 端目前没有多 timeframe 数据通道。

本 PR 处理方案——**两层防呆**：

1. **runtime 层（被动 fail-closed）**：live 路径走 `buildPublishedStrategyContext`，`ctx.data` 默认未设；helper 返回 `undefined` → runtime 自动走 `data_unavailable` fail-closed（NOOP），不会静默通过。
2. **publication 层（主动拒部署）—— critic Round 2 C1-R2 / M3-R2 锁定落点**：增加 `validateScopeTimeframeLiveDeployable(spec, deploymentTarget)`，当 `spec.orchestration.scopes` 含 `scopeKind: 'timeframe'` + 部署 target 是 live → 抛 `DomainException(ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED)`：
   - 新 ErrorCode：`packages/shared/src/constants/error-codes.ts` 加 `ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED`
   - 新 DomainException 子类：`apps/quantify/src/modules/llm-strategy-codegen/exceptions/scope-timeframe-live-unsupported.exception.ts` + spec
   - **publication gate 主落点**：`apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts` 的 `deployStrategy(dto)` 方法（line 1159）—— 这是用户 click deploy 的实际入口；调用顺序：`deployStrategy → resolveDeployPayload → repo.deployStrategyForUser`（line 1191/1236）。在 `resolveDeployPayload` 完成 spec 解析后、`repo.deployStrategyForUser` 写库前，调用 `validateScopeTimeframeLiveDeployable(spec, deployTarget='LIVE')` 拒抛
   - **不要把 gate 放到 `signal-generator.service.ts`**：那是 per-bar runtime 路径，部署已落库，gate 失效
   - **不要把 gate 放到 codegen-publication-persistence**：那是 publish-snapshot 时机，发生在用户 deploy **之前**——用户可能 publish snapshot 但只用于 backtest，等到 deploy 才走 live
   - 既有 deploy spec 文件 `account-strategy-view-deploy-safety.spec.ts` 扩 1+ case：scope.timeframe spec + mode='LIVE' → DomainException；mode='BACKTEST' 不抛
   - 用户消息：`scope.timeframe 策略目前仅支持 backtest，live 部署待 #1110 多周期数据 feed 接入`

backtest 路径不受影响——backtest 调用栈不经过 `account-strategy-view.deployStrategy`。

#### 4.8.4 follow-up issue 占位

S3 落地后立即创建 follow-up issue（plan §11 列出）描述 live 端完整接入：
- 扩 `buildPublishedStrategyContext` 接受 `multiLegData` 入参（沿用 `buildResolvedStrategyContextForMultiLeg` line 553-578 已建立的 multi-leg snapshot pattern）
- 接通 published strategy snapshot loader 到 multi-tf bars 拉取
- live publication gate 移除拒部署逻辑

这与 S2 #1108 fan-out caller follow-up 同优先级。

### 4.9 NL Gateway（`natural-language-gateway.service.ts`）

新增 `parseTimeframeScope(text): TimeframeScopeFrameDraft[]`，双门槛：

1. **Timeframe vocab 命中**：扫描出所有 `\b(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)\b`（不区分大小写），去重；至少 **2 个不同** timeframe（primary + ≥1 required）。
2. **触发短语精准多 OR**：**锁定到 scope-binding 词组**，移除与 `strategy.multi_timeframe` HTF filter atom（#1008）撞车的"高周期"/"低周期"/"周期过滤"等高频汉字组合：

```ts
const triggerPattern = /(主周期|执行周期|主时间框架|primary\s+timeframe|primary\s+tf|多周期\s*scope|多时间框架\s*scope|multi[-\s]?timeframe\s+scope|严格对齐|strict\s+alignment|宽松对齐|tolerant\s+alignment|require[ds]?\s+timeframes?|依赖周期)/iu
```

理由：
- 移除 "多周期"（无 scope 后缀）：单独"多周期"是 multi_timeframe atom 的高频触发词
- 移除 "高周期"/"低周期"/"周期过滤"：是 HTF filter atom 的核心 utterance（multi-timeframe-htf-filter.spec.ts case "1h 高周期过滤 15m 信号"）
- 保留必须含 "scope"/"主周期"/"执行周期"/"严格对齐"/"宽松对齐"/"依赖周期"等 scope-binding 强信号；HTF filter utterance 不会命中

primary 提取顺序：
1. 扫描 `/(?:主周期|执行周期|主时间框架|primary\s+(?:timeframe|tf)|执行)\s*[:：是为]?\s*[（(]?\s*(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)/iu` 命中——这是显式声明
2. 若无显式声明，按文本顺序取扫描出的第 1 个 timeframe vocab 作为 primary（约定：execution tf 通常先出现）；缺时取最小 timeframe

required = 总 timeframe set 减 primary（若 primary 提取失败 → frame 不产生）

alignmentPolicy 提取：
- `/(严格对齐|strict\s+alignment)/iu` → `'strict'`
- `/(宽松对齐|tolerant\s+alignment|loose\s+alignment)/iu` → `'tolerant'`
- 默认 → `'strict'`（**critic Round 1 C4 修正**；与 fail-closed 主张一致；utterance 显式 tolerant 才放宽）

`parse()` 入口数组新增 `...this.parseTimeframeScope(text)`，与 `parseSymbolScope(text)` 平级。

#### 4.9.1 6 positive fixture + 2 negative

```
F1 "用 15m 主周期，1h 和 4h 做 scope 依赖周期" → primary=15m, required=[1h,4h], strict
F2 "Primary timeframe 15m, required timeframes 1h and 4h" → primary=15m, required=[1h,4h], strict
F3 "执行周期 5m，依赖周期 15m 1h 严格对齐" → primary=5m, required=[15m,1h], strict
F4 "主周期 1h，依赖周期 4h 1d 宽松对齐" → primary=1h, required=[4h,1d], tolerant
F5 "Multi-timeframe scope: primary 5m, required 15m + 1h" → primary=5m, required=[15m,1h], strict
F6 "执行 15m，多时间框架 scope 1h + 4h，strict alignment" → primary=15m, required=[1h,4h], strict
N1 "只用 15m 一个周期" → 不产 frame（仅 1 timeframe）
N2 "1h 高周期过滤 15m 信号，价格高于 EMA20 才允许做多" → 不产 frame（HTF filter atom utterance；触发短语不命中 scope-binding 词组）
N3 "BTCUSDT 主标的，ETHUSDT 跟随，均线金叉" → 不产 timeframe_scope frame（symbol_scope utterance；不含 timeframe vocab + 触发短语；critic Round 2 m3-R2）
```

每个 fixture 在 golden corpus Section A 写 spec 断言。

### 4.10 Frame Normalizer（`semantic-frame-normalizer.service.ts`）

新增 `case 'timeframe_scope'` 分支与 `normalizeTimeframeScope(frame, index)` helper（镜像 `normalizeSymbolScope`）：

```ts
private normalizeTimeframeScope(frame: SemanticTimeframeScopeFrame, index: number): CodegenSemanticOrchestrationTimeframeScopeNodePatch {
  // critic Round 1 C4: 默认 strict（与 fail-closed 主张一致；utterance 显式 tolerant 才放宽）
  const alignmentPolicy = frame.alignmentPolicy ?? 'strict'
  return {
    id: `orchestration-scope-timeframe-${index + 1}`,
    kind: 'scope',
    key: 'scope.timeframe',
    params: {
      primaryTimeframe: frame.primaryTimeframe,
      requiredTimeframes: [...frame.requiredTimeframes],
      alignmentPolicy,
    },
    timeframeScopeKind: 'timeframe',
    primaryTimeframe: frame.primaryTimeframe,
    requiredTimeframes: [...frame.requiredTimeframes].sort((a, b) => parseTimeframeMs(a)! - parseTimeframeMs(b)!),
    alignmentPolicy,
    evidence: this.toEvidence(frame),
  }
}
```

dedupeKey = `JSON.stringify([node.key, node.primaryTimeframe, [...node.requiredTimeframes].sort(), node.alignmentPolicy])`。

`orchestrationNodes` 拼装末尾追加 `...Array.from(timeframeScopeByKey.values())`。

### 4.11 Presentation Registry（`semantic-presentation-registry.service.ts`）

新增 entry：

```ts
presentation({
  key: 'scope.timeframe',
  publicName: '周期范围',
  aliases: ['多周期范围', '多时间框架', 'timeframe scope', '周期作用域'],
  positiveExamples: [
    '15 分钟主周期，1 小时和 4 小时做趋势过滤',
    '执行周期 5m，参考 15m 1h 多时间框架',
    '主周期 1h，依赖 4h 1d 严格对齐',
  ],
  negativeExamples: ['只用 15 分钟一个周期', '随便几个周期都行'],
  goldenUtterances: [
    '15m 主周期 + 1h 4h 高周期过滤',
    'Primary timeframe 15m, higher timeframes 1h and 4h',
  ],
  displayRenderer: ({ params }) => renderTimeframeScope(params),
  clarificationRenderer: (slotKey) => renderTimeframeScopeClarification(slotKey),
}),
```

`renderTimeframeScope(params)`：用 display token `atom.scope.timeframe.display.with_required` 渲染。

`renderTimeframeScopeClarification(slotKey)`：handle slot keys：
- `orchestration.scope.timeframe.primary_timeframe` → `请确认执行周期（主周期）`
- `orchestration.scope.timeframe.required_timeframes` → `请确认依赖周期列表（≥1 个）`
- `orchestration.scope.timeframe.alignment_policy` → `请确认对齐严格度（strict / tolerant）`
- `orchestration.scope.timeframe.missing_binding` → `请确认该规则绑定到哪个 timeframe scope`

### 4.12 Display Token Table（`nl-gateway/display-registry/display-token-table.ts`）

新增 entries（与 S2 scope.symbol 对位）：

```ts
{ key: 'atom.scope.timeframe.name', kind: 'atom', zh: '周期范围' },
{ key: 'atom.scope.timeframe.display.with_required',
  kind: 'atom',
  zh: '周期范围：主 {primaryTimeframe}，依赖 {requiredTimeframes}（{alignmentPolicy}）' },
{ key: 'slot.orchestration.scope.timeframe.primary_timeframe', kind: 'slot', zh: '请确认执行周期（主周期）' },
{ key: 'slot.orchestration.scope.timeframe.required_timeframes', kind: 'slot', zh: '请确认依赖周期列表（≥1 个）' },
{ key: 'slot.orchestration.scope.timeframe.alignment_policy', kind: 'slot', zh: '请确认对齐严格度（strict / tolerant）' },
{ key: 'slot.orchestration.scope.timeframe.missing_binding', kind: 'slot', zh: '请确认该规则绑定到哪个 timeframe scope' },
```

### 4.13 Module Wiring

`SemanticOrchestrationRegistryService` 已注册到 `LlmStrategyCodegenModule`，本 PR 无新 service / module 注册。

---

## 5. Files

### Create

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-timeframe-scope-golden-corpus.spec.ts` — 6 段 golden corpus（A：NL pipeline、B：Readiness fail-closed、C：Display 不泄漏、D：canonical → IR → AST 全链路、E：runtime alignment fail-closed、F：backtest parity）
- `packages/shared/src/script-engine/compiled-runtime/apply-timeframe-scope-alignment.spec.ts` — 单测（runtime alignment 决策表 ≥10 case + bucket diff 边界）
- `packages/shared/src/script-engine/compiled-runtime/parse-timeframe-ms.spec.ts` — 单测（14 项 round-trip + 未知 tf null + 原型链污染防御 + drift gate 与 SEMANTIC_SUPPORTED_TIMEFRAMES 等价）
- `packages/shared/src/script-engine/helpers/build-timeframe-bar-status.ts` + `.spec.ts` — caller 共用 ctx 注入 helper（覆盖 leg id 默认 / multi-leg / 缺数据 fall-through）
- `apps/quantify/src/modules/llm-strategy-codegen/exceptions/scope-timeframe-live-unsupported.exception.ts` + `.spec.ts` — DomainException 子类（T6b live publication gate）

### Modify（只列与 S3 直接相关的；S0a/S2 substrate 字段不动）

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts` — 新增 timeframe 类型 + `SemanticOrchestrationNode` timeframe 字段 + owner 节点 `timeframeScopeRef?`
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts` — `CodegenSemanticOrchestrationTimeframeScopeNodePatch`
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts` — `SemanticTimeframeScopeFrame`
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts` — `CanonicalOrchestrationScope` union 升级 + rule.metadata.timeframeScopeRef
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts` — `IrOrchestrationScope` union 升级 + RuleBlock.metadata.timeframeScopeRef
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts` — `DecisionProgramNode.metadata.timeframeScopeRef?`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts` — 注册 `scope.timeframe` contract + `validateTimeframeScopeNode`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts` — `isSupportedTimeframeScope` + `applyTimeframeScopeBindingFailClosed` + dispatch + `normalize()` 串联
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` — 输出 `spec.orchestration.scopes[]` timeframe 子项 + rule.metadata.timeframeScopeRef
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` — `compileOrchestrationScopes` union 适配 + rule metadata 透传
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts` — `parseTimeframeScope`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts` — `case 'timeframe_scope'` + `normalizeTimeframeScope`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts` — `scope.timeframe` entry + renderers
- `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/display-registry/display-token-table.ts` — 6 个 token entries
- `packages/shared/src/strategy-protocol.ts` — `StrategyExecutionContextV1.timeframeBarStatus?`
- `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts` — `CompiledTimeframeScope` + `applyTimeframeScopeAlignment`（bar-bucket 数学）+ 主循环接入
- `packages/shared/src/script-engine/compiled-runtime.ts` — re-export `CompiledTimeframeScope` / `applyTimeframeScopeAlignment` / `parseTimeframeMs`
- `packages/shared/src/constants/error-codes.ts` — 新增 `ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED`
- `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts` — caller 注入 `ctx.timeframeBarStatus`（backtest 完整接通）
- `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts` — `deployStrategy` 在 `resolveDeployPayload` 后、`repo.deployStrategyForUser` 前调用 `validateScopeTimeframeLiveDeployable(spec, mode='LIVE')`（critic Round 2 C1-R2 锁定）
- `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts` — 扩 1+ case：scope.timeframe spec + mode='LIVE' 抛 `ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED`；mode='BACKTEST' 不抛
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter-scope-byte-equal.spec.ts` — 扩 2 case：(a) 仅含 symbol scope 旧 ast 字节稳定（S2 不回归）；(b) 含 timeframe scope ast emit/parse round-trip structuralDigest 稳定
- `apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/timeframe-vocab-drift.spec.ts` （已被 M2-R2 修复合并到单一 source 后**移除**——drift gate 不再需要）

---

## 6. 任务序列

| # | Task | 描述 | 文件 | Commit msg |
|---|------|------|------|------------|
| T1 | types | semantic-state / patch / frame / canonical / IR / AST timeframe 字段 + owner 节点 timeframeScopeRef + protocol ctx 字段 + ErrorCode | 7 个 types + protocol + error-codes.ts | `feat(ai-quant): #984 Phase 5 S3 T1 - semantic types for scope.timeframe` |
| T2 | registry | scope.timeframe contract + validateTimeframeScopeNode 9 重 fail-closed | registry.service.ts | `feat(ai-quant): #984 Phase 5 S3 T2 - register scope.timeframe contract` |
| T3 | readiness | isSupportedTimeframeScope（8 重）+ applyTimeframeScopeBindingFailClosed（≥1 强制）+ dispatch + S2 共存 spec | readiness.service.ts | `feat(ai-quant): #984 Phase 5 S3 T3 - readiness gate for scope.timeframe` |
| T4 | spec builder | spec.orchestration.scopes timeframe 输出 + rule metadata 透传 + mergeTimeframeScopeIntoDataRequirements | canonical-spec-builder.service.ts | `feat(ai-quant): #984 Phase 5 S3 T4 - canonical spec timeframe scope output` |
| T5 | IR compiler | compileOrchestrationScopes union 适配 + rule metadata 透传 | canonical-spec-v2-ir-compiler.service.ts | `feat(ai-quant): #984 Phase 5 S3 T5 - IR compiler timeframe scope` |
| T6 | runtime | CompiledTimeframeScope + parseTimeframeMs + applyTimeframeScopeAlignment（bar-bucket 比较）+ 主循环接入 + 单测 + drift gate spec | run-decision-programs.ts + apply-timeframe-scope-alignment.spec.ts | `feat(ai-quant): #984 Phase 5 S3 T6 - runtime alignment fail-closed` |
| T6a | backtest caller | build-timeframe-bar-status helper + backtest adapter 注入 | helpers/build-timeframe-bar-status.ts + backtest adapter | `feat(ai-quant): #984 Phase 5 S3 T6a - backtest caller wires timeframeBarStatus` |
| T6b | live publication gate | DomainException 子类 + ErrorCode 上线 + `validateScopeTimeframeLiveDeployable` 接入 `account-strategy-view.service.ts deployStrategy()`（critic Round 2 C1-R2 锁定）+ deploy-safety spec 扩 1+ case | scope-timeframe-live-unsupported.exception.ts + spec + account-strategy-view.service.ts + account-strategy-view-deploy-safety.spec.ts | `feat(ai-quant): #984 Phase 5 S3 T6b - live publication gate at deployStrategy` |
| T7 | NL gateway | parseTimeframeScope（双门槛 + 锁定 scope-binding 词组）+ frame normalizer（默认 strict） | natural-language-gateway.service.ts + semantic-frame-normalizer.service.ts | `feat(ai-quant): #984 Phase 5 S3 T7 - NL gateway parseTimeframeScope` |
| T8 | presentation | scope.timeframe entry + renderers + display tokens（8 个） | semantic-presentation-registry.service.ts + display-token-table.ts | `feat(ai-quant): #984 Phase 5 S3 T8 - presentation entry` |
| T9 | byte-equal | emitter byte-equal spec 扩 2 case（含 timeframe scope round-trip + 仅 symbol scope 字节不变） | compiled-script-emitter-scope-byte-equal.spec.ts | `test(ai-quant): #984 Phase 5 S3 T9 - emitter scope byte-equal extends timeframe` |
| T10 | golden corpus | 6 段集成 spec 覆盖 NL/Readiness/Display/IR-AST/runtime/parity ≥ 8 case + 3 negative | orchestration-timeframe-scope-golden-corpus.spec.ts | `test(ai-quant): #984 Phase 5 S3 T10 - golden corpus 6 sections` |
| T11 | regression | dx lint + dx build quantify --dev + 受影响 unit + golden + parity + contracts diff | — | （verification gate；不产 commit；失败反馈到 T12） |
| T12 | fix-up | critic 反馈或回归失败修复 | — | `fix(ai-quant): #984 Phase 5 S3 fix-up - <topic>` |

每 task 完成 commit；commit msg 末尾必须 `Refs: #984` `Refs: #1109`（可选 `Refs: #1107`）。

---

## 7. 不破 userspace 论证

1. **单周期旧策略 IR digest 稳定**：`orchestrationScopes` 仅当 spec 有 scope 节点才输出；`structuralDigest` 不变（emitter 兼容路径已落地，S2 已验证；S3 扩 union 不影响 emit/parse 字节）。byte-equal spec 扩 1 case 验证含 timeframe scope 路径 round-trip 稳定。
2. **owner 节点 ref 全 optional**：`timeframeScopeRef?` 与 `symbolScopeRef?` 平行，旧 spec snapshot 不变。
3. **runtime 主循环零侵入旧路径**：`applyTimeframeScopeAlignment` 仅在 `scopes` 含 timeframe 子项时检查；空 / 仅 symbol scope 立即 `'continue'`。
4. **ctx.timeframeBarStatus 全 optional**：旧 caller 不注入，runtime 即使误读也走 `data_unavailable` fail-closed；但因前一步空判断已经 short-circuit，不会触发该路径。
5. **NL gateway 永不兜底**：`parseTimeframeScope` 双门槛（≥2 不同 tf vocab + 触发短语）；歧义 utterance（如"随便几个周期"）不产 frame。
6. **多 timeframe scope 部署当前不会落到产线 strategy**：main readiness 此 PR 落地前不允许 `scope.timeframe` 通过 phase0 unsupported；本 PR 解锁后 NL → readiness → IR → AST → runtime 全链路单 PR 可执行（与 S2 substrate 不同：S2 解锁后还需要 #1108 fan-out caller；S3 caller wiring 在 T6a 内完成，无 follow-up 阻塞）。
7. **strategy.multi_timeframe HTF filter atom（#1008）不变**：那是 trigger 层 atom 表"高周期信号过滤"语义（在 expr pool 编进 EXPRESSION_GUARD）；scope.timeframe 是节点对 timeframe 的 declarative binding（在 runtime alignment 层）。两者并存、互不替代。`multi-timeframe-htf-filter.spec.ts` 既有 28 个测试 0 改动。
8. **api-contracts swagger schema 不变**：scope.timeframe 是后端内部语义字段，未通过 OpenAPI 暴露；CI gate `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出 0。

---

## 8. 风险与边界

| 风险 | 缓解 |
|------|------|
| `parseTimeframeMs` 漏 timeframe vocab 导致 alignment 判错 | 单一来源映射 14 项 + drift gate spec（`TIMEFRAME_MS` key set 与 `SEMANTIC_SUPPORTED_TIMEFRAMES` 长度+成员相等）+ 单测覆盖每项 round-trip + 未知 tf 返回 null + 原型链污染防御 |
| caller 派生的 `timeframeBarStatus` 字段错认 | **critic Round 1 C1 修正**：packages/shared `Bar` 字段事实是 `{open,high,low,close,volume,timestamp}`，**无** openTime/closeTime；helper 用 `bar.timestamp`（毫秒；与 backtest-runner.service.ts:990 `ts: bar.closeTime` 同源）；`ctx.data` 索引是 leg id（默认 `'primary'`，非 symbol）；helper spec 覆盖 leg id 默认值 / multi-leg 场景 |
| `alignmentPolicy` 'tolerant' 容忍幅度问题 | **critic Round 1 C3 修正**：用 bar-bucket 比较取代 ms lag；strict bucket diff = 0，tolerant bucket diff ≤ 1；spec 覆盖 4 个边界 case（diff=0 strict ✓ tolerant ✓；diff=1 strict ✗ tolerant ✓；diff=2 都 ✗；不可能 diff < 0） |
| timeframe scope owner 未绑定时的兜底语义 | **critic Round 1 M4 修正**：S3 与 S2 在 binding 强制阈值上**显式分歧**——S3 ≥1 timeframe scope 即强制 owner 显式 ref（不要 ambient）；理由：alignment 是 per-program 决策，binding 不可省略；§4.3 readiness 与 §4.7.3 runtime 两侧约束闭合 |
| ctx.timeframeBarStatus 注入 cost | helper 仅扫描已存在 `ctx.data?.[legId]?.[tf]?.bars`，不发起 IO；仅 `projection.orchestrationScopes` 含 timeframe scope 时执行；返回 `undefined` 时 caller 不写 ctx.timeframeBarStatus，runtime O(1) short-circuit |
| `scope.timeframe` 与 `scope.symbol` ID 冲突 | 各自命名空间（`orchestration-scope-symbol-N` / `orchestration-scope-timeframe-N`）；frame normalizer dedupe key 与 ID 解耦；2 类共存 spec case 验证 |
| Phase 3 `strategy.multi_timeframe` HTF filter atom（#1008）误命中 | **critic Round 1 M2 修正**：NL gateway 触发短语锁定 scope-binding 词组，移除 "高周期"/"低周期"/"周期过滤"；新增 negative spec："1h 高周期过滤 15m 信号" 不产 timeframe_scope frame；既有 28 个 atom spec 不变 |
| `dataRequirements.requiredTimeframes` 与 scope 声明的 tf 不一致 | **critic Round 1 M6 修正**：spec builder `mergeTimeframeScopeIntoDataRequirements` 把 scope.timeframe 声明的 (primary ∪ required) union dedup 写入 dataRequirements；既有 backtest HTF 拉数路径自动覆盖 |
| Live 路径 `buildPublishedStrategyContext` 不注入多 tf 数据 | **critic Round 1 C2 修正**：本 PR 落 publication-time gate `validateScopeTimeframeLiveDeployable`（拒部署 scope.timeframe 到 live）+ runtime `data_unavailable` 兜底；live 端完整接入跟进 follow-up issue |
| S2 已 ship readiness spec 在 S3 dispatch 改造后回归 | **critic Round 1 C5 修正**：T2 commit 前列 S2 现有 spec 全名清单 + 加 共存 spec（locked symbol + locked timeframe → 互不污染） |

---

## 9. Critic 关注点（自审 → 写给 critic 的引导）

> Round 1 已纠偏：Round 2 critic 应聚焦剩余设计风险与覆盖完整性，不再质疑已修正项。

1. **runtime alignment bar-bucket 数学正确性**（已修正为 bar-bucket 比较）：strict bucket diff = 0；tolerant bucket diff ≤ 1。验证：primary=15m, required=1h，14:00 同 bucket → 通过；14:15 primary + 13:00 required → bucket diff=1（strict 拒，tolerant 通过）；15:15 primary + 13:00 required → bucket diff=2（都拒）。spec 覆盖 4 个边界 case；critic 重点审：bucket 公式是否对 1d / 1w 等大粒度 tf 也成立（floor 在 ms 维度始终安全；spec 加 1d primary + 1w required case）。
2. **caller 注入路径**（已修正为 backtest-only 完整接通 + live publication-gate）：backtest 路径 `ctx.data?.[legId]?.[tf]?.bars` 来自 backtest-runner.service.ts:973-977 注入；live 路径 buildPublishedStrategyContext 不携带多 tf 数据，本 PR 走 publication gate 拒部署。critic 重点审：(a) backtest helper 在 `ctx.legs` 缺失时降级为 `'primary'` 默认 legId 是否正确；(b) publication gate 注入点是否覆盖所有 live deployment 入口（codegen pipeline / strategy template publication / instance deploy）。
3. **alignmentPolicy 默认值**（已修正为 strict）：与 fail-closed 主张一致；utterance 显式 "宽松对齐"/"tolerant" 才落 tolerant。critic 重点审：默认 strict 是否会让 6 个 positive fixture 中 F1/F2/F5/F6 默认走 strict 而 NL UX 上无明显视觉提示？决定：display token `atom.scope.timeframe.display.with_required` 模板含 `（{alignmentPolicy}）` 后缀，让用户看到默认值。
4. **`unbound_program` 策略**（已修正为 任意数量 timeframe scope 都强制显式 ref）：critic 重点审：S3 ≥1 强制是否会让"只有 1 个 timeframe scope" 的策略 UX 反直觉？决定：clarification slot `slot.orchestration.scope.timeframe.missing_binding` 给清晰中文 question hint：`请确认该规则绑定到哪个 timeframe scope（必须显式声明）`。
5. **byte-equal 兼容路径**：S2 已具备 emitter ORCHESTRATION_SCOPES 兼容（length>0 才 emit）。S3 union 升级后：仅 symbol scope 旧 ast → 字节稳定；含 timeframe scope 新 ast → emit/parse round-trip structuralDigest 稳定。emitter byte-equal spec 扩 1 case（T9）。
6. **NL parser 触发短语**（已锁定 scope-binding 词组）：critic 重点审 negative coverage：HTF filter atom utterance、单周期 utterance、symbol_scope utterance 都不应误命中 timeframe_scope；golden corpus N1/N2 必须有，再加 N3 "BTCUSDT 主标的，ETHUSDT 跟随" → 不产 timeframe_scope frame（应只产 symbol_scope）。
7. **parity 测试覆盖**：受 §A11 限制，本 PR 落 backtest 内决策序列稳定 parity（同 spec + 同 ctx.data 注入路径 → 输出相同）；live path 因 §A9.2 publication gate 拒部署，parity 不存在。critic 重点审：backtest 内 parity 边界 case 是否覆盖（normal supported / data_unavailable / required_missing / alignment_lag）。
8. **ts 单位**（已校正）：`lastClosedBarTs` 是毫秒（packages/shared `Bar.timestamp` 字段直接用，无须转换）；spec 覆盖 ts 是数字毫秒类型断言。
9. **`requiredTimeframes` 长度 ∈ [1, 8]**：避免组合爆炸；spec 覆盖 length=0 / 1 / 8 / 9 边界；上限 8 是经验数（>8 时数据拉取/对齐 cost 显著上升）。
10. **owner 节点多 ref 互斥**：trigger 同时声明 `symbolScopeRef` + `timeframeScopeRef` 是允许的（symbol routing + timeframe alignment 正交）。critic 重点审：spec 是否覆盖 trigger 同时缺两 ref 时上报双 missing_binding slot（M1）。
11. **dataRequirements 一致性**（已修正）：spec builder mergeTimeframeScopeIntoDataRequirements 把 scope.timeframe 的 (primary ∪ required) union dedup 写入 spec.dataRequirements.requiredTimeframes；critic 重点审：合并后 spec hash 是否仍 deterministic（按 timeframe ms 升序排序）；现有 backtest HTF 拉数路径是否真的会消费这个新增字段（backtest-runner resolveRequiredHtfTimeframes spec 验证）。
12. **publication gate ErrorCode 落点**：critic 重点审：`ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED` ErrorCode 是否需要前端国际化处理；exception 子类是否符合 ruler/conventions.md §7（packages/shared error-codes + apps/backend/.../exceptions/）。注意此 exception 实际落到 quantify 服务，应放 `apps/quantify/src/modules/llm-strategy-codegen/exceptions/` 而非 backend。

---

## 10. 测试覆盖矩阵

| Acceptance | Test |
|------------|------|
| A1 | `semantic-orchestration-registry.service.spec.ts` 扩：scope.timeframe contract 字段断言（capabilities / requires / runtimeRequirements / effects / executableSinceVersion 全字段） |
| A2.1-A2.7 | `semantic-orchestration-registry.service.spec.ts` 扩：10 条 fail-closed 各 1 case（含 A2.4f primary granularity 顺序：primary=1h required=[15m] 颠倒 → fail-closed）；`semantic-contract-readiness.service.spec.ts` 扩：scope.dataSource / scope.subStrategy / scope.leg 仍 unsupported_kind |
| A3 | golden corpus Section B：≥1 timeframe scope locked + trigger 缺 ref → missing_binding；trigger 同时缺 symbol+timeframe ref → 双 missing_binding slot 各自上报；open→locked 流转 case：scope status='open' 时 owner 无 ref ok=true → scope 改 'locked' 后立即 missing_binding |
| A4 | golden corpus Section D：canonical → IR → AST 全链路（含 union 字段） |
| A4b | `canonical-spec-builder.service.spec.ts` 扩：mergeTimeframeScopeIntoDataRequirements union dedup + ms 升序断言 + scope.timeframe 不存在时 dataRequirements 不变 |
| A5 | byte-equal spec 扩 2 case（仅 symbol scope 旧 ast 字节不变 + 含 timeframe scope round-trip structuralDigest 稳定） |
| A6 | `apply-timeframe-scope-alignment.spec.ts`：决策表 ≥10 case（0 timeframe scope continue / unbound_program / unknown_scope / data_unavailable / primary_missing / required_missing / strict bucket diff 0/1/2 / tolerant bucket diff 0/1/2）+ bucket 数学 4 个边界 |
| A7 | `apply-timeframe-scope-alignment.spec.ts` 扩：fail-closed decision 经过 applyOrchestrationGate 后保留 portfolioRisk observedBreaches |
| A8 | byte-equal spec + 现有 `multi-timeframe-htf-filter.spec.ts` 不回归（28 个 spec 全部 pass） |
| A9.1 | `build-timeframe-bar-status.spec.ts`：backtest path leg id 默认 / multi-leg / 缺数据 fall-through |
| A9.2 | `scope-timeframe-live-unsupported.exception.spec.ts`：DomainException + ErrorCode + 拒部署 message |
| A10 | golden corpus 6 段 ≥ 8 case + 3 negative（单周期 + HTF filter atom + symbol_scope 误命中） |
| A11 | golden corpus Section F：backtest 内 parity（normal / data_unavailable / required_missing / alignment_lag 各 1 case） |
| A12 | golden corpus Section A：6 positive + 2 negative；display token 全命中（8 entries） |
| A13 | registry spec + readiness spec：strategyVersion 缺失 fail-closed + executableSinceVersion check |
| A14-A16 | CI / `git-pr-ship` 流程 |

---

## 11. Follow-up（不在本 PR 范畴）

- **#1110（PR 合入即开）** Phase 5 S3 follow-up — Live 端多周期数据接入：
  - 扩 `signal-generation-decision.stage.ts.buildPublishedStrategyContext` 接受 `multiLegData`（沿用 `buildResolvedStrategyContextForMultiLeg` line 553-578 已建立的 multi-leg snapshot pattern）
  - 接通 published strategy snapshot loader 到多 timeframe bars 拉取（与 backtest path 一致）
  - 移除 `validateScopeTimeframeLiveDeployable` 拒部署逻辑（让 live deploy 走完整 runtime alignment）
  - exchange feed 时序鲁棒性 + 断线重连后的 timeframeBarStatus 重建保证
- **#1108**（已开）Phase 5 S2 follow-up — scope.symbol fan-out caller（独立追踪，不影响本 PR）
- **S10 / S11**（master plan 既定）`scope.subStrategy` / `scope.leg` 在 S2/S3 substrate 之上扩展（独立 issue）

---

## 12. 收尾 Hard Gates

每条都必须达成才能 ship：

1. plan critic ≤3 轮，第 3 轮仍 fail → escalate（不接受 minor 妥协）
2. T1-T10 全 task commit + commit msg 末尾 `Refs: #984` `Refs: #1109`
3. T11 全量回归绿（dx lint + dx build quantify --dev + 受影响 unit + golden + parity）
4. `dx build contracts --dev` 后 `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出 0
5. PR 用 `git-pr-ship` 收口；title `feat(ai-quant): #984 Phase 5 S3 - scope.timeframe 升级 + 多周期 runtime`；body 含 plan + 3 轮 critic 报告 + #1109 验收勾选 + `Closes: #1109` `Refs: #984` `Refs: #1107`
6. PR critic 第 1 轮双 comment（review-report + fix-report）
7. `gh pr merge --squash --auto`，CI 绿后自动合入

---

**End of Plan**

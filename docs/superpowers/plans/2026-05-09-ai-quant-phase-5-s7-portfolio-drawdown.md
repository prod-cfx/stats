# AI Quant Phase 5 S7 — portfolioRisk.drawdown_block Implementation Plan

**Goal:** 落地第二个 supported orchestration capability `portfolioRisk.drawdown_block`，关闭 Phase 5 验收 bullet #10(portfolio)。

**Track:** C
**Total PRs:** 1（S7 是 Phase 5 12-slice roadmap 中的独立切片）
**Issue:** #984
**Roadmap spec:** `docs/superpowers/specs/2026-05-09-ai-quant-phase-5-orchestration-roadmap.md` § S7 节
**S1 母 plan:** `docs/superpowers/plans/2026-05-09-ai-quant-phase-5-multi-pr.md`（PR 拓扑表；本文件是 S7 单 PR 详细 plan）

## PR 拓扑

| # | PR 标题 | 涵盖层 | 依赖 PR | 哨兵 |
|---|---|---|---|---|
| 1 | feat(ai-quant): #984 Phase 5 S7 - portfolioRisk.drawdown_block | quantify codegen + packages/shared compiled-runtime + backtest + live signal | S1 (#1053) ✅ merged | 否（无 schema 变更；observe 模式自身无副作用，enforce 模式由后续灰度切换） |

## Acceptance（每项必须有测试覆盖）

- [ ] `SemanticOrchestrationContract` 已在 S1 完成；本 PR 复用
- [ ] `SemanticOrchestrationPortfolioRiskNode` 类型扩展：`scope: 'portfolio'`、`mode: 'observe' | 'enforce'`、`thresholdPct: number`（必有）
- [ ] `SemanticOrchestrationRegistryService` 注册 `portfolioRisk.drawdown_block` capability，effects=`[{ domain: 'guard', verb: 'block', object: 'new_entries' }]`，executableSinceVersion=CURRENT_SEMANTIC_VERSION
- [ ] `NaturalLanguageGatewayService` 抽取 `PortfolioDrawdownFrame`，覆盖"账户回撤超 10% 停止开新仓"等 P0 utterance
- [ ] `SemanticFrameNormalizerService` 将 frame 归一化到 `patch.orchestration.nodes[]`（kind:'portfolioRisk'）
- [ ] `SemanticContractReadinessService` 对 supported `portfolioRisk.drawdown_block` 节点解锁 Phase 0 unsupported（含 5 重 fail-closed 分支 + 双 version-gate）
- [ ] `SemanticPresentationRegistryService` 提供 `portfolioRisk.drawdown_block` entry：publicName "组合回撤护栏"、零内部 key 泄漏
- [ ] `CanonicalSpecBuilderService` 在 canonical spec v2 输出 `orchestration.portfolioRisks[]`
- [ ] `CanonicalSpecV2IrCompilerService` 编译 `IR.orchestrationPortfolioRisks[]`（无表达式编译，纯 metadata）
- [ ] `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks.ts` 实现：输入"当前账户 drawdown%"+ portfolioRisk 节点 → 输出 `OrchestrationGateState` 形态（block long/short）
- [ ] `runDecisionPrograms` 在 entry phase 同时检查 gate state 与 portfolio risk state；`enforce` mode 触发 NOOP，`observe` mode 仅记录 reason 不阻挡
- [ ] backtest 与 live signal fast path 共用同一 evaluator，parity 测试通过
- [ ] golden corpus 覆盖：observe vs enforce / 触发 vs 未触发 / 缺 thresholdPct fail-closed / "已有空仓 + drawdown 超阈值 → CLOSE_SHORT 仍正常"
- [ ] `dx lint`、TS 0 errors、相关 unit + golden corpus + parity 测试全绿
- [ ] `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出 0
- [ ] PR critic 双 comment + `gh pr merge --squash --auto`

## Files

### Create
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-portfolio-drawdown-golden-corpus.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-portfolio-drawdown-parity.spec.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks.spec.ts`

### Modify
- `packages/shared/src/strategy-protocol.ts` — `StrategyExecutionContextV1` 增加 optional `accountDrawdownPct?: number`（0..100 浮点，与 account-strategy-view.service.ts:1970 同公式 `(peak-current)/peak*100`，正数；equity 增长时为 0 或负，evaluator 视作未触发）
- `apps/quantify/src/modules/strategy-runtime/strategy-script-compiler.util.ts:95` — interface 字符串模板同步新增 `accountDrawdownPct?: number`
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts:31` — prompt 中的 ctx interface 描述同步
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts` — 增加 `SemanticOrchestrationPortfolioRiskMode`、`SemanticOrchestrationPortfolioRiskScope`；`SemanticOrchestrationNode` 增 optional `mode / thresholdPct / scope`（对 portfolioRisk kind 必填，其它 kind 不读）
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts` — `CodegenSemanticOrchestrationNodePatch` 联合类型扩展 portfolioRisk 形态
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts` — 新增 `SemanticPortfolioDrawdownFrame`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts` — 注册 `portfolioRisk.drawdown_block`
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts` — 增加 `parsePortfolioDrawdown(text)`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts` — 增加 `portfolio_drawdown` case，发射 patch.orchestration.nodes
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` — `toOrchestrationNode` 接受 portfolioRisk kind 的 mode/thresholdPct/scope 字段
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts` — `normalizePhase0Orchestration` 增加 `isSupportedPortfolioDrawdownBlock` 分支（含 5 重 fail-closed）
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts` — 新增 portfolioRisk.drawdown_block entry
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts` — display 投影 portfolioRisk
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts` — 增加 `CanonicalOrchestrationPortfolioRisk` + spec.orchestration.portfolioRisks?
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` — `buildOrchestrationPortfolioRisks(state)`
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts` — 增加 `IrOrchestrationPortfolioRisk` + IR.orchestrationPortfolioRisks
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` — `compileOrchestrationPortfolioRisks(spec)` 直透传（无表达式编译）
- `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts` — 接受 `portfolioRiskState` 参数（与 orchestrationGateState 并列），enforce mode 时拦 OPEN_*
- `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts` — 传 `currentDrawdownPct` 到 evaluator + portfolio state
- `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts` — 同上

## Tasks

### Task 1: 类型扩展（types/semantic-state.ts + types/codegen-semantic-patch.ts + types/semantic-natural-language-frame.ts）

- [ ] **Step 1.1:** 在 `semantic-state.ts` 新增类型：
```ts
export type SemanticOrchestrationPortfolioRiskMode = 'observe' | 'enforce'
export type SemanticOrchestrationPortfolioRiskScope = 'portfolio'
```
将 `SemanticOrchestrationNode` 增加 optional 字段（对 portfolioRisk 节点必填，对 gate 节点不读）：
```ts
mode?: SemanticOrchestrationPortfolioRiskMode
thresholdPct?: number
scope?: SemanticOrchestrationPortfolioRiskScope
```

- [ ] **Step 1.2:** 在 `codegen-semantic-patch.ts`，扩展 `CodegenSemanticOrchestrationNodePatch` 为联合类型：
```ts
export type CodegenSemanticOrchestrationNodePatch =
  | CodegenSemanticOrchestrationGateNodePatch
  | CodegenSemanticOrchestrationPortfolioRiskNodePatch

// 现有 gate patch 改名为 CodegenSemanticOrchestrationGateNodePatch（保持字段不变）

export interface CodegenSemanticOrchestrationPortfolioRiskNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'portfolioRisk'
  key: 'portfolioRisk.drawdown_block'
  params: Record<string, unknown>
  mode: SemanticOrchestrationPortfolioRiskMode
  thresholdPct: number
  scope: SemanticOrchestrationPortfolioRiskScope
  evidence?: SemanticEvidence
}
```

- [ ] **Step 1.3:** 在 `semantic-natural-language-frame.ts`：
```ts
export interface SemanticPortfolioDrawdownFrame extends SemanticFrameBase {
  kind: 'portfolio_drawdown'
  thresholdPct: number
  mode: 'observe' | 'enforce'
}

// 加入 SemanticNaturalLanguageFrame 联合类型
```

- [ ] **Step 1.4:** Verify TS 0 errors。
- [ ] **Step 1.5:** Commit：`refactor(ai-quant): #984 Phase 5 S7 - 引入 PortfolioDrawdown frame 与 portfolioRisk patch 类型`。

### Task 2: SemanticOrchestrationRegistryService 注册 portfolioRisk.drawdown_block

- [ ] **Step 2.1:** 写测试 first：getContractByKey('portfolioRisk.drawdown_block') 返回 contract，effects=`[{ domain:'guard', verb:'block', object:'new_entries' }]`，executableSinceVersion=CURRENT_SEMANTIC_VERSION。validate(node) 缺 thresholdPct → openSlot 'orchestration.portfolio_drawdown.threshold_pct'。
- [ ] **Step 2.2:** 实现 register 第二个 entry。capabilities=`[{ domain:'orchestration', verb:'portfolio_risk', object:'drawdown_block' }]`、stateRequirements=`[{ domain:'state', verb:'read', object:'account.drawdown_pct' }]`、target/activeWhen 不需要（portfolioRisk 不走 expression）。
- [ ] **Step 2.3:** Run spec PASS。
- [ ] **Step 2.4:** Commit。

### Task 3: NL gateway parsePortfolioDrawdown

- [ ] **Step 3.1:** 写测试：
  - "账户回撤超过 10% 停止开新仓" → frame { thresholdPct:10, mode:'enforce' }
  - "回撤 5% 仅记录不停" → frame { thresholdPct:5, mode:'observe' }
  - "感觉账户在亏" → 不抽 frame
- [ ] **Step 3.2:** 实现 `parsePortfolioDrawdown(text)`：识别 "(账户)?回撤(超过|大于|过)?\s*(\d+(\.\d+)?)\s*% (停止|不要|阻止)?(开)?(新)?仓" 等显式数值表达；mode 默认 'enforce' 当含"停止/阻止"等阻挡词；含"仅记录/观察/observe"则 'observe'。
- [ ] **Step 3.3:** drafts 数组追加。
- [ ] **Step 3.4:** Run spec PASS。
- [ ] **Step 3.5:** Commit。

### Task 4: Frame normalizer 归一化 portfolio_drawdown

- [ ] **Step 4.1:** 写测试：单 frame → patch.orchestration.nodes[0] kind:'portfolioRisk', key:'portfolioRisk.drawdown_block', mode/thresholdPct/scope 正确；evidence 携带；同 frame 重复去重。
- [ ] **Step 4.2:** normalizer switch 增加 'portfolio_drawdown' case，构造 `CodegenSemanticOrchestrationPortfolioRiskNodePatch`，scope 默认 'portfolio'。
- [ ] **Step 4.3:** Run spec PASS。
- [ ] **Step 4.4:** Commit。

### Task 5: Seed state builder 接收 portfolioRisk

- [ ] **Step 5.1:** `toOrchestrationNode` 增加 portfolioRisk 分支：从 update.mode/thresholdPct/scope 读取并塞入返回的 SemanticOrchestrationNode。
- [ ] **Step 5.2:** 端到端 spec：raw input "账户回撤超过 10% 停止开新仓" → state.orchestration.nodes[0] kind:'portfolioRisk', mode:'enforce', thresholdPct:10。
- [ ] **Step 5.3:** Run spec PASS；幂等测试通过。
- [ ] **Step 5.4:** Commit。

### Task 6: Contract readiness lift portfolioRisk.drawdown_block + version-gate + 7 fail-closed

- [ ] **Step 6.1:** 写测试 5+ cases：
  - A: portfolioRisk.drawdown_block + thresholdPct + mode + version=current → supported_executable
  - B: 缺 thresholdPct → registry openSlot 'orchestration.portfolio_drawdown.threshold_pct'
  - C: kind:'portfolioRisk' + key:'portfolioRisk.unknown' → phase0 unsupported
  - D: scope !== 'portfolio' → phase0 unsupported
  - E: mode 非 observe/enforce → phase0 unsupported
  - F: thresholdPct ≤0 或 >100 → phase0 unsupported
  - G: 老策略（deployedAtSemanticVersion=null）→ phase0 unsupported（双 fail-closed）
  - H: 现有 gate.regime + 新 portfolioRisk 共存 → 两条独立路径都正确（不互相干扰）
- [ ] **Step 6.2:** `normalizePhase0Orchestration` 增加 `isSupportedPortfolioDrawdownBlock(node, strategy, registry)` helper；与 isSupportedRegimeGate 并列。
- [ ] **Step 6.3:** Run spec PASS；现有 gate.regime / phase0 fallback 全部不回归。
- [ ] **Step 6.4:** Commit。

### Task 7: Presentation registry portfolioRisk.drawdown_block entry

- [ ] **Step 7.1:** 写测试：getEntry('portfolioRisk.drawdown_block') publicName "组合回撤护栏"；displayRenderer({params:{thresholdPct:10,mode:'enforce'}}) 输出 "账户回撤超过 10% 时阻止开新仓"，零内部 key 泄漏（不含 `portfolioRisk.drawdown_block` / `orchestration.` / `block_new_entries` / `drawdown_block` / `enforce` / `observe`）。observe 模式 displayRenderer 输出形如 "账户回撤超过 X% 时仅记录"。
- [ ] **Step 7.2:** register entry：aliases ['组合回撤', '账户回撤护栏', 'portfolio drawdown', 'drawdown block']；positiveExamples ['账户回撤超过 10% 停止开新仓', '回撤 5% 仅记录不停']；negativeExamples ['感觉亏了'，'风控大概在 10%'].
- [ ] **Step 7.3:** Run spec PASS。
- [ ] **Step 7.4:** Commit。

### Task 8: Display projection 投影 portfolioRisk

- [ ] **Step 8.1:** 写测试：state 含一 portfolioRisk node → display 含 "组合回撤护栏"，不暴露内部 key；W2 不读 frame.evidence；status:'open' 节点不渲染。
- [ ] **Step 8.2:** projection 在现有 `buildDisplayOrchestrationBlock` 增加 portfolioRisk 渲染分支（与 gate 并列），调 presentation registry。
- [ ] **Step 8.3:** Run spec PASS。
- [ ] **Step 8.4:** Commit。

### Task 9: Canonical spec v2 emit orchestration.portfolioRisks

- [ ] **Step 9.1:** `canonical-strategy-spec-v2.ts` 增加：
```ts
export interface CanonicalOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

// 扩展 spec.orchestration?: { gates?: CanonicalOrchestrationGate[]; portfolioRisks?: CanonicalOrchestrationPortfolioRisk[] }
```

- [ ] **Step 9.2:** 写测试（扩展 canonical-spec-builder.service.spec.ts）：state 含 portfolioRisk node → spec.orchestration.portfolioRisks.length=1；空时整个 portfolioRisks 字段省略；status:'open' 不 emit；非法 mode 不 emit。**新增 case (critic round 2)**：state 既无 gates 也无 portfolioRisks → spec.orchestration 整个字段省略（保现有 snapshot 兼容性）。
- [ ] **Step 9.3:** canonical builder 添加 `buildOrchestrationPortfolioRisks(state)`：filter `kind:'portfolioRisk' && key:'portfolioRisk.drawdown_block' && status:'locked'`，map 到 canonical 形态。effectWhenTriggered 固定 'block_new_entries'。
- [ ] **Step 9.4:** orchestration 字段输出逻辑：gates / portfolioRisks 任一非空时输出 orchestration object，按需含字段。
- [ ] **Step 9.5:** Run spec PASS；现有 gate.regime emit 不回归。
- [ ] **Step 9.6:** Commit。

### Task 10: IR compile orchestrationPortfolioRisks

- [ ] **Step 10.1:** `canonical-strategy-ir.ts` 增加：
```ts
export interface IrOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

// 扩展 IR：orchestrationPortfolioRisks?: IrOrchestrationPortfolioRisk[]（与 orchestrationGates 同处理优先 optional + 编译器始终 emit []）
```

- [ ] **Step 10.2:** 写测试：spec.orchestration.portfolioRisks=[1 item] → ir.orchestrationPortfolioRisks=[1 item]；空时 []；与 orchestrationGates 共存正确。
- [ ] **Step 10.3:** IR compiler 添加 `compileOrchestrationPortfolioRisks(spec)`：直透传（无表达式编译，纯 metadata 转换）。
- [ ] **Step 10.4:** Run spec PASS。
- [ ] **Step 10.5:** Commit。

### Task 11: 新建 evaluate-orchestration-portfolio-risks evaluator

- [ ] **Step 11.1:** 写测试 ≥12 cases（覆盖 observe/enforce × 触发/未触发/边界值/缺 drawdown context fail-closed）：
  - empty risks → no block, observedBreaches=[]
  - enforce + drawdown 12% > threshold 10% → blockEntryLong/Short=true
  - enforce + drawdown 8% < threshold 10% → no block
  - enforce + drawdown 0% (equity flat) → no block
  - enforce + drawdown -5% (equity 增长) → no block（dd<threshold 含负数）
  - observe + drawdown 12% > threshold 10% → no block, observedBreaches=[risk.id]
  - observe + drawdown 8% < threshold → no block, observedBreaches=[]
  - **enforce + drawdownPct undefined → blockLong/Short=true（fail-closed double block）**
  - **observe + drawdownPct undefined → no block, observedBreaches=[]（完全 no-op，无 evidence 不记录）**
  - drawdownPct=NaN → 与 undefined 一致行为
  - 非法 thresholdPct ≤0 → fail-closed double block（无论 mode）
  - 多 risk node：一个 enforce 触发 + 一个 observe 触发 → enforce 阻挡 + observe 入 observedBreaches

- [ ] **Step 11.2:** 实现（critic round 1 M2 修复 — 收敛 observe + undefined 语义）：
```ts
import type { OrchestrationGateState } from './evaluate-orchestration-gates'

export interface CompiledOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number  // 0..100 浮点（"10" 表 10%），与 ctx.accountDrawdownPct 同单位
  effectWhenTriggered: 'block_new_entries'
}

export interface PortfolioRuntimeContext {
  drawdownPct?: number  // 0..100 正数；equity 增长时为 0 或负
}

export interface OrchestrationPortfolioRiskState extends OrchestrationGateState {
  observedBreaches: string[]
}

export function evaluateOrchestrationPortfolioRisks(
  risks: readonly CompiledOrchestrationPortfolioRisk[],
  ctx: PortfolioRuntimeContext,
): OrchestrationPortfolioRiskState {
  let blockLong = false
  let blockShort = false
  const observedBreaches: string[] = []
  for (const risk of risks) {
    if (risk.scope !== 'portfolio') continue
    if (!Number.isFinite(risk.thresholdPct) || risk.thresholdPct <= 0) {
      // 非法 contract → fail-closed
      blockLong = true
      blockShort = true
      continue
    }
    const dd = ctx.drawdownPct
    if (!Number.isFinite(dd)) {
      // 无 evidence：enforce fail-closed double block；observe 完全 no-op
      if (risk.mode === 'enforce') { blockLong = true; blockShort = true }
      continue
    }
    if ((dd as number) < risk.thresholdPct) continue   // dd < threshold 未触发（含 dd<=0 即 equity 增长）
    if (risk.mode === 'enforce') {
      blockLong = true
      blockShort = true
    } else { // observe
      observedBreaches.push(risk.id)
    }
  }
  return { blockEntryLong: blockLong, blockEntryShort: blockShort, observedBreaches }
}
```

- [ ] **Step 11.3:** Run spec PASS。
- [ ] **Step 11.4:** Commit。

### Task 12: run-decision-programs 接入 portfolioRiskState

- [ ] **Step 12.1:** 写测试（扩展现有 run-decision-programs.spec.ts）：
  - portfolioRiskState=undefined → 现有行为（无副作用）
  - portfolioRiskState.blockEntryLong=true（enforce 触发）→ OPEN_LONG NOOP，reason `compiled.orchestration.portfolio_risk.block_entry_long`
  - same with blockEntryShort
  - exit/reduce/forceExit 不受影响
  - W5: existing short + portfolioRiskState 双 block → CLOSE_SHORT 仍正常
  - portfolioRiskState 与 orchestrationGateState 同时存在：任一阻挡即拦
- [ ] **Step 12.2:** 修改 `runDecisionPrograms` 签名增加可选 `portfolioRiskState?: OrchestrationPortfolioRiskState`（第 7 参数，向后兼容）— **类型必须是 `OrchestrationPortfolioRiskState`，不是 `OrchestrationGateState`**（critic round 1 M1 修复，否则 observedBreaches 在跨层丢失）。`applyOrchestrationGate` 内部聚合 gate state 与 portfolio state（OR 逻辑）：
  - blockLong = gate.blockEntryLong || portfolio.blockEntryLong
  - blockShort = gate.blockEntryShort || portfolio.blockEntryShort
  - reason 命名规约：
    - portfolio enforce 触发：`compiled.orchestration.portfolio_risk.block_entry_long` / `..._short`
    - gate.regime 触发：`compiled.orchestration.gate.block_entry_long` / `..._short`
    - 同时触发：portfolio 优先（语义"账户级风控覆盖单次入场"），但 decision.meta.observedBreaches 携带 portfolio observe id list 与 gate id 作为次级可观察性，不丢失 gate 触发证据
  - observedBreaches 在 NOOP 决策的 meta 字段透传到上层（不影响 action.kind）。
- [ ] **Step 12.3:** Run spec PASS；现有 gate.regime 测试零回归。
- [ ] **Step 12.4:** Commit。

### Task 13: Backtest 接入 portfolio risk evaluator + ctx.accountDrawdownPct feeding

- [ ] **Step 13.0 audit：** Grep 确认 backtest-strategy-adapter.service.ts:111 仍是唯一决策入口。
- [ ] **Step 13.1 ctx 字段（critic round 1 C1 修复）：** 在 `packages/shared/src/strategy-protocol.ts` 的 `StrategyExecutionContextV1` 增加 `accountDrawdownPct?: number`（注释：0..100 浮点，与 account-strategy-view.service.ts:1970 同公式）。同步：
  - `apps/quantify/src/modules/strategy-runtime/strategy-script-compiler.util.ts:95` 的 interface 字符串模板
  - `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts:31` 的 prompt
- [ ] **Step 13.2 backtest peakEquity 注入：** backtest-strategy-adapter 在 onBar 决策前维护 internal `peakEquity` 状态：
  - 初始 `peakEquity = initialEquity`
  - 每 bar 更新 `peakEquity = max(peakEquity, currentEquity)`
  - 计算 `accountDrawdownPct = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0`
  - 注入到 `ctx.accountDrawdownPct` 后再调用 evaluator + runDecisionPrograms
  - engine 重启场景：peakEquity 重置等同 initialEquity
- [ ] **Step 13.3 写测试 ≥4 cases：**
  - drawdown 5% < threshold 10% → OPEN_LONG 正常
  - drawdown 12% > threshold 10% (enforce) → NOOP `compiled.orchestration.portfolio_risk.block_entry_long`
  - drawdown 12% (observe) → OPEN_LONG 正常 + decision.meta.observedBreaches 含该 risk id
  - **drawdown=undefined (peakEquity=0 or initial bar) + enforce → NOOP fail-closed** 端到端确认 ctx feeding 与 evaluator 真衔接
- [ ] **Step 13.4:** 实现：在 runDecisionPrograms 调用前调用 `evaluateOrchestrationPortfolioRisks(ir.orchestrationPortfolioRisks ?? [], { drawdownPct: ctx.accountDrawdownPct })`，第 7 参数透传。
- [ ] **Step 13.5:** Run spec PASS。
- [ ] **Step 13.6:** Commit。

### Task 14: Live signal fast path 接入 portfolio risk evaluator + drawdown read-only 

- [ ] **Step 14.0 audit：** Grep signal-generator.service.ts:732 仍是唯一入口。
- [ ] **Step 14.1 drawdown 数据源审计（critic round 1 C1）：** 调研 `LlmStrategyInstance` / account snapshot 是否有 drawdownPct 字段。已知 `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts:1970` 已有计算公式（聚合层）；live 决策路径需要的是实时字段。
  - 若有可读字段 → ctx.accountDrawdownPct 注入
  - 若无 → live 侧 ctx.accountDrawdownPct = undefined → enforce 模式 fail-closed double block（语义即"无证据时阻止新开仓"）；observe 模式 no-op
  - **不在本 PR 引入新 drawdown 上报基建**；live 侧 enforce 模式真实启用留 follow-up issue（在 PR body 显式注明）
- [ ] **Step 14.2 写测试 ≥4 cases（symmetric to Task 13）：**
  - 已有 ctx.accountDrawdownPct 时三态（< / > / observe）
  - **drawdownPct undefined + enforce → fail-closed double block 端到端**
  - 与 backtest spec fixture 形态可文本 diff（仅 import 路径不同）
- [ ] **Step 14.3:** 实现：与 backtest **共用同一 evaluator import** `@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks`，调用形态完全对称。
- [ ] **Step 14.4:** Run spec PASS。
- [ ] **Step 14.5:** Commit。

### Task 15: Backtest vs live signal parity

- [ ] **Step 15.1:** 新建 `orchestration-portfolio-drawdown-parity.spec.ts` 至少 5 cases（critic round 1 M3 修复）：
  - 无触发（drawdown < threshold）→ 两路 OPEN_LONG toEqual
  - enforce 触发 → 两路 NOOP + 同 reason toEqual
  - W5 close 不受影响（existing short + drawdown 触发 → CLOSE_SHORT 仍正常）→ 两路 toEqual
  - **observe 触发** → 两路 OPEN_LONG 决策一致 + observedBreaches 数组 toEqual（保护 observe 状态在跨路径不丢失）
  - **portfolioRisk enforce + gate.regime 同时触发** → 两路 reason 一致 + meta 携带次级 observation 一致（保护聚合逻辑跨路径对齐）
- [ ] **Step 15.2:** Run PASS。
- [ ] **Step 15.3:** Commit。

### Task 16: Golden corpus + atom-coverage

- [ ] **Step 16.1:** 新建 `orchestration-portfolio-drawdown-golden-corpus.spec.ts` 类似 S1 corpus，包含：
  - P0 case input "账户回撤超过 10% 停止开新仓" 全链路 (frame → state → readiness → display → canonical → IR → evaluator)
  - 5 fail-closed cases（缺 thresholdPct / unknown key / scope 非 portfolio / mode 非法 / 老策略）
  - W5: existing short + drawdown 触发 → CLOSE_SHORT 正常
  - W2: state 缺 portfolioRisk node + frames 有 portfolio_drawdown → display 不渲染
  - observe vs enforce mode 差异
- [ ] **Step 16.2:** atom-coverage-golden-cases.ts 增加 portfolioRisk.drawdown_block 案例，supported_executable 路由。
- [ ] **Step 16.3:** atom-coverage-golden-corpus.spec.ts 解除对 portfolioRisk.drawdown_block 的 NOT executable 断言；其它 portfolioRisk 子键仍 unsupported。
- [ ] **Step 16.4:** Run all PASS。
- [ ] **Step 16.5:** Commit。

### Task 17: 全回归 + git diff exit-code

- [ ] **Step 17.1:** 并行跑（critic round 2 m3 修复 — 改用 dx 命令）：
```bash
dx lint &
dx build quantify --dev &
pnpm exec jest --config apps/quantify/jest-unit.json apps/quantify/src/modules/llm-strategy-codegen/ &
pnpm exec jest --config apps/quantify/jest-unit.json apps/quantify/src/modules/backtesting/ apps/quantify/src/modules/strategy-signals/ &
npx nx test shared --testPathPattern="evaluate-orchestration|run-decision-programs" &
wait
```
全绿（dx 入口为主；jest 直接调用为辅，避免 quantify-launcher.cjs 缺 postgres URL 导致 dx test unit quantify 直接失败）。
- [ ] **Step 17.2 (critic round 2 M4 修复)：** 显式跑 atomic-contract parity spec 确保 ctx 字段新增 + 第 7 参数后该 spec 仍 PASS：
```bash
pnpm exec jest --config apps/quantify/jest-unit.json apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
```
若发现 silent regression（spec 不再保护新字段维度）→ 在 spec 中显式新增 case 验证 ctx.accountDrawdownPct 与第 7 参数的 protocol contract。
- [ ] **Step 17.3:** `git diff --exit-code packages/api-contracts/src/generated/quantify.ts` 退出码 0（zero diff）；如出现 diff，inline review 后回退或在 PR body 显式说明。
- [ ] **Step 17.4:** Final commit："chore(ai-quant): #984 Phase 5 S7 - 修复回归"（如有）。

### Task 18: PR push + critic ≤3 轮 + 双 comment + merge --auto

- [ ] **Step 18.1:** Push：`git push -u origin feat/984-phase5-s7-portfolio-drawdown`
- [ ] **Step 18.2:** 创建 PR `feat(ai-quant): #984 Phase 5 S7 - portfolioRisk.drawdown_block`，PR body 含 Acceptance → Evidence 映射表 + Refs: #984。
- [ ] **Step 18.3:** 派 critic 审 PR diff（critic round 上限 3 轮，第 3 轮仍有 Critical/Major → escalate 回 brainstorming）。
- [ ] **Step 18.4:** 落 review-report comment + 修复 + 落 fix-report comment（双 comment gate）。
- [ ] **Step 18.5:** `gh pr merge <PR> --squash --auto`；等 auto-merge 成功；超时 30 分钟人工介入。

## Risk & Rollback

- **Runtime 风险：** S7 不直接动 order lifecycle，仅添加 OPEN_* 路径上的拦截判断。observe 模式默认 + drawdown read-only 接入，最小风险面。
- **回滚边界：** 单 PR；若发现回归仅 revert 这一个 commit 即可（registry / contract / runtime 均 additive，向后兼容）。
- **生产风险：** observe 模式不触发任何 effect；enforce 模式生效需要用户在策略中显式声明 `mode: 'enforce'`。建议本 PR ship 后保持 observe 默认值至少一周，再讨论是否切换 enforce 默认。
- **Live signal drawdownPct 数据源：** 如果生产侧 LlmStrategyInstance 或 account state 暂无实时 drawdown 字段，evaluator 的 fail-closed 行为保证 enforce 模式安全（缺数据=阻挡）。observe 模式 no-op，无副作用。

## Acceptance Mapping (issue #984)

| Bullet | 状态 |
|---|---|
| #10(portfolio) 组合风控 portfolio scope + block_new_entries effect | **closed**（backtest enforce + live observe 默认；live enforce 真实启用 gated by follow-up issue，将在 PR ship 同时创建并在 PR body 显式列编号） |
| #10(symbol/subStrategy) | 留 S8（依赖 S2/S10） |

其余 bullets 由其它 slices 负责。

**Live enforce follow-up issue（PR ship 前/同时创建）：**
- 标题示例：`feat(ai-quant): #984 Phase 5 S7 follow-up - live signal account drawdown feed`
- 内容：在 LlmStrategyInstance 或 account state 添加实时 drawdownPct 上报 → 让 live signal 能注入 ctx.accountDrawdownPct → enforce 模式真实生效
- 在 S7 PR body 中以 "Follow-up: #YYYY" 显式引用

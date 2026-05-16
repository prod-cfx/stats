# Atom Expression Tree — 原子表达式树端到端设计

> 状态：approved by user 2026-05-15
> 关联 Issue：#1391 follow-up（八条策略原子语义识别失效）
> 范围：apps/quantify/src/modules/llm-strategy-codegen

## 1. 问题

八条用户实测策略全部在 NL→atoms[] 这一段失真：

| # | 策略 | 失真表现 |
|---|---|---|
| S1 | 网格双向 + 突破停止 | 误报 missing_entry/exit_atom |
| S2 | 连跌 3 根 + 下一根放量反弹 | 识别成"连续实体≥15 根双向开仓" |
| S3 | MA50/200 gate + RSI 序列状态 | 拆成 4 个独立 entry |
| S4 | BOLL 下轨 AND 量×1.5 | 拆成 2 个独立 entry（OR 语义）|
| S5 | 价格>MA100 AND MACD 金叉 / OR 出场 | AND/OR 都失效 |
| S6 | 突破→回踩→止损 | 回踩与止损位绑定全失 |
| S7 | ATR ×2 止损 + ×3 止盈 | 止盈识别不到 |
| S8 | 15m/1h/4h EMA20 共振 | 多 TF AND 失效 |

## 2. 根因

**LLM 输出的 `semanticPatch.atoms[]` 是扁平数组，无法承载组合语义（AND/OR/NOT/SEQUENCE）。**

下游基础设施却**已经支持**：
- IR `PredicateDef.kind` 已包含 `AND | OR | NOT | allOf | anyOf | sequence`（`canonical-strategy-ir.ts:172`）
- contract 层有 `buildTriggerCombinationContract({ groupId, join })`（`semantic-state-normalization.ts:90`）
- 仓库另有一份 v2 `semanticStrategyPredicateGraphSchema`（logical_group AND/OR/NOT），但走 hand-rolled 谓词节点，没接 atom registry，是死分支

唯一在用 IR 组合能力的是一个 heuristic：`withMovingAverageStackCombinationContracts` —— 仅识别多周期 MA stack，其余漏接。

**结论**：组合关系必须是一等公民的数据结构（递归树），不是 heuristic 反推出来的副产品。

## 3. 设计

### 3.1 唯一新增数据类型

```ts
type AtomExpr =
  | { kind: 'atom',     key: string, params: Record<string, unknown>, sideScope?: 'long'|'short'|'both' }
  | { kind: 'and',      children: AtomExpr[] }   // ≥ 2
  | { kind: 'or',       children: AtomExpr[] }   // ≥ 2
  | { kind: 'not',      child: AtomExpr }
  | { kind: 'sequence', steps: AtomExpr[], withinBars?: number, nextBarOnly?: boolean }  // 顺序敏感

interface SemanticRule {
  id: string
  phase: 'entry' | 'exit' | 'gate'
  sideScope: 'long' | 'short' | 'both'
  condition: AtomExpr                  // 叶 atom 的 roles 必含 'predicate'
  effects: AtomExpr[]                  // 顶层不组合，每条独立绑定；叶 atom 的 roles 必含 'effect'
}
```

`effects` 顶层为数组而非 AtomExpr 是 YAGNI 决定：止损/止盈/加仓不需要 AND/OR 语义。后续真有需求再升 `effects: AtomExpr`。

### 3.2 词汇约定

原子合约的五个桶（atom contract bucket）：

| 用户口径 | 代码 enum | 含义 |
|---|---|---|
| trigger | `trigger` | 谓词 / 触发条件 |
| action | `action` | 开平仓动作 |
| risk | `risk` | 止损止盈 / 风控副作用 |
| 仓位 | `positionConstraint` | 网格 / DCA / 加仓约束 |
| context | `orchestration` | 多周期 / 多 leg / portfolio / 上下文作用域 |

本 spec 后文 trigger/action/risk/仓位/context 与代码 enum 一一对应。

### 3.3 atom roles（contract 层唯一新增字段）

`AtomContract` 新增：

```ts
roles: ReadonlyArray<'predicate' | 'effect'>
```

100 个 atom 按 bucket 自动派生默认值（见附录 A），少数特殊 atom（risk 既能做谓词也能做副作用）手工标 `['predicate', 'effect']`。

**不变量 spec**（PR2 落地）：
- `bucket=trigger` ⇒ `roles=['predicate']`
- `bucket=action` ⇒ `roles=['effect']`
- `bucket=positionConstraint` ⇒ `roles=['effect']`
- `bucket=risk` ⇒ `roles ⊆ ['predicate','effect']`，至少含一个
- `bucket=orchestration` ⇒ `roles ⊆ ['predicate','effect']`（gate.* 是 predicate）

既有的 `fulfillsStrategyPhase` 字段独立存在，承担「该 atom 完整满足哪个策略阶段」的语义，与 roles 是不同维度，保留不动。

### 3.4 state 层：rules 作为主，flat 作为派生投影

```ts
interface SemanticState {
  // 新主体
  rules: SemanticRule[]

  // 既有 flat 字段保留，由 rules 派生（项目 49 个下游消费者无需立即迁移）
  trigger: SemanticTriggerState[]                // = projectFlatTrigger(rules)
  action: SemanticActionState[]                  // = projectFlatAction(rules)
  risk: SemanticRiskState[]                      // = projectFlatRisk(rules)
  positionConstraint: SemanticPositionConstraintState[]
  orchestration: SemanticOrchestrationNode[]

  // 其余字段不动
  contextSlots, position, families, orchestrationContracts, normalizationNotes, updatedAt, ...
}
```

派生规则：
- 单叶子 `Rule { condition: { kind: 'atom', key, params } }` → 投影出 1 个 trigger node（与旧行为完全一致）
- 多叶子 `Rule { condition: AND/OR/... }` → 投影出 N 个 trigger node + 1 个 `triggerCombinationContract({ join, members })`，复用既有 `buildTriggerCombinationContract`
- `effects[]` → 按 atom bucket 投影到 action / risk / positionConstraint flat

**派生 = 单一函数 `projectRulesToFlat(rules)`**，作为 build pipeline 的最后一步，所有下游 reader 看到的 flat 字段是新 rules 的副产品，旧 reader 零迁移即可工作。

### 3.4 LLM patch shape

`semanticPatch` 字段：

```jsonc
{
  "contextSlots": { ... },
  "rules": [
    {
      "id": "entry-boll-vol",
      "phase": "entry",
      "sideScope": "long",
      "condition": {
        "kind": "and",
        "children": [
          { "kind": "atom", "key": "bollinger.touch_lower", "params": { "period": 20, "stdDev": 2 } },
          { "kind": "atom", "key": "volume.threshold",
            "params": { "mode": "relative_to_sma", "multiplier": 1.5, "refWindow": 20 } }
        ]
      },
      "effects": [
        { "kind": "atom", "key": "action.open_long", "params": { "sizing": { ... } } }
      ]
    }
  ],
  "position": { ... }
}
```

旧 `atoms[]` 字段从 schema 中**移除**（测试期，能删就删）。`triggers/actions/risk` 等并行旧 patch 字段同步移除。

> 单 atom case = 单叶子 `Rule`，零特殊代码。

### 3.5 IR 层

`PredicateDef.kind` 已含 `AND|OR|NOT|allOf|anyOf|sequence` —— **零改动**。

`compileExpressionCondition` 递归化（既有函数已接受 `CanonicalExpressionCondition`，扩成 AtomExpr）：

```ts
function compileExpr(expr: AtomExpr, ctx: CompileContext): PredicateDefId {
  switch (expr.kind) {
    case 'atom':     return compileAtom(expr, ctx)              // 既有路径
    case 'and':      return mkPredicate('allOf', expr.children.map(c => compileExpr(c, ctx)))
    case 'or':       return mkPredicate('anyOf', expr.children.map(c => compileExpr(c, ctx)))
    case 'not':      return mkPredicate('NOT',   [compileExpr(expr.child, ctx)])
    case 'sequence': return mkPredicate('sequence', expr.steps.map(s => compileExpr(s, ctx)),
                                        { withinBars: expr.withinBars, nextBarOnly: expr.nextBarOnly })
  }
}
```

底层 evaluation engine 已支持 allOf/anyOf 嵌套（既有）；sequence/NOT 已有 kind 但需补 evaluator —— PR4 落地。

### 3.6 contract 层

`buildTriggerCombinationContract({ groupId, join: 'AND'|'OR', members })` 既有，复用。

dispatcher 替换：原 `dispatchAtomsByContractBucket(atoms[])` → 新 `compileRules(rules: SemanticRule[])`：

```ts
function compileRules(rules: SemanticRule[]): SemanticState {
  for (const rule of rules) {
    walkExpr(rule.condition, (atom, role) => {
      const contract = ATOM_CONTRACT_REGISTRY[atom.key]
      assert(contract.roles.includes(role))           // 编译期 fail-closed
    })
    for (const eff of rule.effects) {
      walkExpr(eff, (atom, role) => {
        assert(role === 'effect' && contract.roles.includes('effect'))
      })
    }
  }
  return projectRulesToFlat(rules)
}
```

**heuristic 退役清单**：
- `withMovingAverageStackCombinationContracts`（被显式 AND 取代）
- `semantic.missing_entry_atom / missing_exit_atom` placeholder atom（被 rule 角色齐备性判定取代）

### 3.7 planner prompt

`conversation-planner-system.prompt.ts` JSON_SHAPE_BLOCK 改为 rules schema，附 BNF + 5 个 in-context 示例：

1. 单叶子（`Rule{condition: atom}`）
2. AND（BOLL + 量）
3. OR（出场任一）
4. SEQUENCE（突破→回踩）
5. 嵌套（gate AND (entry-A OR entry-B)）

入口校验：planner 输出经 zod 严校验；失败 → 拼 zod error path 回喂 LLM，最多一次 retry。

## 4. 输出门禁（hard gate）

PR 合并条件：

1. ✅ `dx lint` 0 错
2. ✅ `dx build quantify --dev` exit 0
3. ✅ `dx test unit quantify` 全绿
4. ✅ `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` 全绿，其中 **8 条策略真调 LLM e2e 必须 8/8 green**

第 4 条是用户验收点，不绿不合。

## 5. 八条策略覆盖证明

| # | rules 表达 |
|---|---|
| S1 | `Rule { phase: entry, condition: { kind: 'atom', key: 'grid.range_rebalance', params: { ..., breakoutAction: 'stop' } } }` — 单叶子，positionConstraint atom，rule 自身被识别为已有 entry+exit 来源，0 误报 |
| S2 | `Rule { phase: entry, condition: { kind: 'sequence', steps: [consecutive_body(count:3, dir:down), { kind: 'and', children: [volume.threshold(mode:relative_to_sma, ×1.5), {atom: candle.bullish_reversal}] } ], nextBarOnly: true } }` |
| S3 | gate rule (MA50>MA200) + entry rule (sequence: rsi_lt(35), rsi_cross_up(35)) + exit rule (rsi_gt(65)) |
| S4 | `condition: { and: [boll.touch_lower, volume.threshold(×1.5)] }` |
| S5 | entry condition: `and(price>MA100, macd.cross_up)`；exit condition: `or(price<MA100, macd.cross_down)` |
| S6 | `condition: { sequence: [breakout_up(24h), previous_extrema.retest_not_break] }` + effects: `[open_long, stop_loss.ref=previous_extrema]` |
| S7 | effects: `[atr_stop(×2), atr_take_profit(×3)]` |
| S8 | `condition: { and: [ema20_above@15m, ema20_above@1h, ema20_above@4h] }` |

每条都是「写一个表达式」。

## 6. 落地计划（一个 PR 内完成）

**单一 branch / 单一 PR**，subagent 并行执行下列工作流：

| 工作流 | 涉及文件 | 并行性 |
|---|---|---|
| **W1** types + zod | `types/atom-expr.ts`（新）, `types/semantic-state.ts`（扩 rules）, `types/codegen-semantic-patch.ts`（改 rules，删 atoms[]）| 独立 |
| **W2** atom roles | `atom-contracts/atom-contract-registry.ts`（给 100 atom 加 roles）, `atom-contracts/atom-contract-types.ts`（加 roles 字段定义）, `__tests__/atom-roles.invariant.spec.ts`（新） | 独立 |
| **W3** IR + contract | `services/canonical-spec-v2-ir-compiler.service.ts`（compileExpressionCondition 递归化）, `services/semantic-state-normalization.ts`（复用 buildTriggerCombinationContract）| 依赖 W1 |
| **W4** dispatcher + projection | `services/semantic-seed-state-builder.service.ts`（替换 dispatchAtomsByContractBucket → compileRules + projectRulesToFlat；删 withMovingAverageStackCombinationContracts）, `services/semantic-rule-projection.service.ts`（新）| 依赖 W1+W2 |
| **W5** planner prompt | `prompts/conversation-planner-system.prompt.ts`（JSON shape + BNF + 5 examples）, `prompts/atom-catalog-projection.ts`（按 roles 分组展示）, `services/codegen-conversation.service.ts`（zod retry）| 依赖 W1+W2 |
| **W6** reconciler | `services/semantic-missing-placeholder-reconciler.service.ts`（按 rules 角色齐备性判定）；删 `semantic.missing_*_atom` placeholder atom 注册 | 依赖 W4 |
| **W7** 4 个新 atom | atom-contract-registry.ts 内：`condition.sequence` 提升为正式 atom；`price.previous_extrema_retest` 新增；`risk.atr_take_profit` 新增；`volume.threshold` 扩 paramSlots（mode/multiplier/refWindow）| 依赖 W2 |
| **W8** 8 条策略 e2e | `apps/quantify/e2e/llm-strategy-codegen/eight-strategies.e2e-spec.ts`（新）；fixture 用 rules 形态 | 依赖全部 |
| **W9** baseline 重录 | dispatcher-self-baseline-*.json、各 spec golden snapshot | 依赖 W4 完成后 |

**并行批次**：
- 批次 1（并行）：W1 + W2 + W7（W7 在 W2 完成后并发跑也行；这里独立调度）
- 批次 2（依赖批次 1）：W3 + W4 + W5
- 批次 3（依赖批次 2）：W6 + W8（W8 真调 LLM，长任务）
- 批次 4：W9 重录 + 最终验证

## 7. 反建议（Linus 视角）

不做下列事：

- ❌ 兼容旧 atoms[]：测试期，能删就删（用户明示）
- ❌ 给 atoms[] 加 groupId 字段：那是给扁平结构打补丁，半成品
- ❌ 复活 v2 `semanticStrategyPredicateGraphSchema`：那是 hand-rolled 谓词，跟 atom registry 不通；保留作为 dead 分支，等下个清理周期删
- ❌ 一次性迁完 49 个 flat reader：超出本 PR 范围；rules→flat 派生让它们继续工作，下游消费者按需自行迁
- ❌ 多 PR 训：用户明示一个 PR；本 spec 已把工作量压到一个 PR 能容纳的极小可执行集

## 附录 A — atom roles 默认派生表

| bucket | 默认 roles | 例外（需手工标） |
|---|---|---|
| trigger | `['predicate']` | — |
| action | `['effect']` | — |
| positionConstraint | `['effect']` | — |
| risk | `['effect']` | `risk.atr_stop / risk.stop_loss_pct` 等：`['predicate', 'effect']`（被触及作为谓词，设置止损线作为副作用）|
| orchestration | gate.* `['predicate']`；其余 `['effect']` | 逐个 review |

## 附录 B — IR PredicateDef.kind 现状

```ts
'GT'|'GTE'|'LT'|'LTE'|'EQ'
| 'CROSS_OVER'|'CROSS_UNDER'
| 'TOUCH_LEVEL_UP'|'TOUCH_LEVEL_DOWN'|'WITHIN_LEVEL_SET'
| 'AND'|'OR'|'NOT'
| 'allOf'|'anyOf'
| 'sequence'|'compare'|'cross'
```

本 spec 不新增 kind，全部复用。

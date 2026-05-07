# AI Quant Phase 1 — Trigger-Kind Gate Atoms 设计

- **Issue**: #984 `feat: 建立 AI Quant 原子语义扩展 contract 与首批复杂策略执行闭环`
- **Phase**: Phase 1（Phase 0 substrate / readiness / corpus baseline 已 merged 至 `origin/main`）
- **PR 切分**: 本 spec 仅覆盖 PR-1 of 2
  - PR-1（本 spec）: 4 个 trigger-kind gate atom（共 5 个 key）
  - PR-2（后续）: `risk.partial_take_profit`（risk-kind reduce action），独立 spec
- **分支**: `feat/984-phase1-trigger-gates`，基于 `origin/main`
- **状态**: 设计已由用户确认，待落实施计划（writing-plans）

## 1. 范围与目标

### 1.1 PR-1 交付的 4 个 atom（5 个 key）

| Atom key | 当前状态 | 目标状态 | 语义 |
| --- | --- | --- | --- |
| `volume.threshold` | recognized_unsupported | supported_executable | 当前 K 线 base/quote/USD 成交量与阈值比较（GT/GTE/LT/LTE），不满足则阻止新开仓 |
| `volatility.atr_threshold` | recognized_unsupported | supported_executable | 当前 ATR 值与阈值比较，可指定 ATR period，不满足则阻止新开仓 |
| `strategy.time_window` | recognized_unsupported | supported_requires_slot | 在指定时区内的允许开仓时间段；缺 timezone 进入 open slot |
| `position.has_position` / `position.no_position` | 未注册 | supported_executable | 读取 runtime 仓位状态作为 gate；可选 sideScope（long/short/both） |

全部 5 个 key 在 registry 注册为 `kind: 'trigger', phase: 'gate'`。

### 1.2 非目标

- 不动 `risk.partial_take_profit`（PR-2）。
- 不动其他 Phase 2-5 atom。
- 不引入 `SemanticOrchestrationContract` 实体（Phase 5）。
- 不破坏现有 entry/exit/risk trigger 行为，不改 display graph。
- 不引入运行时 feature flag（YAGNI；旧 spec `gates: []` 已 byte-equal）。

### 1.3 核心目标

- 每个 atom 完成执行闭环：semantic state → contract → canonical spec v2 → canonical IR → compiled runtime → backtest → live signal fast path。
- 缺关键参数走 open slots，不静默默认；缺 runtime 能力保持 recognized_unsupported。
- atom coverage corpus 新增 8 个 case，覆盖 supported_executable / supported_requires_slot / 混合 supported+unsupported / sideScope 路由。

## 2. 数据结构改动

### 2.1 既有类型零变更项

- `SemanticTriggerState.phase` 已声明 `'entry' | 'exit' | 'risk' | 'gate'`，Phase 0 未真正使用 `'gate'`，本 PR 把它打通。
- `SemanticTriggerState.sideScope` 已声明 `'long' | 'short' | 'both'`，gate 复用此字段表达 side 收窄。
- 5 类 contract kind（`trigger / action / risk / position / context`）保持不变。

### 2.2 Canonical Spec v2 / IR 顶层新增 `gates` 字段

```ts
interface CanonicalSpecV2 {
  triggers: { entry: PredicateNode[]; exit: PredicateNode[] }
  gates: GateNode[]            // 新增，与 entry/exit 并列
  risk: RiskNode[]
  position: PositionNode
  context: ContextSlots
}

interface GateNode {
  atomKey: string                              // 5 个 key 之一
  sideScope: 'long' | 'short' | 'both'         // 影响哪一侧的新开仓
  predicate: PredicateExpression                // 复用既有 PredicateExpression
  effectWhenFalse: 'block_entry'                // Phase 1 固定值；Phase 5 orchestration gate 可扩 enum
}
```

向后兼容：旧 spec 缺 `gates` → 默认 `[]`；IR 编译器看到 `gates: []` 时不生成 gate 评估代码；runtime `evalGates` 早返回；旧 corpus snapshot diff = 0。

### 2.3 Atom Contract Substrate 模板

复用 Phase 0 的 `SemanticAtomContractSubstrate` 类型，新增 4 个 substrate 工厂（A/B/C/D）：

```ts
// A. 成交量 gate（volume.threshold）
{
  runtimeRequirements: [
    { domain:'runtime', verb:'provide', object:'bar_ohlcv' },
    { domain:'runtime', verb:'provide', object:'compiled_predicate_runtime' },
    { domain:'runtime', verb:'provide', object:'volume_series' },   // 新 helper
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
}

// B. ATR gate（volatility.atr_threshold）
{
  runtimeRequirements: [
    { domain:'runtime', verb:'provide', object:'bar_ohlcv' },
    { domain:'runtime', verb:'provide', object:'compiled_predicate_runtime' },
    { domain:'runtime', verb:'provide', object:'atr_helper' },      // 已存在
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
}

// C. 时间窗 gate（strategy.time_window）
{
  runtimeRequirements: [
    { domain:'runtime', verb:'provide', object:'bar_timestamp' },
    { domain:'runtime', verb:'provide', object:'timezone_clock' },  // 新 helper
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [
    { slotKey:'strategy.time_window.timezone',
      fieldPath:'gates[*].params.timezone',
      priority:'context',
      questionHint:'请指定该交易时间窗使用的时区，例如 Asia/Shanghai 或 UTC。' },
  ],
}

// D. 仓位 gate（position.has_position / position.no_position）
{
  runtimeRequirements: [],
  stateRequirements: [
    { domain:'state', verb:'read', object:'position_state' },       // 已存在
  ],
  orderRequirements: [],
  openSlots: [],
}
```

实际新增的 runtime helper 仅 2 个：`volume_series` 与 `timezone_clock`，均为纯函数。`atr_helper` / `position_state` 在 Phase 0 已被既有 atom 间接使用。

## 3. Atom Contract 细节

### 3.1 `volume.threshold`（supported_executable）

```ts
{
  key: 'volume.threshold',
  kind: 'trigger',
  phase: 'gate',
  requiredParams: ['metric', 'operator', 'value', 'unit'],
  defaultableParams: [],
  params: {
    metric: 'base_volume' | 'quote_volume',
    operator: 'GT' | 'GTE' | 'LT' | 'LTE',
    value: number,
    unit: 'base' | 'quote' | 'usd',
  },
  capabilities: [{ domain:'guard', verb:'gate', object:'entry_by_volume' }],
  requires:     [{ domain:'runtime', verb:'consume', object:'volume_series' }],
  effects:      [{ domain:'guard', verb:'block_entry_when_false', object:'new_position' }],
  // substrate A
}
```

### 3.2 `volatility.atr_threshold`（supported_executable）

```ts
{
  key: 'volatility.atr_threshold',
  kind: 'trigger',
  phase: 'gate',
  requiredParams: ['period', 'operator', 'threshold', 'thresholdUnit'],
  params: {
    period: number,
    operator: 'GT' | 'GTE' | 'LT' | 'LTE',
    threshold: number,
    thresholdUnit: 'price' | 'percent_of_close',
  },
  capabilities: [{ domain:'guard', verb:'gate', object:'entry_by_volatility' }],
  requires:     [{ domain:'runtime', verb:'consume', object:'atr_helper' }],
  effects:      [{ domain:'guard', verb:'block_entry_when_false', object:'new_position' }],
  // substrate B
}
```

### 3.3 `strategy.time_window`（supported_requires_slot）

```ts
{
  key: 'strategy.time_window',
  kind: 'trigger',
  phase: 'gate',
  requiredParams: ['timezone', 'windows'],
  params: {
    timezone: string,                                       // IANA tz
    windows: Array<{ daysOfWeek?: number[]; start: 'HH:mm'; end: 'HH:mm' }>,
  },
  capabilities: [{ domain:'guard', verb:'gate', object:'entry_by_time_window' }],
  requires:     [{ domain:'runtime', verb:'consume', object:'timezone_clock' }],
  effects:      [{ domain:'guard', verb:'block_entry_when_false', object:'new_position' }],
  // substrate C
}
```

issue 明确："默认语义：限制新开仓，不阻止已有仓位退出" → 通过 `effectWhenFalse: 'block_entry'` 保证 gate 不参与 exit/risk。

### 3.4 `position.has_position` / `position.no_position`（supported_executable，rev 3 命名澄清）

**两 atom 都是 positive gate**（block_entry_when_false 语义）：predicate 必须为 true 才允许进入 entry，否则 block 新开仓。**critic round 2 N1 修订**：避免与 atom 名读反：

| Atom | predicate 语义 | 用户自然语言 | runtime 触发 block 的条件 |
|---|---|---|---|
| `position.no_position` | "没有仓位" | "无仓时才开仓" / "已有仓不重复开" | `HAS_POSITION = true`（有仓时 block） |
| `position.has_position` | "已有仓位" | "已有仓时只允许加仓不允许新开"（少见） | `HAS_POSITION = false`（无仓时 block） |

`position.no_position` 是绝大多数用例（"已有仓不重复开仓"映射到此）；`position.has_position` 罕见但保留以满足 issue 列表完整性。

两个 key 独立注册，substrate 共享 D：

```ts
{
  key: 'position.has_position',           // 或 'position.no_position'
  kind: 'trigger',                         // 注意：kind 是 trigger，不是 position
  phase: 'gate',
  requiredParams: [],
  defaultableParams: ['sideScope'],
  params: {
    sideScope?: 'long' | 'short' | 'both',  // 默认 'both'
  },
  capabilities: [{ domain:'guard', verb:'gate', object:'entry_by_position_existence' }],
  requires:     [{ domain:'state', verb:'read', object:'position_state' }],
  effects:      [{ domain:'guard', verb:'block_entry_when_false', object:'new_position' }],
  // substrate D
}
```

issue 明确："不应误判为 unsupported add position" → `kind=trigger, phase=gate`，runtime 不会触发 add_position action。

### 3.5 5 个 atom 共有不变量

- `effects` 全部为 `guard.block_entry_when_false.new_position`。
- `orderRequirements` 全部为空。
- `phase === 'gate'`，由 contract 校验保证（不允许 entry/exit/risk）。
- `kind === 'trigger'`，符合"5 类 contract kind"原则。

## 4. 编译路径

```
LLM patch / user message
        │
        ▼
semantic-seed-extractor.service.ts
semantic-seed-state-builder.service.ts        // phase='gate', sideScope 默认 'both'
        │
        ▼
semantic-atom-registry.service.ts             // resolve key → SupportedAtomDefinition + substrate
semantic-atom-contract.service.ts             // 生成 SemanticAtomContract
        │
        ▼
semantic-state-projection.service.ts          // 缺 required → openSlot；substrate 缺 → unsupported
                                              // Phase 0 readiness fail-closed 自动适用
        │
        ▼
canonical-spec-builder.service.ts             // trigger.phase='gate' → spec.gates[]
        │
        ▼
canonical-spec-v2-ir-compiler.service.ts      // GateNode → IR.gates[]，predicate 复用既有编译器
        │
        ▼
packages/shared/src/script-engine/compiled-runtime/*
                                              // 每根 K 线先评估 IR.gates，全 true 才允许 entry trigger 触发
        │
        ├──► backtest adapter（消费同一 IR）
        └──► live signal adapter（消费同一 IR，fast path 同分支）
```

### 4.1 各层最小改动清单

| 层 | 改动 |
| --- | --- |
| `semantic-seed-extractor.service.ts` | 识别 5 个 atom key（含 sideScope / windows 解析） |
| `semantic-seed-state-builder.service.ts` | 写入 `triggers[]`，`phase='gate'` |
| `semantic-atom-registry.service.ts` | 5 个原 unsupported 项替换为 `executableTrigger`，附 4 个 substrate 工厂 |
| `semantic-atom-contract.service.ts` | 新增 substrate 模板 A/B/C/D |
| `strategy-semantic-contracts.ts` | 新增 5 个 contract spec |
| `semantic-state-projection.service.ts` | gate trigger 投影到 `spec.gates[]`（不进 entry/exit） |
| `canonical-spec-builder.service.ts` | 输出顶层 `gates: GateNode[]` |
| `canonical-spec-v2-ir-compiler.service.ts` | GateNode → IR.gates[] |
| `packages/shared/src/script-engine/compiled-runtime/*` | gate 评估阶段 + `volume_series` / `timezone_clock` helper |
| backtest runtime adapter | 消费 IR.gates[] |
| live signal runtime adapter | 同 backtest，fast path 走同一 IR 解释器 |

## 5. Runtime Gate 评估细节

### 5.1 onBar 顺序（硬编码常量化）

```
1. ingestBar(bar)            // OHLCV 与衍生指标更新
2. evalGates(ir.gates, ctx)  // 纯函数；写入 ctx.sideAllow
3. evalExitAndRisk(ir, ctx)  // 已有仓位的退出/风控；不读 sideAllow
4. evalEntry(ir, ctx)        // 既有 entry trigger；按 sideScope 查 sideAllow 决定开仓
5. emitOrders(ctx)
```

关键不变量：
- step 2 在 step 3 之前 → gate 失败时 exit 仍能触发，已有仓位可以退出。
- step 2 在 step 4 之前 → entry 评估完后按 sideAllow 收窄。
- evalGates 纯函数，无副作用 → 回放确定性与 Phase 0 一致。

### 5.2 sideAllow 收窄规则

```ts
type SideAllow = { long: boolean; short: boolean }

// 多个 gate AND；任一 gate predicate=false → 按 sideScope 关闭对应 side
//   sideScope='long'  → 只压制 long
//   sideScope='short' → 只压制 short
//   sideScope='both'  → 同时压制（默认）
//
// entry trigger 触发后，按 trigger.sideScope ?? 'both' 查 sideAllow，
// 对应 side 全 true 才发出 open 信号；否则丢弃该 entry，不写日志噪音
```

### 5.3 Helper 输入

| Atom | 读取 ctx 字段 | 来源 |
| --- | --- | --- |
| `volume.threshold` | `ctx.bar.baseVolume` / `quoteVolume` / 推导 USD（用 close） | 既有 OHLCV |
| `volatility.atr_threshold` | `ctx.indicators.atr(period)` | 既有 ATR helper |
| `strategy.time_window` | `ctx.bar.timestamp` + `timezone_clock(tz, ts)` | 新 helper（纯函数） |
| `position.has_position` / `no_position` | `ctx.position.qty[side]` | 既有 position state |

### 5.4 Backtest ↔ Live Signal Parity

- 同一 IR 解释器：gate 评估走同一份 `evalGates`，位于 `packages/shared/src/script-engine/compiled-runtime/`。
- helper 一致性：`volume_series` / `timezone_clock` 纯函数，无环境差异；`atr_helper` 已既有共享实现。
- 时间源：live signal 必须用 K 线收盘时间戳，禁止 `Date.now()`（既有不变量）。
- position state：backtest 模拟撮合产生；live 真实账户快照；同一 `position_state` 接口暴露给 gate。
- Parity 测试：每 atom 1 组 fixture，输入相同 OHLCV+仓位状态，gate 决策必须 byte-equal。

### 5.5 Fail-closed 边界

- predicate 抛错 → 视为 false → 关 entry。
- 非法 IANA tz → contract 校验阶段拦截；漏到 runtime → fail-closed 关 entry。
- `position_state` 读取失败（live race condition）→ 视为 unknown → 关 entry。
- ATR 在 lookback 不足时 NaN → predicate 任一边 NaN → false → 关 entry。

### 5.6 性能

- gate 评估 O(N_gates × N_predicate_nodes)，N_gates 通常 < 5；零分配。
- `gates: []` 时 `evalGates` 早返回 → 旧策略零开销。

## 6. 测试矩阵

### 6.1 Layer 1 — Atom Registry / Contract 单测

文件：`apps/quantify/.../__tests__/semantic-atom-registry.service.spec.ts`、`semantic-atom-contract.service.spec.ts`

每 atom 断言：
- `supportStatus` 正确（4 executable + 1 requires_slot for `time_window`）
- `requiredParams` / `defaultableParams` / `executableProjection` / `contractSubstrate`
- `kind === 'trigger'`、`phase === 'gate'`、`effects` 与 `orderRequirements` 正确
- substrate immutable（参考 Phase 0 invariant 模式）

### 6.2 Layer 2 — Projection / Open Slots

文件：`semantic-state-projection.service.spec.ts`

- 必填 param 全齐 → `supported_executable`，进入 `spec.gates[]`
- 缺任一必填 → `supported_requires_slot` + 对应 openSlot（`time_window` 缺 timezone 是核心 case）
- gate 不被错误投影到 `spec.entry` / `spec.exit`
- `position.has_position` 不被投影成 `position` kind 或 `add_position` action

### 6.3 Layer 3 — Canonical Spec v2 → IR 编译

文件：`canonical-spec-v2-ir-compiler.service.spec.ts` 中的 gate 段

- 单 gate / 多 gate AND
- gate.sideScope='long' → IR 携带正确 sideScope
- 旧 spec（无 `gates`）→ IR.gates 空数组，fixture diff = 0
- predicate 编译产物 snapshot 稳定

### 6.4 Layer 4 — Compiled Runtime 单测

文件：`packages/shared/src/script-engine/compiled-runtime/__tests__/gate-evaluator.spec.ts`（新增）

- gate=true → entry 正常开仓
- gate=false → entry 触发后不开仓
- gate=false 且已有仓位 → exit/risk 仍能平仓（关键不变量）
- 多 gate AND，任一 false → 对应 side 关闭
- predicate 抛错 / NaN → fail-closed 关 entry，不抛到上层
- `gates: []` → byte-equal 旧路径

### 6.5 Layer 5 — Backtest ↔ Live Parity

文件：`apps/quantify/.../__tests__/runtime-parity-gates.spec.ts`（新增）

每 atom 1 组 fixture：相同 OHLCV+仓位 → backtest path 与 live signal fast path 决策序列 byte-equal、gate 评估序列 byte-equal。Layer 5 是阻塞门禁。

### 6.6 Layer 6 — Atom Coverage Golden Corpus 增量

文件：`__tests__/fixtures/atom-coverage-golden-cases.ts` + `atom-coverage-golden-corpus.spec.ts`

| 类别 | 期望路由 | 数量 | 说明 |
| --- | --- | --- | --- |
| supported_executable 正例 | executable | 4 | 每 atom 一个最小可执行策略 |
| supported_requires_slot | requires_slot | 1 | `strategy.time_window` 缺 timezone |
| 混合 supported + unsupported | unsupported_unknown 优先 | 1 | gate + 一个 unsupported entry trigger 时不能伪支持 |
| gate 与已有 entry 组合 | executable | 1 | `volume.threshold` + `indicator.cross_over` 完整策略 |
| gate sideScope='long' | executable | 1 | `position.no_position` long-only 才开仓 |

合计 8 个新 corpus case；旧 case 0 行为变化。

### 6.7 Layer 7 — Quantify E2E

按 `ruler/development.md`：
- `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`（如已存在）
- 否则新增 1 个 happy-path：用户描述含成交量阈值 → 后端识别 → IR 含 1 gate + 1 entry → backtest 可跑 → live signal fast path 决策符合期望

### 6.8 运行入口

- 单测：`dx test unit quantify`（按改动文件指定）
- E2E：`dx test e2e quantify apps/quantify/e2e/<file-or-dir>`
- 共享包：`packages/shared` runtime jest 测试
- Lint：`dx lint`
- 构建：`dx build quantify --dev`、必要时 `dx build backend --dev`

## 7. 兼容性、回滚点、风险

### 7.1 兼容性保证

- 旧 canonical spec / IR 缺 `gates` → 默认 `[]`；runtime `evalGates` 早返回；行为 byte-equal。
- 现有 supported atom 的 contract / substrate / capabilities / requires / effects 零变更。
- 现有 `phase: 'entry' | 'exit' | 'risk'` 的 trigger 投影、IR 编译、runtime 路径零变更。
- 现有组合触发器 `actionKey` / `actionBinding` 语义保留（gate 不参与 action 绑定）。
- display graph 路径不消费 IR.gates，只读 SemanticTriggerState，旧策略展示无回归。
- 旧 corpus case `expectedRoute` 不变；新 case 只追加。

### 7.2 前向接口稳定（为 Phase 5 留口子）

- `effectWhenFalse: 'block_entry'` 是 enum，Phase 5 orchestration gate 的 `block_subStrategy` / `pause_program` 等只是新增 enum 值。
- `GateNode.sideScope` 已存在，Phase 5 多腿/多子策略的 scope 扩展走新增 `scopeRefs?: ScopeRef[]`，不冲突。

### 7.3 回滚点

| 粒度 | 触发 | 动作 |
| --- | --- | --- |
| 单 atom 回滚 | 某 atom 在 corpus / parity 不稳 | registry 单独退回 `recognized_unsupported`，replacement 指向已有 MA cross 兜底 |
| Gate 通道回滚 | runtime 新增评估阶段在 live 出问题 | revert PR；type 层 `phase: 'gate'` 与 `gates` 字段保留（向后兼容）不影响重做 |
| 整 PR 回滚 | 大面积异常 | `git revert` PR-1 commit |

不引入运行时 feature flag（YAGNI）。如 review 阶段发现 live runtime 改动比预期大，临时挂 build-time 编译开关，上线 1 周后清理。

### 7.4 主要风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `evalGates` 评估顺序错放 | gate 失败时仍开仓 / 已有仓位被错杀 | Layer 4 单测显式断言 "gate=false + 已有仓位 → 仍可 exit"；onBar 顺序硬编码 |
| `position.has_position` 被误判为 add_position | 现有兜底替换链触发，行为反转 | Registry 显式断言 `kind=trigger, phase=gate`；corpus 1 case 专门验证 |
| `time_window` 时区错位 | live 与 backtest 决策不一致 | `timezone_clock` 强制 IANA tz；contract 校验非法 tz；缺 tz 进 openSlot 而非默认 UTC |
| ATR lookback 不足 NaN | gate 静默 false，用户疑惑 | runtime 把 NaN-fail-closed 写入 strategy decision log；corpus 含 lookback 不足 case |
| Live ↔ Backtest 解释器分歧 | parity 测试漏掉的 edge case 在 live 触发 | Layer 5 parity test 阻塞门禁；任一 atom parity 失败不可 merge |
| volume `unit='usd'` 推导价格抖动 | 低流动性 symbol 报价精度差 | unit='usd' 时显式声明价格来源（K 线 close）；用户如需更稳走 unit='quote' |
| `gates: []` 反序列化丢失 | runtime 解读 undefined.gates 抛错 | IR builder 强制写出 `gates: []`；runtime 容错 `ir.gates ?? []` |

### 7.5 监控与可观测性

仅扩展既有 strategy decision log：
- 每根 K 线产生 `gate_eval`：`{atomKey, sideScope, predicateValue, allowedSidesAfter}`，与 entry/exit 同条 log line。
- backtest report 增加一行 "gates blocked entries: N"。

### 7.6 PR-1 ship 门 checklist

- [ ] 4 个 atom（5 个 key）在 registry 标 `supported_executable` 或 `supported_requires_slot`
- [ ] Layer 1-6 测试全绿；Layer 5 parity test 0 diff
- [ ] 新增 8 个 corpus case，覆盖率口径符合 Phase 0 标准
- [ ] `dx lint` 通过
- [ ] `dx build quantify --dev` 通过；必要时 `dx build backend --dev`
- [ ] `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` 通过
- [ ] 旧 corpus case 0 行为变化（snapshot diff = 0）
- [ ] PR 描述 `Refs: #984`，分支 `feat/984-phase1-trigger-gates`

## 8. 后续步骤

1. 用户 review 本 spec。
2. 通过后调用 superpowers:writing-plans skill 起实施计划（按文件 / 按测试层划阶段，含 review checkpoints）。
3. 实施进入 superpowers:executing-plans / superpowers:subagent-driven-development。
4. PR-1 ship 后基于新 main 起 PR-2（`risk.partial_take_profit`）独立 spec。

---

## 9. Spec 修订（post-critic round 1，Linus simplification）

**触发原因**：plan critic 第 1 轮揭示原 §2.2-§5 设计与既有 compiled-runtime 重复造轮——仓库已有完全等价的 `evaluateGuards` + `runDecisionPrograms` 通道。按 Linus "good taste：消除特殊分支"原则，重写 §2.2 / §4 / §5 的 IR-runtime 部分。原子语义层（§3 contract）保持不变。

### 9.1 既有可复用基础设施（dry-check 证据）

| 设施 | 文件 | 现状 |
|---|---|---|
| 主循环编排 | `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts:704-731` | `evaluateExprPool → evaluateGuards → evaluateRiskPredicates → runDecisionPrograms → runOrderPrograms` |
| 主循环编排（backtest） | `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts` | 同上调用栈，复用同一 compiled-runtime 函数 |
| Guard 评估 | `packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts` | 已实现 `EXPRESSION_GUARD` + `onBreach: 'BLOCK_NEW_ENTRY' \| 'FORCE_EXIT' \| 'HALT_STRATEGY' \| 'CANCEL_ORDER_PROGRAMS'`；输出 `CompiledGuardState.blockNewEntry: boolean` |
| Entry 抑制 | `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts:74-76` | `if (program.phase === 'entry' && guardState.blockNewEntry) continue` —— 已对 entry 短路 |
| Series 原语 | `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.ts:78-104` | 已支持 `VOLUME` / `ATR` / `POSITION_BARS_HELD` / `POSITION_AVG_PRICE` / `POSITION_PNL_PCT` |
| Predicate 原语 | 同上 `:129-146` | 已支持 `GT / GTE / LT / LTE / EQ / AND / OR / NOT` |
| 共享包 barrel | `packages/shared/src/script-engine/compiled-runtime.ts`（注：同名 `.ts` 文件，不是子目录 index） | 当前导出 7 函数 |
| Registry 字段 | `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts:212-303` | 字段名 `category`（不是 `kind`），与 type 文件 `SemanticContractKind` 同义 |

### 9.2 修订后的架构（取代原 §2.2 / §4 / §5）

**核心洞察**：5 个 gate atom 编译目标 = "已有 `evaluateGuards` 通道里的 `EXPRESSION_GUARD` 节点 + `onBreach='BLOCK_NEW_ENTRY'`"。`runDecisionPrograms` 既有的 `guardState.blockNewEntry` 短路天然实现"gate 失败仅压制新开仓、不阻塞 exit/risk"。**不新增 IR 字段、不新增 onBar 阶段、不新增 runtime 函数**。

```
LLM patch / user message
        │
        ▼
semantic-seed-extractor / state-builder
  → SemanticTriggerState{ phase: 'gate', sideScope, params }    （无变化于原 §4.1）
        │
        ▼
semantic-atom-registry / contract / readiness
  → 5 atoms: category='trigger', supportStatus 升级，substrate A/B/C/D     （原 §3 不变）
        │
        ▼
projection / canonical-spec-builder
  → phase='gate' triggers 仍归属 spec 内部"gate 段"（仅做收集，不下推为新 IR 顶层字段）
        │
        ▼
canonical-spec-v2-ir-compiler              ← 主要改动点
  对每个 gate trigger：
  (a) 把 predicate 物化进 ir.exprPool（复用现有 series + 比较 predicate 编译器）
  (b) 在 ir.guards[] 追加一项 GuardProgramNode：
        { kind:'EXPRESSION_GUARD', onBreach:'BLOCK_NEW_ENTRY',
          appliesTo: sideScope, predicateRef: <exprPool id> }
  (c) ir.topology.guardOrder 对应位置加 id
        │
        ▼
compiled-runtime（packages/shared）          ← 仅扩 2 个 series kind + 1 helper
  - 新增 series kind：HAS_POSITION（读 ctx.position.qty）
  - 新增 series kind：IN_TIME_WINDOW（读 ctx.bar.timestamp + timezone-clock helper）
  - 新增 helper：timezone-clock（纯函数 IANA tz 转 wall HH:mm + dayOfWeek）
  - VOLUME / ATR / GT/GTE/LT/LTE 复用既有
  - evaluateGuards / runDecisionPrograms 零改动
        │
        ├──► backtest adapter  （零改动；既有调用栈自动消费新 guards）
        └──► live signal       （零改动；同上）
```

### 9.3 IR 编译细节示例

**示例：`volume.threshold` `metric=base_volume, operator=GT, value=100, unit=base`**

编译产物（追加到 IR）：

```ts
ir.exprPool.push(
  { id: 'gate.vol_thresh.series', nodeType: 'series', payload: { kind: 'VOLUME' }, deps: [] },
  { id: 'gate.vol_thresh.const',  nodeType: 'series', payload: { kind: 'CONST', value: 100 }, deps: [] },
  { id: 'gate.vol_thresh.pred',   nodeType: 'predicate', payload: { kind: 'GT' },
    deps: ['gate.vol_thresh.series', 'gate.vol_thresh.const'] },
)
ir.guards.push({
  id: 'gate.vol_thresh',
  payload: {
    kind: 'EXPRESSION_GUARD',
    appliesTo: 'both',                    // sideScope
    predicateRef: 'gate.vol_thresh.pred',
    onBreach: 'BLOCK_NEW_ENTRY',
  },
})
ir.topology.guardOrder.push('gate.vol_thresh')
```

**关键点**：guard 默认语义是"predicate=true → guard 触发 → blockNewEntry"。但门控应当反过来——"成交量 > 100 才允许开仓"意味着"成交量 ≤ 100 时阻止"。所以 IR 编译器需要给 gate predicate **取反**：用户语义 "metric GT value" → IR predicate "metric LTE value"，或在 guard 节点加 `negatePredicate: true` 字段。**最简实现：编译器在 IR 阶段做 predicate operator flip**（`GT→LTE`、`GTE→LT`、`LT→GTE`、`LTE→GT`），不动 runtime。

### 9.4 sideScope 处理（Phase 1 范围，rev 3 修订）

`evaluateGuards` 现有 `appliesTo: 'long' | 'short' | 'both'` 字段已存在，并被 `isGuardBreached` 在 EXPRESSION_GUARD `scope='position'` 分支消费（位于 `packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts:79-85`）。但 `runDecisionPrograms` 现有 `blockNewEntry` 是单 bool，不区分 side。

**Phase 1 方案（critic round 2 N2 修订）**：
- IR 编译器**硬钉** `guard.payload.appliesTo='both'`，sideScope **不下推到 IR**。
- `SemanticTriggerState.sideScope` 仍按 extractor 识别保留在 canonical spec metadata（用于 display + 未来 Phase 5 orchestration），但不影响 compiled runtime 行为。
- 这避免 `appliesTo` 与"runtime 不区分 side"两者潜在二义性，runtime 行为可预测：所有 gate 失败都压制全部新开仓。

**Phase 5 orchestration gate** 将引入 `CompiledGuardState.blockNewEntryLong / blockNewEntryShort`，并在 `runDecisionPrograms` entry 阶段按 program action kind 检查 per-side。本 PR 不做。

**含义**：Phase 1 用户写"无多仓时才开多" → 有仓时 block 全部新开仓（包括 short）。对单边策略（绝大多数）正确；多空切换策略需等 Phase 5。Corpus 显式断言此行为，避免未来回归。

### 9.5 修订后的最小改动清单

| 层 | 文件 | 改动 |
|---|---|---|
| Type | `apps/quantify/.../types/semantic-state.ts` | 仅微调（如需）；不新增 `gates: GateNode[]` 顶层字段 |
| Registry | `apps/quantify/.../services/semantic-atom-registry.service.ts` | 5 atom 升级为 supported；新增 4 substrate 工厂；新增 `supportedRequiresSlotTrigger` helper（time_window 用）；可选拆 Task A0：把 `executableTrigger` 重构为可接受 substrate factory |
| Contract | `apps/quantify/.../services/strategy-semantic-contracts.ts` | 5 contract spec |
| Seed | `apps/quantify/.../services/semantic-seed-extractor.service.ts` + `semantic-seed-state-builder.service.ts` | 识别 + 写 `phase='gate'` |
| Projection | `apps/quantify/.../services/semantic-state-projection.service.ts` | phase='gate' trigger 归属 spec 内部 gate 段（实现细节，可在既有结构内做不外露） |
| Canonical builder | `apps/quantify/.../services/canonical-spec-builder.service.ts` | 收集 gate 段 |
| IR compiler | `apps/quantify/.../services/canonical-spec-v2-ir-compiler.service.ts` | 主要改动：把 gate trigger 编译为 exprPool + guards 条目，operator flip |
| compiled-runtime | `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.ts` | 加 `HAS_POSITION` + `IN_TIME_WINDOW` 两个 series kind |
| compiled-runtime | `packages/shared/src/script-engine/compiled-runtime/helpers/timezone-clock.ts`（新文件） | timezone-clock 纯函数，cache `Intl.DateTimeFormat` 实例 |
| compiled-runtime barrel | `packages/shared/src/script-engine/compiled-runtime.ts`（**同名 .ts，不是 index.ts**） | 加 timezone-clock re-export（如需对外） |
| Adapters | `signal-generator.service.ts` / `backtest-strategy-adapter.service.ts` | **零改动** |
| Tests | （详见 plan） | registry / contract / projection / IR compile / runtime new series / parity / corpus |

### 9.6 修订后的不变量映射（确保有红测覆盖）

| 不变量 | 落到哪个 task 红测 |
|---|---|
| `position.has_position` 投影到 trigger gate，不被识别为 add_position | seed-builder spec + projection spec |
| `time_window` 缺 timezone → openSlot；不默认 UTC | seed-builder spec + corpus case |
| `gate predicate operator flip` 正确（GT 变 LTE 触发 block） | IR compiler spec |
| gate 失败时 exit/risk 仍能触发 | parity spec 复用既有 `evaluateGuards` 既有 invariant，但加 1 case 证明 |
| 旧 IR（无 gate 编译产物）行为 byte-equal | parity spec snapshot diff = 0 |
| `Intl.DateTimeFormat` 实例缓存 | timezone-clock helper spec 性能测试 |

### 9.7 与原 §7 兼容性的差异

- 旧 spec / IR 不需要任何"`gates: []` 默认值"容错——因为根本没新增字段。
- 旧 corpus snapshot 自动 byte-equal，因为旧策略不进入 gate 编译路径。
- 回滚：单 atom 退回 unsupported；整 PR `git revert` 即可。无需 feature flag（diff 极小）。
- `runDecisionPrograms` 零改动 → live runtime 风险显著低于原方案。

### 9.8 命名澄清（critic C5）

仓库 registry 字段名 `category`，与 type 文件 `SemanticContractKind` 同义。本 spec 全文用 "kind" 描述概念时，落到 registry 实际写 `category: 'trigger'`。两者同义，不重命名。



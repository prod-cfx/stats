# AI Quant Phase 5 Orchestration Roadmap

日期：2026-05-09
Issue：#984
阶段：Phase 5 — orchestration contract 与执行闭环全量交付路线

## 背景

Issue #984 已完成 Phase 0/1/2 与 Phase 3 大部分，并补齐了 C 子线（Contract-first 自然语言入口，#1042）。Phase 1/3/4 残留 atom 由其他 lane 推进（Round A/B/C）。

本文档锁定 Phase 5 的全量交付方案。Phase 5 不是单 PR 工作量——issue 列出 13 条独立 bullet，覆盖 4 个 contract 类别（scope / gate / program / portfolioRisk）和约 10 类能力（多标的、多周期、多数据源、子策略切换、组合风控、状态门控网格、多腿、事件驱动、动态/自适应网格）。issue 风险节点明确要求"每个 atom / orchestration capability 独立 PR；若 runtime parity 不完整，保持 recognized_unsupported"。

本路线把 Phase 5 拆成 **12 个独立闭环 slice**，分 7 轮（D-0 到 D-6）交付。首批 slice S1 与现有 Round A/B/C 完全并行，无文件冲突。

## 目标

1. 把 issue Phase 5 全部 13 条验收 bullet 拆分成 12 个独立 slice，每个 slice 单独可发布、可回滚。
2. 每个 slice 的完成标准统一对齐 #1042 子线扩展定义：contract + 执行链 + presentation + golden utterance 全部齐备。
3. 提供并行/串行依赖图，使 lane 资源利用率最大化、文件冲突最小化。
4. 给出每个 slice 的风险点和独立回滚边界。
5. S1 作为 Phase 5 的第一个垂直闭环 slice，可立即与 Round A/B/C 并行启动。

## 非目标

- 不在本路线内同时启动所有 12 个 slice；按依赖图分轮次。
- 不修改 Phase 0-4 已 ship 的 atom 语义。
- 不重做 #1042 自然语言入口架构；新 slice 通过 frame + presentation 接入既有 gateway。
- 不绕过 issue 验收门禁的任意一项（contract / IR / runtime / parity / golden / fail-closed）。
- 不把 substrate-only 做成独立 PR——substrate 必须随首个使用它的 capability slice 一起 ship。

## 12 个 Slice 划分

每个 slice 标注关闭的 issue Phase 5 验收 bullet 编号（详见下文"验收映射表"）。

### S1 — `gate.regime` + 编排 substrate

- 关 bullet：#5、#6
- 交付：
  - 新增 `SemanticOrchestrationContract` 与 `SemanticOrchestrationState` 类型（顶层增加 `orchestration?` 槽位）
  - 新增 `SemanticOrchestrationRegistryService` 或扩展既有 registry 接入 orchestration kind
  - 实现 `kind: 'gate'` 的 substrate（`target / activeWhen / effectWhenFalse`）
  - 落地一个具体 gate atom：`gate.regime`（基于 trend / volatility / market state 控制 entry phase）
  - canonical spec v2 增加 `orchestration.gates[]` 输出
  - canonical → IR 编译器输出 entry-phase gate 评估节点
  - compiled runtime / backtest / live signal fast path 在 entry phase 评估 gate；effect=block_new_entries 时阻止开仓但不阻止平仓
  - presentation registry 条目（publicName "趋势/状态过滤"、aliases、positive/negative examples、display/clarification renderer）
  - gateway frame `RegimeGateFrame` + normalizer
  - golden corpus 至少覆盖："上涨趋势才允许做多"、"震荡市才启用策略"、"已有空仓时仍能正常退出"
- 依赖：无
- PR 量级：M（约 2000-3000 行，含测试）
- 与 Round A/B/C 文件冲突面：极小，纯顶层新增

### S2 — `scope.symbol` 基础与多标的绑定

- 关 bullet：#1、#2
- 交付：
  - `SemanticOrchestrationContract` 增加 `kind: 'scope'`
  - `SemanticOrchestrationState.scopes[]` 落地
  - 引入 ambient default：单标的策略未声明 scope 时，所有 atom 隐式继承"strategy 主标的"，行为与现有完全一致（向后兼容）
  - 多标的策略：`scope.symbols.length > 1` 时，readiness 强制要求每个 trigger/action/risk/position 显式声明 `scopeBinding.symbol`，缺失即 fail-closed 进入 `recognized_unsupported` 或 open slots
  - canonical spec / IR / runtime 解析 scope 绑定
  - presentation + gateway frame `SymbolScopeFrame` + 多标的 disambiguation clarification
  - golden corpus："BTCUSDT 和 ETHUSDT 同时按同一策略运行"、"BTCUSDT 做多、ETHUSDT 做空对冲"
- 依赖：S1（substrate），Round A/B/C 收尾（避免与现有 atom 改动冲突）
- PR 量级：L（涉及所有现有 atom 的 readiness 路径）

### S3 — `scope.timeframe` 升级

- 关 bullet：#1、#3
- 交付：
  - 把 Phase 3 已 ship 的 `multi_timeframe`（#1008 MVP）提升为 `kind: 'scope'`，明确 `primaryTimeframe` 与 `requiredTimeframes`
  - runtime 对数据缺失/未对齐/延迟输入 fail-closed（不补默认值，不静默继续）
  - 兼容现有 multi_timeframe golden corpus
  - presentation 复用 Phase 3 命名，仅在内部把 readiness 改走 scope 路径
- 依赖：S2（scope substrate）
- PR 量级：M

### S4 — `program.fixed_grid_gated` + program substrate

- 关 bullet：#5、#7、#8(fixed)
- 交付：
  - `SemanticOrchestrationContract` 增加 `kind: 'program'`
  - `SemanticOrchestrationState.programs[]` 落地
  - `activeWhen`（gate 引用） / `onDeactivate`（cancel/keep/close 三选一） / `rebuildPolicy`（fixed 阶段为 `static`） / `orderRequirements`（限价单、reduce-only、撤单）
  - 接入 live signal runtime 的 order lifecycle：program 进入/退出时挂/撤/维持订单
  - 落地一个具体 program atom：固定区间网格 `program.fixed_grid_gated`
  - presentation + gateway frame `OrderProgramFrame` + golden corpus
  - 必须包含 paper trading drill 与三种 onDeactivate 行为独立回归
- 依赖：S1（gate 引用）
- PR 量级：L（runtime 改动最深的一个 slice）

### S5 — `program.dynamic_grid`

- 关 bullet：#8(dynamic)
- 交付：
  - 基于 state/anchor 的动态网格：`rebuildPolicy: anchor_on_state_change`
  - 必须有重建频率上限保护，避免刷单
  - golden corpus 覆盖 anchor 变更触发重建路径
- 依赖：S4
- PR 量级：M

### S6 — `program.adaptive_volatility_grid`

- 关 bullet：#8(adaptive)
- 交付：
  - 基于 ATR / volatility 自适应调整 step 与 range：`rebuildPolicy: atr_window`
  - ATR 窗口 / 步长上下限 / 重建冷却时间
  - golden corpus 覆盖 ATR 区间变化触发 rebuild
- 依赖：S4
- PR 量级：M

### S7 — `portfolioRisk.drawdown_block`

- 关 bullet：#10(portfolio)
- 交付：
  - `SemanticOrchestrationContract` 增加 `kind: 'portfolioRisk'`
  - `SemanticOrchestrationState.portfolioRisk[]` 落地
  - 账户级回撤聚合通道（跨策略状态读取）
  - effect: `block_new_entries` 触发后，所有受影响策略入场被阻止，已有仓位允许退出
  - 建议先以 read-only 模式发布灰度一周再开启 effect
- 依赖：S1（gate effect 复用）
- PR 量级：M

### S8 — `portfolioRisk.symbol_exposure_cap` + `subStrategy_exposure_cap`

- 关 bullet：#10(symbol/subStrategy)
- 交付：
  - scope-bound exposure 聚合（symbol 级、subStrategy 级）
  - effect: `reduce_exposure` / `pause_subStrategy`
  - 必须依赖 S2 的 symbol scope 与 S10 的 subStrategy scope 已稳定
- 依赖：S2、S10
- PR 量级：M

### S9 — `scope.dataSource`

- 关 bullet：#1、#4
- 交付：
  - scope 子类 `dataSource`：声明 `primary` / `confirmation` / `event` 三种 source 角色
  - schema 与权限校验：未授权或 schema 不匹配的数据源 fail-closed
  - 与 #1042 gateway frame 整合声明 source 绑定
- 依赖：S2
- PR 量级：M

### S10 — `scope.subStrategy` + 切换 gate

- 关 bullet：#1、#9
- 交付：
  - subStrategy 容器：每个 subStrategy 拥有独立的 atom 集合
  - 切换条件（regime / volatility / 自定义 gate）
  - 切换时现有仓位与挂单 handover 策略：保守模式必须先平仓再切换；handover 模式作为后续增强
  - 切换条件不明确时 fail-closed
- 依赖：S2
- PR 量级：XL（最复杂的 slice）

### S11 — `scope.leg` + 多腿绑定

- 关 bullet：#1、#11
- 交付：
  - legScope substrate
  - 每腿 trigger/action/risk/position 必须绑定 legScope；未绑定不得执行
  - 多腿独立 sizing 与独立 risk
- 依赖：S2
- PR 量级：L

### S12 — `program.event_listener`（合并 Phase 4 `external.signal`）

- 关 bullet：#4、#12
- 交付：
  - 事件驱动 program：声明 event schema / source / 权限 / 幂等 key / 去重策略 / 过期策略
  - 与 webhook / external signal 路径整合
  - 缺任一关键 contract 时保持 unsupported 或 open slots
- 依赖：S4（program substrate）、S9（dataSource scope）
- PR 量级：L

## 验收映射表

| issue Phase 5 bullet | 关闭 slice |
|---|---|
| #1 orchestration.scopes 表达 symbol/timeframe/dataSource/leg/subStrategy/portfolio | S2、S3、S9、S10、S11 |
| #2 多标的：scope 绑定 + fail-closed | S2 |
| #3 多周期：primary + requiredTimeframes + 数据 fail-closed | S3 |
| #4 多数据源：feed binding + schema/权限 | S9、S12 |
| #5 orchestration.gates 控制 entry/strategy/subStrategy/orderProgram | S1、S4 |
| #6 "上涨趋势才允许做多" 进入 runtime gate | S1 |
| #7 趋势/状态门控网格 activeWhen / onDeactivate | S4 |
| #8 三种网格（fixed/dynamic/adaptive）声明 activeWhen/onDeactivate/rebuildPolicy/orderRequirements | S4、S5、S6 |
| #9 子策略切换 + 现有仓位/挂单处理 | S10 |
| #10 组合风控 portfolio/symbol/subStrategy | S7、S8 |
| #11 多腿 legScope 绑定 | S11 |
| #12 事件驱动 schema/source/权限/幂等/去重/过期 | S12 |
| #13 Phase 5 代表场景 golden corpus + canonical IR + compiled runtime + parity + live signal fast path | 每 slice 强制（见验收模板） |

## 依赖图与轮次

```
Round D-0（now，与 A/B/C 完全并行）
└── S1: gate.regime + substrate

Round D-1（A/B/C 收尾后串行）
└── S2: scope.symbol substrate

Round D-2（S2 后并行 4 PR）
├── S3: scope.timeframe
├── S4: program.fixed_grid_gated + program substrate
├── S7: portfolioRisk.drawdown_block
└── S9: scope.dataSource

Round D-3（S4 后并行 2 PR）
├── S5: dynamic_grid
└── S6: adaptive_volatility_grid

Round D-4（S2 后并行 2 PR）
├── S10: subStrategy + 切换 gate
└── S11: leg scope + 多腿

Round D-5（S2 + S10 后串行）
└── S8: exposure cap

Round D-6（S4 + S9 后串行）
└── S12: event_listener
```

最长串行链：D-0 → D-1 → D-2(S2) → D-4(S10) → D-5(S8) = 5 PR。其余通过并行收敛。

## 每 Slice 强制验收模板

任何 slice 缺任一项即不算闭环：

1. **Contract 注册**：`requires / effects / openSlots / orderRequirements / runtimeRequirements / stateRequirements / target` 全部声明
2. **Canonical spec v2**：进入 `orchestration.{scopes|gates|programs|portfolioRisk}` 子结构
3. **IR**：canonical → IR 编译器输出 lifecycle 节点（gate 评估 / program activate-deactivate / scope binding 解析 / portfolio risk evaluator）
4. **Compiled runtime**：`packages/shared/src/script-engine/compiled-runtime/*` 实现执行
5. **Backtest 适配**：`apps/quantify` backtesting 路径执行该 capability
6. **Live signal fast path**：`strategy-instances` / `strategy-signals` 路径执行
7. **Parity test**：backtest vs runtime 同输入同输出
8. **Presentation registry 条目**：publicName / aliases / positiveExamples / negativeExamples / displayRenderer / clarificationRenderer，零内部 key 泄漏
9. **Gateway frame**：`NaturalLanguageGatewayService` 抽取相应 frame，`SemanticFrameNormalizerService` 归一化为 orchestration patch
10. **Golden corpus**：`semantic-gateway-golden-corpus.spec.ts` 至少 1 正例 + 1 负例 + 1 fail-closed 路径
11. **Fail-closed 测试**：缺数据 / 缺参数 / scope 缺失 / schema 不匹配 / 权限缺失各路径走 `recognized_unsupported` 或 open slots
12. **Display 不污染 deploy truth**：display graph 仅消费 SemanticState + presentation，不读 frame 内部 evidence

## 风险与回滚

通用回滚原则：**任何 slice 的 runtime parity 不通过则保持 `recognized_unsupported`，不 ship `supported_executable`**（issue 风险节点原文）。

各 slice 风险点：

- **S1**：风险低，纯增量旁路；回滚 = 不注册 gate kind
- **S2**：横扫现有 atom readiness 评估；任何旧策略 readiness 退化即回滚；强制 ambient default 兼容
- **S3**：runtime 数据对齐协议变更；多周期 backtest 必须回归 Phase 3 corpus
- **S4**：唯一直接动 order lifecycle 的 slice，最大 runtime 风险；必须有 paper trading drill；onDeactivate 三种行为独立回归；回滚 = 关闭 program kind 注册
- **S5/S6**：rebuild 频率失控会刷单；需要硬限速 + e2e 长跑
- **S7**：账户级回撤计算引入跨策略 state 聚合通道；建议 read-only 灰度一周再开 effect
- **S8**：依赖 S2 + S10 同时稳定；任一漂移即 exposure 误算
- **S10**：subStrategy 切换 handover 是高风险 corner case；保守模式（先平仓再切换）必须为默认
- **S12**：webhook 外部输入需严格签名/幂等；与既有 external 信号路径合并须有 deprecation 通道

## 文件影响范围（预估）

新增：

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-orchestration-contract.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-orchestration-state.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-orchestration-registry.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`（追加 orchestration frame 类型）
- `packages/shared/src/script-engine/compiled-runtime/orchestration/*`
- `apps/quantify/src/modules/backtesting/orchestration/*`
- `apps/quantify/src/modules/strategy-signals/orchestration/*`

修改：

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`（新增 `orchestration?` 槽位）
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-contract.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts`

## 与 Round A/B/C 的协调

S1 与 Round A/B/C 完全并行，文件冲突面仅限于 `semantic-state.ts`（顶层增加 `orchestration?` 槽位，可作为 additive 字段，不破坏现有 atom）和 `semantic-presentation-registry.service.ts`（追加 entry，与 atom 新增 entry 互不冲突）。

S2 起的 slice 必须等 Round A/B/C 收尾，否则 S2 的 readiness 改动会与 atom 新增 readiness 反复冲突。

## 立即可启动的工作

1. **D-0**：S1 完整闭环 PR（substrate + gate.regime），1-2 个 PR、约 1 周交付窗口
2. **D-1 准备**：起草 S2 scope 兼容方案（ambient default vs 显式绑定）作为 RFC，A/B/C 收尾后立刻起 PR

## 验收标准

本路线本身的验收：

1. 12 个 slice 与 issue Phase 5 13 条 bullet 一一对齐，无遗漏（见验收映射表）
2. 每个 slice 有明确依赖、PR 量级、风险点、回滚路径
3. 每个 slice 必须满足强制验收模板 12 项
4. 最长串行链 ≤ 5 PR，其余通过并行收敛
5. 与 Round A/B/C 的协调边界清晰（S1 完全并行，S2 起串行）

Phase 5 全量交付的验收（按 issue 原文 13 条 bullet）依赖全部 12 个 slice 闭环，本路线提供拆分与排期保证而非单 PR 即可达成。

## 后续

下一步通过 writing-plans skill，对 **S1（gate.regime + 编排 substrate）** 出可执行实施计划，作为 Phase 5 的首批落地工作。S2-S12 在各自起点前再分别走 plan 流程。

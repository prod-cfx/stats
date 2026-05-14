# Per-Trade Sizing Evidence Capability — 标准证据声明位决策

**Date**: 2026-05-11
**Status**: Accepted
**Issue**: #1175
**Related plan**: `docs/superpowers/plans/2026-05-11-per-trade-sizing-resolver-multi-pr.md`（v3，gitignored working artifact，本文档为其 canonical extract）

## 现状

quantify ai-quant 模块当前 sizing 证据散落在 4 个挂载点，3 个判定器各扫一处，contract-readiness 再独立扫一遍。各 atom 的 capability 命名不统一：

| 原子 | 当前 capability | sizing 字段位置 |
|------|----------------|----------------|
| 一般 action（grid ladder 等） | `capital.allocate.per_order_budget` | `shape.value` |
| `position.dca_schedule` | `runtime.schedule.dca_orders` | `shape.perOrderSizing` |
| `position.pyramiding_limit` | `exposure.limit.pyramiding_layers` | shape 内 layer-sizing（暂无统一位置） |

后果：DCA 的 `perOrderSizing` 锚定后，对话系统仍追问 `position.sizing`，因为所有判定器查的是 `capital.allocate.per_order_budget`，而 DCA 不 emit 该 capability。

## 决策

**所有"自带 per-trade 资金分配语义"的 atom，必须 emit `capital.allocate.per_order_budget` capability 作为单一标准证据声明位。**

具体规则：

1. 在 atom 的现有 capability 基础上**追加**一条 `capital.allocate.per_order_budget`，shape 复制自原 capability 的 sizing 部分。**不替换、不重命名**原 capability，避免冲击 canonical-spec / runtime intent 等下游既有读侧。
2. 该 capability 是 sizing evidence 的**唯一标准声明位**。
3. 通过 `ATOM_CONTRACT_REGISTRY` 的 `sizingEvidence` 字段（PR4 引入）声明 atom 对该 capability 的贡献，由 TS exhaustive Record + INVARIANT-J 双层守门强制覆盖。

## 唯一读侧约束

以下所有 sizing-evidence 消费者**必须**通过 `CapabilityEvidenceIndex.byKey('capital', 'allocate', 'per_order_budget')` 读取，**禁止**任何下游再从 `runtime.schedule.dca_orders.shape.perOrderSizing` / `exposure.limit.pyramiding_layers.shape.*` / 任何 atom 专属 capability 抽取 sizing 字段：

| # | 消费者 | 文件 | 当前读取方式 |
|---|--------|------|-------------|
| 1 | sizing 守门 #1 | `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` | `hasContractPerOrderBudget(actions)` → 改读 resolver |
| 2 | sizing 守门 #2 | `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts` | 同上 → 改读 resolver |
| 3 | sizing 守门 #3 | `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts` | `detectSizingItems` 直查 `riskRules.positionPct` → 改读 resolver |
| 4 | contract-readiness | `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts:303` | 自扫 `state.actions` → 改读 `EvidenceIndex.byKey` |
| 5 | state-projection | `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts:2145` | `findCapability(action.contracts, ...)` → 改读 `EvidenceIndex.byKey` |
| 6 | canonical-spec-builder | `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts:1217 / 1394` | 自枚举 `['per_order_budget', 'total_budget']` 扫 contracts → 改读 `EvidenceIndex.byKey` |
| 7 | sizing-resolver（新增） | `apps/quantify/src/modules/llm-strategy-codegen/services/per-trade-sizing-resolver.service.ts` | 直接构造在 EvidenceIndex 之上 |

## 不做什么

- **不动 `runtime.schedule.dca_orders` capability 的原形态**：`shape.perOrderSizing` 字段保留作 atom 行为语义自描述（atom 自身的行为渲染、回放、tooling 仍可读它），但**不作为 sizing evidence 来源**。
- **不重命名任何现有 capability**：避免冲击 canonical-spec / signal-executor / runtime intent 等下游。
- **不引入新的 capability 命名空间**：复用既有 `capital.allocate.per_order_budget`。

## 后续约束

任何新增"自带 per-trade 资金分配语义"的 atom（DCA 变体、pyramiding、scaling、grid ladder、Kelly 公式 sizing 等）**必须**：

1. 在 `synthesize*Contract` 中 emit `capital.allocate.per_order_budget` capability，shape 复制 sizing 字段
2. 在 `ATOM_CONTRACT_REGISTRY` 该 atom 条目填非空 `sizingEvidence: { capability, paramSource }`
3. 把 atom key 加入 `SIZING_BEARING_ATOMS` 白名单
4. 同步在 `__tests__/` 加 spec 验证主路径 anchor source === `'position_constraint'`（或 `'action'`，按挂载点决定），非 fallback

不贡献 sizing 的 atom（trigger / risk / context 类）在 `ATOM_CONTRACT_REGISTRY` 中**必须显式填 `sizingEvidence: null`**，表示"已审计、不贡献"，避免漏填被 INVARIANT-J 误报。

## INVARIANT-J 定义与覆盖范围

**形式化定义**：

> ∀ atom k ∈ `SIZING_BEARING_ATOMS`，`ATOM_CONTRACT_REGISTRY[k].sizingEvidence` 必须非 null。

**编译期守门**：

- `AtomContract` interface 在 `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-types.ts` 添加 `sizingEvidence: SizingEvidence | null` 必填字段（非 optional），由现有 `satisfies Record<SupportedAtomKey, AtomContract>` exhaustive 守门强制每个 atom 显式声明。

**运行期守门**：

- `assertSizingEvidenceRegistered(registry)` 函数遍历 `SIZING_BEARING_ATOMS`，发现 null 即 throw。由 `__tests__/INVARIANT-J.spec.ts`（或合并到 `corpus-invariants.spec.ts`）调用，编译通过但白名单缺项时单测失败。

**覆盖范围**：

- 初始白名单：`['position.dca_schedule']`
- PR4.2 完成 pyramiding sizing-evidence emit 后追加 `position.pyramiding_limit`
- 后续新增 sizing-bearing atom 必须同步白名单 + sizingEvidence 填值，否则单测立即失败

## 测试覆盖要求

对应 `Issue #1175` 验收标准，本决策的覆盖测试包括：

- **PR2 resolver 单测 42+ case**：包含 source 标签验证（主路径 `'position_constraint'` / `'action'` vs 退化路径 `'position_constraint_params_fallback'`）
- **PR3 / PR3test**：5 个 codegen-conversation 端到端 case + dca-schedule.parity 扩展（PR3test 不锁 source，源 pin 留 PR4）
- **PR4**：dca-schedule.parity.spec.ts 收紧 `source === 'position_constraint'`；INVARIANT-J spec 故意破坏白名单可触发失败；ATOM_CONTRACT_REGISTRY 所有 atom 显式声明 sizingEvidence

## Canonical Extract 声明

本文档为 plan `docs/superpowers/plans/2026-05-11-per-trade-sizing-resolver-multi-pr.md` 的 PR0 段 / PR4.5 段 / Round 1+2+3 critic 决议的 canonical extract。

**源信息以本决策文档为准**。未来约束变更（如新增 sizing-bearing atom / 调整唯一读侧消费者清单 / 修订 INVARIANT-J）必须**先改本文档，再同步 plan/spec**。

plan 文件本身是 gitignored working artifact（`.gitignore:71` `/docs/superpowers/`），不进入版本控制；本决策文档进入版本控制并作为长期约束载体。

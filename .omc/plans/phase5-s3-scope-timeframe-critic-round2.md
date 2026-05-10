# Phase 5 S3 Plan Critic Round 2

## 总评
**REJECT** — 2 Critical / 4 Major / 3 Minor

Round 1 修正项 C1-C5 / M1-M6 在新 plan 文本里都体现了；bar-bucket 数学、alignment 默认值 strict、≥1 强制 binding、共存 spec 都落到了对应 §。但新引入的"T6b live publication gate" 落点不实；"primary tf 必须比 required 粒度细" 没在 readiness 校验里强制（bar-bucket 数学的隐含前提）；"drift gate spec" 落在 packages/shared 但需要跨 quantify import；以及 §5 Modify 文件列表与 §4.8.3 描述不一致。

---

## Critical（2）

### [C1-R2] Live publication gate 注入点未确定，§5 Modify 未列实际 live 部署入口
- 位置: §4.8.3 / §5 Modify list / T6b
- 缺陷: 实际 live 部署入口是 `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts deployStrategy()`。plan §5 没有列入这个文件；`signal-generator.service.ts` 是 per-bar runtime 路径，跑到那里时部署已落库；codegen-publication-persistence 是 publish-snapshot 时机。
- 修复建议: §4.8.3 + §5 Modify + T6b 显式锁定 `account-strategy-view.service.ts deployStrategy()`（或 `resolveDeployPayload`）作为 gate 主落点；plan 写明：`scope.timeframe spec 在 deployStrategy mode='LIVE' 时调用 validateScopeTimeframeLiveDeployable，拒抛 ORCHESTRATION_SCOPE_TIMEFRAME_LIVE_UNSUPPORTED`，并补 `account-strategy-view-deploy-safety.spec.ts` 1 case 验证。

### [C2-R2] readiness 缺 `parseTimeframeMs(primary) < min(parseTimeframeMs(required))` 校验
- 位置: §4.2 / §4.3 9 重 / 8 重 fail-closed / §4.7.3 数学
- 缺陷: A2.4e 只检查 `primaryTimeframe ∉ requiredTimeframes`；§4.7.3 "primary tf 比 required 细" 写在注释里，但没有 readiness 强制。用户配 `primary=1h, required=[15m]`（颠倒），通过所有 readiness 检查；runtime alignment 公式语义破坏（primary 比 required 粗时 bucket 比较退化）。
- 修复建议: 增加 fail-closed `orchestration.scope.timeframe.primary_granularity`：`parseTimeframeMs(primary) < min(...requiredTimeframes.map(parseTimeframeMs))`；§4.3 readiness 8 重升 9 重；§4.2 9 重升 10 重；A2 拆开新增 A2.4f + golden corpus 1 negative case `primary=1h required=[15m]` → fail-closed。

---

## Major（4）

### [M1-R2] Drift gate spec 落点错——packages/shared 不能 import quantify
- 位置: §4.7.2 + §5 Create `parse-timeframe-ms.spec.ts`
- 缺陷: `SEMANTIC_SUPPORTED_TIMEFRAMES` 在 quantify；drift gate spec 在 packages/shared 无法 import 来对比。
- 修复建议: drift gate spec 改放 `apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/timeframe-vocab-drift.spec.ts`。

### [M2-R2] §4.7.2 双 source-of-truth 违 KISS
- 位置: §4.7.2
- 缺陷: types 一份 const，runtime 又复制一份带 ms。Linus taste：消除分支。
- 修复建议: 选一：(a) packages/shared 提供 `TIMEFRAME_MS`，quantify types `re-export Object.keys(TIMEFRAME_MS)`；(b) quantify 是 source，packages/shared 接外部映射注入。任一去掉双 source；drift gate spec 删除（M1-R2 也随之消解）。

### [M3-R2] T6b 与 §5 Modify 不一致——`account-strategy-view.service.ts` 缺
- 位置: §5 Modify list / T6b 表
- 缺陷: 与 C1-R2 同根因——§5 没列入实际 live deploy 入口；T6b 实施时无 file 锚点。
- 修复建议: §5 Modify 加 `account-strategy-view.service.ts` + 对应 deploy spec；不再依赖 signal-generator.service.ts。

### [M4-R2] `applyTimeframeScopeBindingFailClosed` open→locked 流转未明
- 位置: §4.3 + §4.4
- 缺陷: scope 节点 status='open'（参数 clarification 中）时 spec builder 不输出、readiness 不强制 owner ref；status 变 locked 后才触发——这个流转 plan 没写明。
- 修复建议: §4.3 显式声明流转语义；§9 #4 补描述；golden corpus Section B 加 1 case：scope status='open' 时 owner 无 ref → ok=true；同 scope 改 'locked' → 立刻冒出 missing_binding。

---

## Minor（3）

### [m1-R2] §4.7.3 注释 "primary tf 比 required 细" 在 C2-R2 修复后才成立
- 修复建议: 注释从"假设"改为"前置条件（A2.4f 已 fail-closed 保证）"。

### [m2-R2] §A11 parity case 列举不完整
- 修复建议: A11 补上 4 种边界 case（normal / data_unavailable / required_missing / alignment_lag），与 §9 #7 一致。

### [m3-R2] N3 negative 应入 golden corpus 而非只在 §9 #6
- 修复建议: §4.9.1 补 N3 ("BTCUSDT 主标的，ETHUSDT 跟随" → 不产 timeframe_scope frame)，golden corpus Section A 覆盖。

---

## Summary

REJECT — Round 2 必修：C1-R2 + C2-R2 + M1-R2/M2-R2（合并：单一 source 收敛后 drift gate 消解）+ M3-R2 + M4-R2。

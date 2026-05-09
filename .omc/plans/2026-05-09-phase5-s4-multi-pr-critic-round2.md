# S4 Plan Critic — Round 2

**Verdict: REVISE**

| 类别 | Round 1 | Round 2 |
|---|---|---|
| Critical | 2 | 0 |
| Major | 4 | 4 (新) |
| Minor | 3 | 3 |

## Round 1 修复核验
C1/C2/M2/M3/M4/W3/W4/W6/W7 全部落实。

## Round 2 新 Major

### J1: synthesizeCloseDecision 函数不存在，未声明新建
plan 第 69 行调用，但 codebase grep 0 结果，Files.Create/Modify 未列其归属。

**Fix:** Acceptance 增 bullet：synthesizeCloseDecision 新建在 backtest-strategy-adapter.service.ts 内部 private helper，签名与三态映射明确（qty>0→CLOSE_LONG / qty<0→CLOSE_SHORT / qty===0→NOOP）。

### J2: Files.Modify line 109 第 6 参数 vs Acceptance line 43 第 7 参数
内部矛盾。Acceptance 与 Files.Modify 字数不一致。

**Fix:** line 109 改"加第 7 参数 orchestrationPrograms（保留 _executionModel? 不动）"。

### J3: closeProgramIds 双声明（CompiledOrderState vs manifest.meta）
plan 第 50 行 vs 第 64 行双路径。round 1 M1 fix 要求"adapter 直采 orderState 不依赖 manifest"。

**Fix:** 删除 line 64 manifest.meta 措辞；锁死单一路径："adapter onBar 闭包合成 close decision 后通过 buildCompiledManifest 入参传入；closeProgramIds 不污染 manifest"。

### J4: 第 13 重 fail-closed 与现有 readiness 签名不兼容
现有 `applyOrchestrationReadinessForNode(node, registry, strategyVersion)` 是逐节点函数，无法访问兄弟节点。

**Fix:** Acceptance 显式说明：`isSupportedFixedGridGated(node, registry, strategyVersion, siblingNodes)`；同步在 `normalizePhase0Orchestration` 主循环把 nodes 入参带入；保持 isSupportedRegimeGate / isSupportedPortfolioDrawdownBlock 同签名风格。

## Minor

- N1: Files.Modify line 102 / Wave 2 T2 line 128 文本同步 14 重
- N2: golden corpus 18 vs 16 数字不一致
- N3: closeProgramIds 注入顺序 显式 runDecisionPrograms 之后

## Missing

- K1: synthesizeCloseDecision 三态语义表
- K2: buildCompiledManifest 出口形态
- K3: lowerBound/upperBound 4 种存在性组合语义
- K4: referenced gate version-gate unsupported 但 status locked 时是否 fail-closed

## 升级到 ACCEPT 的最低条件
J1+J2+J3+J4 修复，N1-N3 文本同步。

# Phase 5 S3 PR Critic Round 1

## 总评
**PASS-WITH-RESERVATIONS** — 0 Critical / 3 Major / 4 Minor

S3 实施基本完整对齐 plan critic Round 3 PASS 后的设计：types union 升级、registry 10 重 fail-closed、readiness ≥1 强制 binding、bar-bucket 数学（strict diff=0/tolerant diff≤1）、parseTimeframeMs 单一 source-of-truth、backtest caller 接通、live publication-gate 防呆、emitter byte-equal、NL gateway 双门槛、display 不泄漏 scope.timeframe 内部 key。但有 3 处 Major 测试覆盖缺口 / 逻辑边界漏洞。无 Critical 实施漏洞。

## Critical（0）
无。

## Major（3）

### [M1] A11 plan deliverable 未落地 publication-gate 集成测试
- 位置：`apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts` 未新增 timeframe-scope live 拒绝 case
- 缺陷：plan A11 显式要求 "live 路径只验证 publication gate **拒** scope.timeframe deploy"。当前仅断言 exception 自身 shape，没有 spec 实证 `deployStrategy({mode:'LIVE'}, snapshot 含 timeframe scope)` 真的会抛 + `deployStrategy({mode:'TESTNET'}, ...)` 不抛。回归保护缺失
- 修复建议：deploy-safety spec 加 3 case：(a) LIVE + ast.orchestrationScopes 含 scopeKind='timeframe' → 抛；(b) TESTNET + 同 snapshot → 不抛；(c) LIVE + 无 timeframe scope → 不抛

### [M2] negative bucketDiff（required 领先 primary）未 fail-closed
- 位置：`packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts:1681-1684`
- 缺陷：bar-bucket 数学只检查正向 lag。当 `requiredBucket > primaryBucket`（required tf 时间戳比 primary 还新，意味着 required feed 跑过头/数据竞争）→ bucketDiff 为负 → `< 0 ≤ maxBucketDiff` → 默默 'continue'。违反 fail-closed 原则
- 修复建议：改为 `if (bucketDiff < 0 || bucketDiff > maxBucketDiff)`；apply-timeframe-scope-alignment.spec.ts 加 1 case：required tf 时间戳 > primary 应 fail-closed

### [M3] decisionProgram.metadata.timeframeScopeRef round-trip 未在 byte-equal 验证
- 位置：`apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter-scope-byte-equal.spec.ts`
- 缺陷：runtime alignment 真正消费 `program.metadata.timeframeScopeRef`，不是 ORCHESTRATION_SCOPES。byte-equal 只覆盖 scopes 数组的 JSON.stringify，未证明 metadata 透传契约。spread `metadata: ruleBlock.metadata` 当前正确，但缺回归锁
- 修复建议：byte-equal spec 加 1 case：构造 baseAst 含 `decisionPrograms[0].metadata.timeframeScopeRef='tf-1'`，emit→parse 后断言 `parser.parse(script).decisionPrograms[0].metadata.timeframeScopeRef === 'tf-1'`

## Minor（4）

### [m1] failClosed reason key 命名一致性
`unbound_program` / `unknown_scope` / `data_unavailable` / `primary_missing` / `required_missing` / `alignment_lag` 命名混合（动词性 / 名词性）。S2 follow-up 修起来变 breaking。

### [m2] `parseTimeframeScope` evidenceText 截断 80 字符
`text.slice(0, Math.min(text.length, 80))` 等价于 `text.slice(0, 80)`，`Math.min` 多余但无害。

### [m3] display token kind 命名一致性
`atom.scope.timeframe.display.with_required` token kind=`atom`，与 plan §A12 一致。

### [m4] 注释 "9 重" / "10 重" 数量差异未解释
registry 写"10 重"，readiness 写"9 重"。差异在 unsupported_key 检查。建议补一行注释说明。

## What's Missing

- A14/A15 contracts diff 在 commit msg 声称已跑；本 PR diff 未含 quantify.contracts 生成产物 diff（A15 trivially pass，因 OpenAPI surface 不变）
- A9.2 "decision stage 强制写 ctx.timeframeBarStatus = undefined" 双保险冗余防呆未实施。因 publication-gate 已挡，可接受不实施

## Summary

REJECT-LITE → 修 M1+M2+M3 后即 PASS。M2 是真实逻辑漏洞（negative bucketDiff silent pass），M1+M3 是回归锁缺失。

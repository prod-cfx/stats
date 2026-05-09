# S7 Plan Critic — Round 2

**Verdict：ACCEPT-WITH-RESERVATIONS**

| 类别 | Round 1 | Round 2 |
|---|---|---|
| Critical | 1 | 0 |
| Major | 3 | 1 (M4) |
| Minor | 4 | 3 |

## Round 1 修复核验

- C1 (drawdownPct 数据源)：已修复 — Files.Modify + Task 13/14 完整
- M1 (类型签名)：已修复 — Step 12.2 改 OrchestrationPortfolioRiskState
- M2 (observe + undefined)：已修复 — Step 11.2 evaluator 重写完成，矛盾分支删除
- M3 (parity)：已修复 — Task 15.1 5 cases 含 observe + 共存
- m1/m2/m4：已修复
- m3：未修复（pnpm exec → dx test 待修）

## 新 Major

### M4: atomic-contract parity spec 未列入 Files.Modify
`apps/quantify/.../atomic-contract-backtest-runtime-parity.spec.ts:1` 同时 import `StrategyExecutionContextV1` 与 `runDecisionPrograms`。新 ctx 字段 + 第 7 参数可能让该 spec silent pass，protocol contract 出现可视化盲区。**Fix：** Task 17 加 grep+run 验证。

## 残留 Reservations

1. m3：Step 17.1 改用 dx test / dx lint（违反 ruler/conventions §2）
2. Stakeholder：bullet #10(portfolio) "closed" 口径需精确化（live enforce gated by follow-up issue），PR body 显式列 follow-up 编号
3. Task 9 spec 加 case "gates+portfolioRisks 全空 → orchestration 字段省略"

## 升级到 ACCEPT 的最低条件

修完上述 3 reservations。可在 plan 当下修复或 PR review 阶段处理。

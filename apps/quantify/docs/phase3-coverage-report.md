# Phase 3 多时间框架与扩展 atom 覆盖率报告

更新日期：2026-05-08
对应 issue：#1021

## 范围

Phase 3 已交付的扩展 atom 与多时间框架能力对应的 fixture / 单测覆盖：

| 能力 | 关键 commit | 当前测试覆盖 |
|------|-------------|--------------|
| `risk.time_stop_bars` | 508fea88 | `phase3-time-stop-cases.ts`（3 个 fixture case，对应各自 atom 单测 ~56 断言） |
| `price.previous_extrema` | c07b9108 | `phase3-previous-extrema-cases.ts`（4 个 fixture case，对应 IR compiler / readiness 共 ~37 断言） |
| `condition.multi_timeframe` | 24250ae1 | `phase3-mtf-cases.ts`（5 个 fixture case，对应 IR compiler `compilePhase1GateAtom` ~5 open_slot 键回归） |

> fixture 路径：`apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/phase3-*.ts`

## Follow-up issue / PR 落地清单（issue #984 衍生）

| Issue | 描述 | PR | 状态 |
|---|---|---|---|
| #1013 | canonical-spec-builder requiredTimeframes | — | closed（已落地，未单独开 PR） |
| #1014 | strategy-consistency 多时间框架一致性校验 | #1024 | merged |
| #1015 | semantic-seed-extractor 中英文短语识别扩展 | #1033 | merged |
| #1016 | backtest entry phase HTF alignment guard | #1028 | merged |
| #1017 | live signal entry HTF alignment gate | #1029 | merged |
| #1018 | readiness gate timeframe 配对 | #1025 | merged |
| #1019 | condition.sequence 归一化兼容增强 | #1023 | merged |
| #1020 | evaluate-expr-pool kind=memory operand + invalidate API | #1036 | open |

## 三能力联调

本 PR 新增 corpus spec：

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/phase3-integration-corpus.spec.ts`

聚合 mtf / previous_extrema / time_stop 三组 fixture，对每个 case 走 readiness 三段链路（seed extractor → state builder → support classifier），断言：

1. 流水线确定性、不抛异常
2. classifier 路由结果存在且为非空字符串

### 降级说明

原始任务期望串联 `CanonicalSpecBuilderService.build()` → `CanonicalSpecV2IrCompilerService.compile()` → `CompiledPublicationGateService.evaluate()` 三层。实际形态：

- 现有 phase3 fixtures 以自由文本 `message` 为输入，与 atom-coverage-golden-cases 同源
- spec → IR → gate 三层在生产链路中由 codegen orchestrator 装配，需要 IR adapter / digest / canonicalizer / validator / parser / repository 等多重依赖
- 在不修改业务代码的约束下，无法用 fixture.message 直接驱动这三层

故采用 smoke + readiness 三段降级形态，并在 spec 末尾以 `it.todo` 登记 spec→IR→gate 完整串联待补齐项。

## 已知缺口

- **#1020 / PR #1036**：`evaluate-expr-pool` kind=memory operand + invalidate API 仍在 open
- **#1022**（独立 Track C）：`position.entryTimeframe` 字段在 backtest/live 写入路径需要 Prisma migration，目前未在本期交付窗口内
- **spec → IR → gate 三层完整串联**：等待 codegen orchestrator 测试夹具落地后由后续 PR 补齐

## 数据汇总

- Phase 3 fixture 总数：12 个 case（mtf 5 + previous_extrema 4 + time_stop 3）
- 联调集成覆盖：本 PR 新增 13 个测试断言（1 个 corpus 形态校验 + 12 个 case 链路断言 + 1 个 todo 占位）
- 既有 unit / IR compiler / readiness 单测覆盖：各 atom 在对应 service spec 中已存在专项测试

## 验证

- `pnpm dx lint` ✅
- `npx jest --testPathPattern=phase3-integration-corpus` ✅（13 PASS / 0 FAIL）

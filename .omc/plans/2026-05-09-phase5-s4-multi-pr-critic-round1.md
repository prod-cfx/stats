# S4 Plan Critic — Round 1

**Verdict: REVISE**

## 决策矩阵

| 类别 | 数量 |
|---|---|
| Critical | 2 |
| Major | 4 |
| Minor | 3 |
| What's Missing | 7 |

## Critical

### C1: runOrderPrograms 第 6 参数已被 _executionModel? 占用

`run-order-programs.ts:22-29` 现签名 6 参数（含 _executionModel?）。3 处 call site (backtest-strategy-adapter:148 / signal-generator:751 / compiled-script-emitter:47) 都传 6 实参。

**Fix:** 改为新增**第 7 参数** orchestrationPrograms，所有 callsites 显式传 7 元参数 + emitter wrapper template 更新。

### C2: emitter / parser / projection / preflight 漏列入 Files

S1+S7 模板必改：
- compiled-script-emitter.service.ts (ORCHESTRATION_PROGRAMS const + wrapper 模板)
- compiled-script-parser.service.ts (readRequiredConst('ORCHESTRATION_PROGRAMS'))
- CompiledScriptProjection 类型（如有）
- backtest-compiled-snapshot-preflight.service.ts:92 projection 镜像

**Fix:** Files.Modify 加上述 4 文件；Wave 4.5 emitter/parser sub-task。

## Major

### M1: closeProgramIds 与 buildCompiledManifest 衔接路径

`buildCompiledManifest` 是否需要扩展把 closeProgramIds 暴露给 adapter 层？backtest-runner.service.ts:521 消费 workingOrders，closeProgramIds 走哪条通路？

**Fix:** 明确 adapter 层 onBar 直采 orderState（不依赖 manifest），在 onBar 内 capture closeProgramIds → 后续合成 close 信号。

### M2: closeProgramIds → CLOSE_LONG/SHORT 合成位置含混

plan 三处口径冲突：
- "取代 OPEN_*"
- "上层决定如何转"
- "不影响主决策路径"

**Fix:** 锁定方案 — backtest-strategy-adapter 在 runOrderPrograms 后 + runDecisionPrograms 已返回的 decision 上合并：仅当 decision 不是已存在 CLOSE_*/REDUCE_* 时，将 closeProgramIds.length>0 翻译为伴生 close-position 信号；绝不覆盖 decision，绝不取代 OPEN_*。

### M3: union 膨胀 narrowing 教训未吸收

7 个 program-only optional 加到 SemanticOrchestrationNode；S7 已踩过 narrowing 蔓延的坑。

**Fix:** 在 Acceptance 显式声明：凡读取 program-only 字段处必须先 `kind==='program'` narrowing；新增类型守卫 `isProgramNode(node)` 复用。

### M4: fail-closed 8 重不全，缺数值边界

缺：lowerBound > upperBound 倒挂 / levelCount 非正整数 / stepPct ≤0 或 >100 / anchorPrice ≤0 / sizing.value 非正 / sizing.mode 非法枚举

**Fix:** 扩成 14 重，readiness spec 全覆盖。

## Minor

- m1: "零内部 key 泄漏"列表不应禁 gate id 露出（program 必须引用 gate id 作为 activeWhenRef）
- m2: closeProgramIds 与 cancelledProgramIds 语义关系：onDeactivate='close' 是否同时进入 cancelledProgramIds？（建议：不进入，独立旁路）
- m3: ≤3 轮 critic 乐观（S1/S7 实际更多）

## What's Missing

- W1: emitter / parser / projection / preflight 改动列表（C2）
- W2: buildCompiledManifest 是否扩展（M1）
- W3: CompiledOrchestrationProgram 类型定义位置（应位于 packages/shared/.../compiled-runtime/）
- W4: gate ref 解析时机锁死 — IR 阶段 inline 为 activeWhenExprId 字符串
- W5: Wave 6 backtest 接入是否拦截 OPEN_* — 应明确删除该措辞或形式化
- W6: golden corpus W5 case 具体断言形式
- W7: paper trading drill 在 backtest vs live 边界 — backtest 不需要真 paper trading；live 才需要

## 升级到 ACCEPT 的最低条件

1. C1：第 6 → 第 7 参数 + 三处 callsites + emitter wrapper template
2. C2：补齐 emitter / parser / projection / preflight Files + Wave 4.5 task
3. M2：锁死 CLOSE_* 合成位置 + 不覆盖 decision 算法伪码
4. M4：fail-closed 8 → 14 重
5. W3：明确 CompiledOrchestrationProgram 类型位置
6. W4：IR 阶段 inline activeWhenExprId 字面量

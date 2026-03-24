# LLM 策略代码生成自动修复设计

## 背景与问题
当前 `llm-strategy-codegen` 在首轮生成脚本后会做 TypeScript 编译、静态与运行时校验。真实线上请求已复现：模型产出脚本经常出现协议不一致（旧字段 `action/reason` 混用、`LONG` 枚举错误、`implicit any`、语法缺失），导致直接 `REJECTED`。

目标是：在单次会话请求内自动修复失败脚本，优先把可修复问题收敛为可发布结果，减少用户手动重试。

## 目标
- 当首轮生成失败时，自动执行最多 2 次“带错误原因的修复重生成”。
- 任意轮次通过完整校验即发布（`PUBLISHED`）。
- 若全部失败，仍返回业务态 `REJECTED`，并返回最终失败原因，不抛 500。

## 非目标
- 不改变前端会话协议字段。
- 不引入新模型路由或异步任务队列。
- 不改变现有静态/运行时校验规则，仅复用。

## 方案总览
采用“后端内置自愈重试”方案，在 `CodegenConversationService` 生成分支加入 `generateWithAutoRepair`。

流程：
1. 正常生成 `script_v1`。
2. 使用现有校验链（TS 编译 + static + runtime/output）验证。
3. 失败则构造修复提示词：`原脚本 + rejectReason + 协议强约束`。
4. 再生成 `script_v2`，继续校验；必要时执行 `script_v3`。
5. 任意一次通过则 `PUBLISHED`；全部失败则 `REJECTED`。

## 关键设计

### 1) 统一验证函数
新增内部函数 `validateGeneratedScript(script)`，统一返回：
- `passed: boolean`
- `stage: 'ts' | 'static' | 'runtime' | 'output'`
- `reason?: string`

复用现有：
- `compileStrategyScriptForVm`
- `StaticGuardrailService.validate`
- `RuntimeGuardrailService.validate`

### 2) 修复提示词策略
新增 `buildRepairUserPrompt`，固定包含：
- 原始需求与 checklist（避免漂移）
- 原脚本全文（便于局部修复）
- 上轮 `rejectReason` 全文（精确对错）
- 强约束（必须 `StrategyAdapterV1`，最后一行 `strategy`，禁止旧输出协议，`ctx.paramsNormalized` 优先）

### 3) 状态与持久化
- 仍按现有状态机推进（`GENERATING -> VALIDATING_* -> PUBLISHED/REJECTED`）。
- 每轮失败脚本写入 `llm_strategy_code_versions`（`staticPassed/runtimePassed/outputPassed` 保留）。
- 最终 `REJECTED` 时写入最后一次 `rejectReason`。

### 4) API 行为
- 始终返回业务态结果（`PUBLISHED` 或 `REJECTED`），不在生成链路尾部抛 500。
- `REJECTED` 返回 `rejectReason` 与最后脚本片段（若有）。

## 风险与控制
- 风险：请求时延增加。控制：重试上限 2 次，后续可配置。
- 风险：模型修复后引入新违规。控制：每轮必须通过同一校验链。
- 风险：错误原因过长。控制：`rejectReason` 保留关键诊断段，必要时截断存储但前端显示优先完整摘要。

## 验收标准
- 同一请求内自动修复最多 2 次。
- 使用真实失败样例（session `cmn2ttfh62fk5llh82ruj9e93` 同类脚本）可在测试中从首轮失败恢复到 `PUBLISHED`。
- 连续失败时返回 `REJECTED + rejectReason`，且接口不返回 500。

## 相关文件
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- （可选）`apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-codegen-system.prompt.ts`

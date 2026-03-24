# LLM 代码生成 Strict 模式设计

## 背景
当前策略代码生成已接入 TypeScript 编译校验与运行时 guardrail，但模型输出仍可能出现格式偏移（非纯代码、结构污染、字段漂移），导致后续校验成本上升和失败率增加。

目标是在 **代码生成阶段** 引入 LLM strict 输出约束，降低输出格式错误概率，同时保持现有 TS/guardrail 链路兼容。

## 目标
- 仅在 codegen 阶段使用 strict 输出契约。
- 强制模型以结构化 JSON 返回 `code` 字段，再进入现有校验流程。
- provider 不支持 strict 时可按配置降级到旧文本模式。

## 非目标
- 不改 planner 阶段输出协议。
- 不改策略运行时协议（`StrategyAdapterV1/StrategyDecisionV1`）。
- 不引入异步任务或额外持久化表。

## 方案总览
采用“strict JSON 包装代码”方案：
- 请求：codegen 调用附加 strict schema（`{ code: string }`）。
- 响应：优先解析 `data.code`；失败后按配置回退文本解析。
- 下游：保持 `compileStrategyScriptForVm -> staticGuardrail -> runtimeGuardrail` 不变。

## 关键设计

### 1) Strict 输出契约
Schema v1:
- type: object
- required: `code`
- additionalProperties: false
- `code`: 非空字符串

### 2) 服务层改造点
- `CodegenConversationService.generateScript` 增加 strict 请求选项。
- 解析优先级：strict JSON > fallback text。
- 若 strict 失败且 `LLM_CODEGEN_STRICT_FALLBACK=true`：回退旧模式。
- 若 strict 失败且 fallback 关闭：直接返回 `REJECTED`（保留明确原因）。

### 3) Provider 适配层
- `AiService.chat` 扩展可选 `responseFormat` 参数。
- `openai-compatible.adapter` 在支持时透传 strict schema。
- provider 不支持时返回显式错误码/错误文案，供上层决定降级。

### 4) 配置项
- `LLM_CODEGEN_STRICT_ENABLED=true`
- `LLM_CODEGEN_STRICT_FALLBACK=true`
- `LLM_CODEGEN_STRICT_SCHEMA_VERSION=v1`

## 风险与控制
- 风险：部分 provider 对 strict 支持不稳定。
  - 控制：能力探测 + fallback 策略。
- 风险：strict 响应合法但 code 空字符串。
  - 控制：服务层做非空校验并拒绝。
- 风险：错误信息不够可观测。
  - 控制：日志记录 `mode=strict|fallback-text` 与失败阶段。

## 测试与验收
- strict 成功返回 `{code}`，可进入现有发布链路。
- strict 缺失 `code` 时：可回退或 REJECTED（由配置决定）。
- provider 不支持 strict 时：fallback 开启则继续生成，不抛 500。
- 自动修复链路中 strict 同样生效。

## 相关文件
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- `apps/quantify/src/modules/ai/ai.service.ts`
- `apps/quantify/src/modules/ai/providers/openai-compatible.adapter.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

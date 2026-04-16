import { buildContextSchemaPrompt } from './context-schema.prompt'
import { buildStrategyProtocolTypeContractPrompt } from './strategy-protocol-contract.prompt'

export function buildStrategyCodegenSystemPrompt(helperSignatures: string): string {
  return [
    '你是量化策略脚本生成器（仅用于调试与对照，不是正式发布真源）。',
    '正式发布链路以 canonical -> IR -> AST -> compiled script 为准。',
    '不得假设自己输出的脚本会直接进入 published snapshot。',
    '必须输出 TypeScript（.ts）源码，允许类型注解；不要输出 markdown 代码块。',
    '只能使用 helpers.finance/helpers.array/helpers.ta/helpers.signal。',
    '禁止使用 import/require/eval/Function/process。',
    '需求和约束中的每一条 canonical 语义、semanticState 派生约束，以及会影响运行时决策的 risk / sizing / context，都必须在代码中有明确对应实现。',
    '每一条 canonical 语义都必须对应代码中的一个独立条件判断或执行分支，禁止多个语义共享同一个条件表达式。',
    '禁止将多个 exit 或 risk 语义合并为单一 if 条件；每条语义必须独立判断并独立触发行为。',
    '对于“连续 N 根 K 线”类规则，必须显式实现逐 bar 计数或序列判断逻辑，禁止使用单一条件近似替代。',
    '若某条规则实现复杂，必须优先用最直接方式实现（例如显式计数、逐条件判断），禁止因复杂度而省略或弱化。',
    '禁止遗漏任何已经明确的策略语义；如果规则已出现在 canonical 语义或 semanticState 中，就不能静默忽略。',
    '禁止把强语义规则弱化；例如“直接平仓”不能实现成“减仓”，“强制止损”不能实现成普通提示。',
    '禁止依赖旧 checklist 文本分类推断策略真实语义。',
    'exchange / marketType / symbol / timeframe 等市场元数据必须体现在执行模型、参数约束或编译配置中；不要为了“覆盖”而伪造无意义的运行时代码分支。',
    '生成前先逐条检查需求和约束里的 canonical 语义是否都已覆盖，确认每条语义都能在代码中找到对应逻辑。',
    '必须严格遵循以下 TypeScript 接口与输出合同（逐字遵守类型约束）：',
    buildStrategyProtocolTypeContractPrompt(),
    '严格规则：',
    '1) 最终返回值必须是上述 strategy 对象（最后一行必须是 strategy）。',
    '2) 不允许返回旧格式信号对象（direction/signalType/...）。',
    '3) action=NOOP 时可省略 size；其他 action 必须有 size。',
    '4) action=ADJUST_POSITION 时 size.mode 必须是 "QTY"，adjustMode 只能是 TARGET 或 DELTA。',
    '5) confidence 若提供必须在 0~100。',
    '6) 通用字段优先使用 ctx.paramsNormalized；策略自定义字段可从 ctx.params 读取，不要臆造参数名。',
    '7) 只输出纯 TypeScript 源码，不要任何说明文字。',
    'ctx 运行时上下文字段（可直接读取）：',
    buildContextSchemaPrompt(),
    '以下是当前环境允许使用的 helper 函数签名（严格按签名调用，不要臆造函数）：',
    helperSignatures,
  ].join('\n')
}

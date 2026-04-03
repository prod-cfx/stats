import { buildContextSchemaPrompt } from './context-schema.prompt'
import { buildStrategyProtocolTypeContractPrompt } from './strategy-protocol-contract.prompt'

export function buildStrategyCodegenSystemPrompt(helperSignatures: string): string {
  return [
    '你是量化策略脚本生成器。',
    '必须输出 TypeScript（.ts）源码，允许类型注解；不要输出 markdown 代码块。',
    '只能使用 helpers.finance/helpers.array/helpers.ta/helpers.signal。',
    '禁止使用 import/require/eval/Function/process。',
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

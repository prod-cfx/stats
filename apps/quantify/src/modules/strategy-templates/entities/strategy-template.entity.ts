import type {
  JsonValue,
  StrategyDataRequirements,
  StrategyExecutionConfig,
  StrategyLegDefinition,
  StrategyStatus,
} from '../types/strategy-template.types'

/**
 * StrategyTemplate 代表策略“蓝图”，定义策略的交易对象、数据需求和执行配置。
 */
export interface StrategyTemplateEntity {
  id: string
  name: string
  description: string
  /**
   * 策略腿定义 - 定义策略的交易对象
   */
  legs?: StrategyLegDefinition[]
  /**
   * 策略执行配置 - 定义信号触发周期和冷却时间
   */
  execution?: StrategyExecutionConfig
  /**
   * 数据需求 - 定义每个 leg 需要加载的时间周期数据
   */
  dataRequirements?: StrategyDataRequirements
  llmModel: string
  promptTemplate: string
  script?: string | null
  paramsSchema: JsonValue
  defaultParams?: JsonValue
  rulesJson: JsonValue | null
  /**
   * @deprecated 使用 dataRequirements 替代
   */
  requiredFields: string[]
  rulesVersion: number
  status: StrategyStatus
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  updatedBy?: string
  lastGenerationSummary?: string | null
  metadata?: JsonValue
}

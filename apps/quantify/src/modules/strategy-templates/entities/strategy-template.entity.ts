import type {
  JsonValue,
  StrategyDataRequirements,
  StrategyExecutionConfig,
  StrategyLegDefinition,
  StrategyStatus,
} from '../types/strategy-template.types'

/**
 * StrategyTemplate 浠ｈ〃绛栫暐鐨?钃濆浘"锛屽畾涔夌瓥鐣ョ殑浜ゆ槗瀵硅薄銆佹暟鎹渶姹傚拰鎵ц閰嶇疆銆?
 */
export interface StrategyTemplateEntity {
  id: string
  name: string
  description: string
  /**
   * 绛栫暐鑵垮畾涔?- 瀹氫箟绛栫暐鐨勪氦鏄撳璞?
   */
  legs?: StrategyLegDefinition[]
  /**
   * 绛栫暐鎵ц閰嶇疆 - 瀹氫箟淇″彿瑙﹀彂鍛ㄦ湡鍜屽喎鍗存椂闂?
   */
  execution?: StrategyExecutionConfig
  /**
   * 鏁版嵁闇€姹?- 瀹氫箟姣忎釜 leg 闇€瑕佸姞杞界殑鏃堕棿鍛ㄦ湡鏁版嵁
   */
  dataRequirements?: StrategyDataRequirements
  llmModel: string
  promptTemplate: string
  script?: string | null
  paramsSchema: JsonValue
  defaultParams?: JsonValue
  rulesJson: JsonValue | null
  /**
   * @deprecated 浣跨敤 dataRequirements 鏇夸唬
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

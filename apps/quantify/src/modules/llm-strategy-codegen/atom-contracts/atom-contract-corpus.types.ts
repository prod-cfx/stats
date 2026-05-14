/**
 * NL corpus 数据契约（#1329 follow-up：从 legacy-presentation-data.ts PRESENTATIONS 迁入）
 *
 * 取代 PRESENTATIONS 的 4 个 corpus 字段（aliases / positiveExamples / negativeExamples / goldenUtterances）。
 * 每个 atom 必填，让 REGISTRY 成为 NL corpus 单一真相源。
 */
export interface AtomContractCorpus {
  /** 同义词 / 别名（NL 识别用）*/
  readonly aliases: readonly string[]
  /** 正例 utterance（识别应通过）*/
  readonly positiveExamples: readonly string[]
  /** 反例 utterance（识别应拒绝）*/
  readonly negativeExamples: readonly string[]
  /** golden utterance（dispatcher fixture）*/
  readonly goldenUtterances: readonly string[]
}

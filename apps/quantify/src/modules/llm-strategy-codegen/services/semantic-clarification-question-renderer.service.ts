import { Injectable } from '@nestjs/common'

export interface RenderSemanticClarificationQuestionInput {
  slotKey: string
  fallback: string
}

export const SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY: Record<string, string> = {
  'contract.shape.price.level_set.density': '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
  'contract.shape.price.level_set.spacing_conflict': '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
  'contract.requirement.price.define.level_set': '请补充网格价格区间和网格数量或每格间距。',
  'trigger.percent_change.magnitude': '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
  'trigger.confirmation.rebound_definition': '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。',
  'trigger.confirmation.pullback_hold': '请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。',
  'risk.falling_knife_guard.definition': '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
  'position.sizing': '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
  'trigger.volume.relative_average.lookback_bars': '请确认放量对比的均量窗口，例如过去 20 根 K 线。',
  'trigger.volume.relative_average.multiplier': '请确认放量倍数，例如高于均量 1.5 倍。',
}

export function renderSemanticClarificationQuestion(input: RenderSemanticClarificationQuestionInput): string {
  return SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY[input.slotKey] ?? input.fallback
}

@Injectable()
export class SemanticClarificationQuestionRendererService {
  render(input: RenderSemanticClarificationQuestionInput): string {
    return renderSemanticClarificationQuestion(input)
  }
}

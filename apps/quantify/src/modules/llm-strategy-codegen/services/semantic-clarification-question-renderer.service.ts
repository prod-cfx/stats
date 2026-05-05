import { Injectable } from '@nestjs/common'

export interface RenderSemanticClarificationQuestionInput {
  slotKey: string
  fallback: string
}

export const SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY: Record<string, string> = {
  'contract.shape.price.level_set.density': '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
  'contract.shape.price.level_set.spacing_conflict': '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
  'contract.requirement.price.define.level_set': '请补充网格价格区间和网格数量或每格间距。',
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

import type { StrategyClarificationItem } from '../types/strategy-clarification'

export class StrategyClarificationQuestionService {
  buildPrompt(item: StrategyClarificationItem): string {
    return `${item.reason}，所以我先确认一个点：${item.question}`
  }
}

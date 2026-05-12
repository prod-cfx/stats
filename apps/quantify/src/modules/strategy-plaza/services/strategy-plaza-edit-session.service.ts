import { Injectable } from '@nestjs/common'
import { CodegenConversationService } from '@/modules/llm-strategy-codegen/services/codegen-conversation.service'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'
import type { OfficialStrategyPlazaEditSeed } from '../types/official-strategy-plaza-template'

function normalizeLocale(locale: string | null | undefined): 'zh' | 'en' {
  return locale === 'en' ? 'en' : 'zh'
}

function resolveEditSeed(seed: OfficialStrategyPlazaEditSeed, locale: string | null | undefined) {
  const normalizedLocale = normalizeLocale(locale)
  return seed.locales?.[normalizedLocale] ?? {
    initialMessage: seed.initialMessage,
    guideConfig: seed.guideConfig,
  }
}

@Injectable()
export class StrategyPlazaEditSessionService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly codegenConversationService: CodegenConversationService,
  ) {}

  async startEditSession(input: {
    userId: string
    templateId: string
    locale?: string | null
  }) {
    const template = this.templates.getRequired(input.templateId)
    const editSeed = resolveEditSeed(template.editSeed, input.locale)
    const session = await this.codegenConversationService.startSession({
      initialMessage: editSeed.initialMessage,
      guideConfig: editSeed.guideConfig,
    }, input.userId)

    return {
      sessionId: session.id,
      templateId: template.id,
      initialMessage: editSeed.initialMessage,
    }
  }
}

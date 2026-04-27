import { Injectable } from '@nestjs/common'
import { CodegenConversationService } from '@/modules/llm-strategy-codegen/services/codegen-conversation.service'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

@Injectable()
export class StrategyPlazaEditSessionService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly codegenConversationService: CodegenConversationService,
  ) {}

  async startEditSession(input: {
    userId: string
    templateId: string
  }) {
    const template = this.templates.getRequired(input.templateId)
    const session = await this.codegenConversationService.startSession({
      initialMessage: template.editSeed.initialMessage,
      guideConfig: template.editSeed.guideConfig,
    }, input.userId)

    return {
      sessionId: session.id,
      templateId: template.id,
      initialMessage: template.editSeed.initialMessage,
    }
  }
}

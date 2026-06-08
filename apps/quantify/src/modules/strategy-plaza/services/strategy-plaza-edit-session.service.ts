import { Injectable, Optional } from '@nestjs/common'
import type { AiQuantConversationBacktestConfigDto } from '@/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto'
import { CodegenConversationService } from '@/modules/llm-strategy-codegen/services/codegen-conversation.service'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'
import type { OfficialStrategyPlazaEditSeed, OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { buildOfficialTemplateBacktestConfigDefaults } from '../utils/official-strategy-plaza-snapshot-content'

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
    @Optional()
    private readonly backtestDraftConfigBuilder: {
      build: (template: OfficialStrategyPlazaTemplate) => AiQuantConversationBacktestConfigDto
    } = { build: template => buildPlazaEditBacktestDraftConfig(template) },
  ) {}

  async startEditSession(input: {
    userId: string
    templateId: string
    locale?: string | null
  }) {
    const template = this.templates.getRequired(input.templateId)
    const locale = normalizeLocale(input.locale)
    const editSeed = resolveEditSeed(template.editSeed, input.locale)
    const session = await this.codegenConversationService.startSession({
      initialMessage: editSeed.initialMessage,
      guideConfig: editSeed.guideConfig,
      locale,
    }, input.userId)
    if (typeof session.conversationId === 'string' && session.conversationId.trim().length > 0) {
      await this.codegenConversationService.updateConversationBacktestDraft(
        session.conversationId,
        input.userId,
        this.backtestDraftConfigBuilder.build(template),
      )
    }

    return {
      sessionId: session.id,
      templateId: template.id,
      initialMessage: editSeed.initialMessage,
    }
  }
}

function buildPlazaEditBacktestDraftConfig(
  template: OfficialStrategyPlazaTemplate,
): AiQuantConversationBacktestConfigDto {
  const defaults = buildOfficialTemplateBacktestConfigDefaults(template) as {
    initialCash?: unknown
    leverage?: unknown
    slippageBps?: unknown
    feeBps?: unknown
    priceSource?: unknown
    allowPartial?: unknown
    range?: {
      preset?: unknown
      startAt?: unknown
      endAt?: unknown
    }
  }

  return {
    range: buildBacktestDraftRange(defaults.range),
    execution: {
      initialCash: typeof defaults.initialCash === 'number' ? defaults.initialCash : 10000,
      leverage: typeof defaults.leverage === 'number' ? defaults.leverage : null,
      slippageBps: typeof defaults.slippageBps === 'number' ? defaults.slippageBps : 10,
      feeBps: typeof defaults.feeBps === 'number' ? defaults.feeBps : 5,
      priceSource: defaults.priceSource === 'open' || defaults.priceSource === 'mid' ? defaults.priceSource : 'close',
      allowPartial: defaults.allowPartial === true,
    },
  }
}

function buildBacktestDraftRange(defaultsRange: {
  preset?: unknown
  startAt?: unknown
  endAt?: unknown
} | undefined): AiQuantConversationBacktestConfigDto['range'] {
  const preset = defaultsRange?.preset === '7D'
    || defaultsRange?.preset === '30D'
    || defaultsRange?.preset === '90D'
    || defaultsRange?.preset === '1Y'
    || defaultsRange?.preset === 'CUSTOM'
    ? defaultsRange.preset
    : 'CUSTOM'

  return {
    preset,
    ...(preset === 'CUSTOM' && typeof defaultsRange?.startAt === 'string' ? { startAt: defaultsRange.startAt } : {}),
    ...(preset === 'CUSTOM' && typeof defaultsRange?.endAt === 'string' ? { endAt: defaultsRange.endAt } : {}),
  }
}

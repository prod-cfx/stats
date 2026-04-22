import type { InferredConfirmationSemanticDefaults } from '../inferred-confirmation-classifier.service'
import { InferredConfirmationClassifierService } from '../inferred-confirmation-classifier.service'

describe('InferredConfirmationClassifierService', () => {
  const aiService = {
    chat: jest.fn(),
  }
  const service = new InferredConfirmationClassifierService(aiService as never)

  beforeEach(() => {
    aiService.chat.mockReset()
  })

  const buildSemanticDefaults = (overrides: Partial<InferredConfirmationSemanticDefaults> = {}): InferredConfirmationSemanticDefaults => ({
    inferredKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
    stopLossBasis: 'entry_avg_price',
    takeProfitBasis: 'entry_avg_price',
    ...overrides,
  })

  it.each([
    '这样可以',
    '可以了',
    '就这样',
    '没问题',
  ])('classifies natural confirmation reply %s as confirm', async (message) => {
    const result = await service.classifyInferredDecisionReply({
      message,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
    expect(result.overriddenKeys).toEqual([])
    expect(result.overriddenBasisByKey).toEqual({})
  })

  it.each([
    '这样可以吗',
    '默认没问题吗',
    '不对',
    '不行',
    '别按这个',
  ])('does not misclassify negative or tentative reply %s as confirm', async (message) => {
    const result = await service.classifyInferredDecisionReply({
      message,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('reject')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual([])
    expect(result.overriddenKeys).toEqual([])
  })

  it.each([
    ['止盈按持仓收益率', 'risk.takeProfitBasis', 'position_pnl'],
    ['止损按入场价', 'risk.stopLossBasis', 'entry_avg_price'],
  ])('classifies override reply %s as override', async (message, expectedKey, expectedBasis) => {
    const result = await service.classifyInferredDecisionReply({
      message,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('override')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual([])
    expect(result.overriddenKeys).toEqual([expectedKey])
    expect(result.overriddenBasisByKey).toEqual({
      [expectedKey]: expectedBasis,
    })
  })

  it.each([
    ['止盈不要按默认', 'risk.takeProfitBasis'],
    ['止损别按这个', 'risk.stopLossBasis'],
  ])('treats targeted default negation reply %s as override', async (message, expectedKey) => {
    const result = await service.classifyInferredDecisionReply({
      message,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('override')
    expect(result.source).toBe('rule')
    expect(result.overriddenKeys).toEqual([expectedKey])
    expect(result.confirmedKeys).toEqual([])
    expect(aiService.chat).not.toHaveBeenCalled()
  })

  it.each([
    '这个是对的',
    '对的继续',
    '就按这个来',
    '这些成立，继续',
  ])('keeps existing explicit confirmation reply %s as confirm', async (message) => {
    const result = await service.classifyInferredDecisionReply({
      message,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
    expect(result.overriddenKeys).toEqual([])
  })

  it('classifies 这样对的 as confirm', async () => {
    const result = await service.classifyInferredDecisionReply({
      message: '这样对的',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
  })

  it('keeps basis normalization for mixed override and confirmation replies', async () => {
    const result = await service.classifyInferredDecisionReply({
      message: '止盈按持仓收益率，止损没问题',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('override')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis'])
    expect(result.overriddenKeys).toEqual(['risk.takeProfitBasis'])
    expect(result.overriddenBasisByKey).toEqual({
      'risk.takeProfitBasis': 'position_pnl',
    })
  })

  it('keeps confirmation when default-negation override and confirmation appear together', async () => {
    const result = await service.classifyInferredDecisionReply({
      message: '止盈不要按默认，止损没问题',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('override')
    expect(result.source).toBe('rule')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis'])
    expect(result.overriddenKeys).toEqual(['risk.takeProfitBasis'])
  })

  it('uses llm fallback when rules do not match and llm returns confirm', async () => {
    aiService.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'confirm',
        targetKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      }),
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('llm')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
    expect(result.overriddenKeys).toEqual([])
    expect(aiService.chat).toHaveBeenCalledTimes(1)
    const fallbackUserMessage = aiService.chat.mock.calls[0]?.[0].messages.find((item: { role: string; content: string }) => item.role === 'user')?.content ?? ''
    expect(fallbackUserMessage).toContain('assistantPrompt: 逻辑已整理完毕，请确认逻辑图。')
    expect(fallbackUserMessage).toContain('userReply: 嗯')
    expect(fallbackUserMessage).toContain('pendingKeys: risk.stopLossBasis, risk.takeProfitBasis')
    expect(fallbackUserMessage).toContain('\"risk.stopLossBasis\":\"entry_avg_price\"')
    expect(fallbackUserMessage).toContain('\"risk.takeProfitBasis\":\"entry_avg_price\"')
    expect(fallbackUserMessage).not.toContain('riskRules')
  })

  it('passes only inferred stopLoss basis to pending defaults when inferredKeys excludes takeProfitBasis', async () => {
    aiService.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'confirm',
        targetKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      }),
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults({
        inferredKeys: ['risk.stopLossBasis'],
        takeProfitBasis: 'entry_avg_price',
      }),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('llm')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
    expect(result.overriddenKeys).toEqual([])
    expect(aiService.chat).toHaveBeenCalledTimes(1)
    const fallbackUserMessage = aiService.chat.mock.calls[0]?.[0].messages.find((item: { role: string; content: string }) => item.role === 'user')?.content ?? ''
    expect(fallbackUserMessage).toContain('assistantPrompt: 逻辑已整理完毕，请确认逻辑图。')
    expect(fallbackUserMessage).toContain('userReply: 嗯')
    expect(fallbackUserMessage).toContain('pendingKeys: risk.stopLossBasis, risk.takeProfitBasis')
    expect(fallbackUserMessage).toContain('\"risk.stopLossBasis\":\"entry_avg_price\"')
    expect(fallbackUserMessage).not.toContain('\"risk.takeProfitBasis\":\"entry_avg_price\"')
  })

  it('passes empty pending defaults when inferredKeys is empty', async () => {
    aiService.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'confirm',
        targetKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      }),
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults({ inferredKeys: [] }),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('llm')
    expect(result.confirmedKeys).toEqual(['risk.stopLossBasis', 'risk.takeProfitBasis'])
    expect(result.overriddenKeys).toEqual([])
    expect(aiService.chat).toHaveBeenCalledTimes(1)
    const fallbackUserMessage = aiService.chat.mock.calls[0]?.[0].messages.find((item: { role: string; content: string }) => item.role === 'user')?.content ?? ''
    expect(fallbackUserMessage).toContain('pendingKeyDefaults: {}')
    expect(fallbackUserMessage).not.toContain('\"entry_avg_price\"')
  })

  it('returns unclear when llm fallback output is invalid', async () => {
    aiService.chat.mockResolvedValue({
      content: 'not-json',
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('unclear')
    expect(result.source).toBe('llm')
    expect(result.confirmedKeys).toEqual([])
    expect(result.overriddenKeys).toEqual([])
    expect(aiService.chat).toHaveBeenCalledTimes(1)
  })

  it('returns unclear when llm fallback output is unclear', async () => {
    aiService.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'unclear',
        targetKeys: [],
      }),
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('unclear')
    expect(result.source).toBe('llm')
    expect(result.confirmedKeys).toEqual([])
    expect(result.overriddenKeys).toEqual([])
    expect(aiService.chat).toHaveBeenCalledTimes(1)
  })

  it('accepts canonical basis enums from llm override fallback', async () => {
    aiService.chat.mockResolvedValue({
      content: JSON.stringify({
        intent: 'override',
        targetKeys: ['risk.takeProfitBasis'],
        normalizedBasis: 'upper_band',
      }),
    })

    const result = await service.classifyInferredDecisionReply({
      message: '嗯',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('override')
    expect(result.source).toBe('llm')
    expect(result.overriddenKeys).toEqual(['risk.takeProfitBasis'])
    expect(result.overriddenBasisByKey).toEqual({
      'risk.takeProfitBasis': 'upper_band',
    })
  })

  it('does not call llm fallback when a rule already matches', async () => {
    const result = await service.classifyInferredDecisionReply({
      message: '这样可以',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('confirm')
    expect(result.source).toBe('rule')
    expect(aiService.chat).not.toHaveBeenCalled()
  })

  it('does not confirm a longer reply even when it contains a confirmation fragment', async () => {
    const result = await service.classifyInferredDecisionReply({
      message: '这样可以，后面我会把补充说明写完整，现在先按当前方案处理',
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      conversationPhase: 'CONFIRM_INFERRED',
      decisionKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
      semanticDefaults: buildSemanticDefaults(),
    })

    expect(result.intent).toBe('unclear')
    expect(result.source).toBe('rule')
    expect(aiService.chat).not.toHaveBeenCalled()
  })
})

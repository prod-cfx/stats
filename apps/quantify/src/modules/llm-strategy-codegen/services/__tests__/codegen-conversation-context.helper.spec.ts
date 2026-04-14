import { CodegenConversationContextHelper } from '../codegen-conversation-context.helper'

describe('CodegenConversationContextHelper', () => {
  const helper = new CodegenConversationContextHelper()

  it('merges guide prompt config and trims empty values', () => {
    expect(helper.mergeGuidePromptConfig(
      {
        symbolExample: ' BTCUSDT ',
        timeframeExample: '1h',
      },
      {
        symbolExample: '  ',
        entryRuleExample: ' RSI < 30 ',
      },
    )).toEqual({
      timeframeExample: '1h',
      entryRuleExample: 'RSI < 30',
    })
  })

  it('appends conversation history and keeps only the latest planner window', () => {
    const seed = Array.from({ length: 12 }, (_, index) => `U: old-${index + 1}`)

    expect(helper.appendConversationHistory(seed, ' new user ', ' new assistant ')).toEqual([
      'U: old-3',
      'U: old-4',
      'U: old-5',
      'U: old-6',
      'U: old-7',
      'U: old-8',
      'U: old-9',
      'U: old-10',
      'U: old-11',
      'U: old-12',
      'U: new user',
      'A: new assistant',
    ])
  })

  it('normalizes constraint pack and filters dirty conversation history', () => {
    expect(helper.readConstraintPack({
      recommendationStyle: 'ma',
      guidePrompt: {
        symbolExample: ' BTCUSDT ',
        timeframeExample: '',
      },
      conversationHistory: [' U: hi ', '', 1, null, 'A: ok'],
    })).toMatchObject({
      recommendationStyle: 'ma',
      guidePrompt: { symbolExample: 'BTCUSDT' },
      conversationHistory: ['U: hi', 'A: ok'],
    })
  })

  it('derives recommendation style from checklist before message fallback', () => {
    expect(helper.inferRecommendationStyleFromContext(
      '这是一个上涨回撤策略',
      {
        entryRules: ['5/20 均线金叉做多'],
        exitRules: ['5/20 均线死叉离场'],
      },
      'drop-rise',
    )).toBe('ma')
  })

  it('converts conversation history back to structured messages and title', () => {
    const messages = helper.toConversationMessages(['U:  帮我做一个均线策略 ', 'A: 好的', 'noop'])

    expect(messages).toEqual([
      { role: 'user', content: '帮我做一个均线策略' },
      { role: 'assistant', content: '好的' },
    ])
    expect(helper.deriveConversationTitle(messages)).toBe('帮我做一个均线策略')
  })
})

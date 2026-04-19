import { describe, expect, it } from '@jest/globals'
import * as sessionLoop from './session-loop'

const {
  buildAutoAdvanceMessage,
  isAssistantDraftLikeMessage,
  isShortConfirmationMessage,
  shouldAutoAdvanceOnConfirmation,
} = sessionLoop

describe('ai-quant session-loop', () => {
  it('does not export resolveChecklistPayload after semantic-only preflight migration', () => {
    expect('resolveChecklistPayload' in sessionLoop).toBe(false)
  })

  it('recognizes short confirmation messages', () => {
    expect(isShortConfirmationMessage('这样可以')).toBe(true)
    expect(isShortConfirmationMessage('可以了')).toBe(true)
    expect(isShortConfirmationMessage('就这样')).toBe(true)
    expect(isShortConfirmationMessage('继续')).toBe(true)
    expect(isShortConfirmationMessage('继续 ')).toBe(true)
    expect(isShortConfirmationMessage('确认正确')).toBe(true)
    expect(isShortConfirmationMessage('确认！')).toBe(true)
    expect(isShortConfirmationMessage('正确')).toBe(true)
    expect(isShortConfirmationMessage('可以。')).toBe(true)
    expect(isShortConfirmationMessage('按你说的来')).toBe(true)
    expect(isShortConfirmationMessage('这样可以吗')).toBe(false)
    expect(isShortConfirmationMessage('默认没问题吗')).toBe(false)
    expect(isShortConfirmationMessage('我想加一个止损')).toBe(false)
  })

  it('recognizes assistant draft-like messages', () => {
    expect(isAssistantDraftLikeMessage('策略逻辑如下：入场条件...出场条件...')).toBe(true)
    expect(isAssistantDraftLikeMessage('请确认逻辑图，确认后我再生成策略代码。')).toBe(true)
    expect(isAssistantDraftLikeMessage('你好')).toBe(false)
  })

  it('auto-advances on short confirmation with draft context', () => {
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '可以',
      lastAssistantMessage: '策略逻辑如下：入场条件...',
      hasLogicGraph: false,
    })).toBe(true)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '可以',
      lastAssistantMessage: null,
      hasLogicGraph: true,
    })).toBe(true)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '继续',
      lastAssistantMessage: '你好',
      hasLogicGraph: false,
    })).toBe(false)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '确认正确',
      lastAssistantMessage: '请确认这版逻辑是否正确，我就可以据此生成主线流程图。',
      hasLogicGraph: false,
    })).toBe(true)
  })

  it('builds auto-advance message with assistant draft', () => {
    const prompt = buildAutoAdvanceMessage('策略逻辑如下：入场...')
    expect(prompt).toContain('不要继续追问')
    expect(prompt).toContain('上一条草案')
  })
})

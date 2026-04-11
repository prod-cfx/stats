import { describe, expect, it } from '@jest/globals'
import enCommon from '../../public/locales/en/common.json'
import zhCommon from '../../public/locales/zh/common.json'

describe('AI Quant clarification translations', () => {
  it('ships dedicated clarification copy for Chinese and English locales', () => {
    expect(zhCommon.aiQuant.clarificationGateInputPlaceholder).toBe('请输入你的澄清说明')
    expect(zhCommon.aiQuant.clarificationGateSubmit).toBe('提交澄清')
    expect(enCommon.aiQuant.clarificationGateInputPlaceholder).toBe('Enter your clarification')
    expect(enCommon.aiQuant.clarificationGateSubmit).toBe('Submit clarification')
    expect(zhCommon.aiQuant.messages.backtestCapabilityLoadFailed).toBe('回测能力加载失败，请稍后重试。')
    expect(enCommon.aiQuant.messages.backtestCapabilityLoadFailed).toBe(
      'Failed to load backtest capabilities. Please try again later.',
    )
  })
})

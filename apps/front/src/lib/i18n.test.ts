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
    expect(zhCommon.aiQuant.messages.backtestConfigChanged).toBe(
      '这是历史回测结果，当前参数已变化，不能直接用于部署，需要重新回测。',
    )
    expect(enCommon.aiQuant.messages.backtestConfigChanged).toBe(
      'This is a historical backtest result. Current parameters have changed, so it cannot be deployed directly. Please run a new backtest.',
    )
    expect(zhCommon.aiQuant.messages.backtestDrawdownLimitBypassed).toBe(
      '当前为模拟部署模式：忽略回撤门槛',
    )
    expect(enCommon.aiQuant.messages.backtestDrawdownLimitBypassed).toBe(
      'Simulation deployment mode: drawdown threshold ignored',
    )
  })
})

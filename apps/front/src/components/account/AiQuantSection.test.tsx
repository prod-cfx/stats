import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import { AiQuantSection } from './AiQuantSection'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    React.createElement('a', { href, className }, children)
  ),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'aiQuant.title': 'AI量化',
      'aiQuant.subtitle': '对话创建策略、回测评估，达标后再一键部署。',
      'aiQuant.consoleTitle': 'AI 量化控制台',
      'aiQuant.consoleSubtitle': '管理运行中的自动化策略、交易所连接和执行状态。',
      'aiQuant.consoleApiReady': '交易所 API 已配置后即可部署运行策略。',
      'aiQuant.plaza': '策略广场',
      'aiQuant.createStrategy': '创建新策略',
    })[key] ?? key,
  }),
}))

jest.mock('./AiQuantStrategyList', () => ({
  AiQuantStrategyList: () => React.createElement('div', { 'data-testid': 'strategy-list' }),
}))

describe('AiQuantSection', () => {
  it('links the secondary action to strategy plaza', () => {
    const html = renderToStaticMarkup(React.createElement(AiQuantSection, { lng: 'zh' }))

    expect(html).toContain('href="/zh/ai-quant/plaza"')
    expect(html).toContain('策略广场')
    expect(html).not.toContain('配置交易所 API')
    expect(html).not.toContain('exchange-api')
  })

  it('presents the account tab as an AI quant console', () => {
    const html = renderToStaticMarkup(React.createElement(AiQuantSection, { lng: 'zh' }))

    expect(html).toContain('AI 量化控制台')
    expect(html).toContain('管理运行中的自动化策略、交易所连接和执行状态。')
    expect(html).toContain('交易所 API 已配置后即可部署运行策略。')
  })
})

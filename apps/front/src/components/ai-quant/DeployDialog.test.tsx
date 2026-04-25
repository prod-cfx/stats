/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DeployDialog } from './DeployDialog'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe('DeployDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders leverage options, explanation, and drift warning from truthful deployment config', async () => {
    const onSelectLeverage = jest.fn()

    await act(async () => {
      root.render(
        <DeployDialog
          open
          canDeploy
          deploySubmitting={false}
          apiConfigured
          exchange="okx"
          marketType="perp"
          accounts={[{
            accountId: 'acct-1',
            exchange: 'okx',
            accountName: 'OKX Main',
            apiKeyMask: 'OKX***1',
            status: 'available',
          }]}
          selectedAccountId="acct-1"
          lng="zh"
          onSelectAccount={() => {}}
          onConfirmDeploy={() => {}}
          leverageOptions={[1, 2, 3, 4, 5]}
          selectedLeverage={4}
          onSelectLeverage={onSelectLeverage}
          leverageExplanation="交易所支持 10x，但平台风控和策略限制最终只允许 1-5x。"
          deploymentBaseline={{
            leverage: 2,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          }}
          driftReasons={['leverage drift']}
        />,
      )
    })

    expect(container.textContent).toContain('允许杠杆范围')
    expect(container.textContent).toContain('1x - 5x')
    expect(container.textContent).toContain('策略部署默认')
    expect(container.textContent).toContain('2x')
    expect(container.textContent).toContain('leverage drift')
    expect(container.textContent).toContain('交易所支持 10x')

    const leverageSelect = container.querySelector('select[name="deployment-leverage"]') as HTMLSelectElement | null
    if (leverageSelect) {
      leverageSelect.value = '5'
      leverageSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    expect(onSelectLeverage).toHaveBeenCalledWith(5)
  })

  it('disables confirm when snapshot market type truth is missing', async () => {
    await act(async () => {
      root.render(
        <DeployDialog
          open
          canDeploy
          deploySubmitting={false}
          apiConfigured
          exchange="okx"
          marketType={null}
          accounts={[{
            accountId: 'acct-1',
            exchange: 'okx',
            accountName: 'OKX Main',
            apiKeyMask: 'OKX***1',
            status: 'available',
          }]}
          selectedAccountId="acct-1"
          lng="zh"
          onSelectAccount={() => {}}
          onConfirmDeploy={() => {}}
        />,
      )
    })

    const confirmButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('aiQuant.deployDialog.confirmDeploy'))
    expect(confirmButton).toBeTruthy()
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not render leverage controls for spot deployments', async () => {
    await act(async () => {
      root.render(
        <DeployDialog
          open
          canDeploy
          deploySubmitting={false}
          apiConfigured
          exchange="okx"
          marketType="spot"
          accounts={[{
            accountId: 'acct-1',
            exchange: 'okx',
            accountName: 'OKX Main',
            apiKeyMask: 'OKX***1',
            status: 'available',
          }]}
          selectedAccountId="acct-1"
          lng="zh"
          onSelectAccount={() => {}}
          onConfirmDeploy={() => {}}
        />,
      )
    })

    expect(container.textContent).not.toContain('部署杠杆')
    expect(container.querySelector('select[name="deployment-leverage"]')).toBeNull()
  })

  it('uses redeploy wording in redeploy mode', async () => {
    await act(async () => {
      root.render(
        <DeployDialog
          open
          canDeploy
          deploySubmitting={false}
          apiConfigured
          exchange="okx"
          marketType="spot"
          accounts={[{
            accountId: 'acct-1',
            exchange: 'okx',
            accountName: 'OKX Main',
            apiKeyMask: 'OKX***1',
            status: 'available',
          }]}
          selectedAccountId="acct-1"
          mode="redeploy"
          lng="zh"
          onSelectAccount={() => {}}
          onConfirmDeploy={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('重新部署策略？')
    expect(container.textContent).toContain('系统将按当前已发布版本重新部署策略，并开始运行。')
    expect(container.textContent).toContain('确认重新部署')
  })
})

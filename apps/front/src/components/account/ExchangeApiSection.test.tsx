/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { accountExchangeNavigation, ExchangeApiSection, getOkxSaveRedirect } from './ExchangeApiSection'

const mockFetchUserExchangeAccountStatuses = jest.fn()
const mockUpsertUserExchangeAccount = jest.fn()
const mockDeleteUserExchangeAccount = jest.fn()

jest.mock('@/lib/api', () => ({
  deleteUserExchangeAccount: (...args: unknown[]) => mockDeleteUserExchangeAccount(...args),
  fetchUserExchangeAccountStatuses: (...args: unknown[]) => mockFetchUserExchangeAccountStatuses(...args),
  upsertUserExchangeAccount: (...args: unknown[]) => mockUpsertUserExchangeAccount(...args),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'aiQuant.accountName': 'Account Name',
        'aiQuant.apiConfigDesc': 'Configure exchange credentials for AI Quant.',
        'aiQuant.apiConfigTitle': 'Exchange API Configuration',
        'aiQuant.apiKey': 'API Key',
        'aiQuant.binanceApi': 'Binance API',
        'aiQuant.boundAccountName': 'Bound account name:',
        'aiQuant.boundAccounts': 'Bound Trading Accounts',
        'aiQuant.cancelEdit': 'Cancel',
        'aiQuant.configured': 'Configured',
        'aiQuant.currentKey': 'Current key: ',
        'aiQuant.deleteFailed': 'Failed to delete configuration.',
        'aiQuant.deleting': 'Deleting…',
        'aiQuant.editApiConfig': 'Edit Config',
        'aiQuant.hyperliquidApi': 'Hyperliquid API',
        'aiQuant.lastValidatedAt': 'Last validated at',
        'aiQuant.loadFailed': 'Failed to load binding statuses.',
        'aiQuant.loading': 'Loading…',
        'aiQuant.notConfigured': 'Not configured',
        'aiQuant.okxApi': 'OKX API',
        'aiQuant.passphrase': 'Passphrase',
        'aiQuant.saveApiConfig': 'Save API Config',
        'aiQuant.saveFailed': 'Failed to save configuration.',
        'aiQuant.saving': 'Saving…',
        'aiQuant.secretKey': 'Secret Key',
        'aiQuant.unbindApiConfig': 'Unbind',
        'aiQuant.updateApiConfig': 'Update API Config',
        'aiQuant.useTestnet': 'Use testnet / paper trading',
        'aiQuant.validation.requiredBinanceCredentials': 'Binance API key and secret are required.',
        'aiQuant.validation.requiredHyperliquidCredentials': 'Hyperliquid wallet address and agent private key are required.',
        'aiQuant.validation.requiredOkxDemoCredentials': 'Please save an OKX demo trading API key before returning to Strategy Plaza.',
        'aiQuant.validation.requiredOkxCredentials': 'OKX API key, secret, and passphrase are required.',
        'aiQuant.walletAddress': 'Wallet Address',
        'aiQuant.agentPrivateKey': 'Agent Private Key',
      }
      return translations[key] ?? options?.defaultValue ?? key
    },
  }),
}))

type ExchangeId = 'binance' | 'okx' | 'hyperliquid'

function buildEmptyStatus(exchangeId: ExchangeId) {
  return {
    id: null,
    exchangeId,
    isBound: false,
    name: null,
    maskedCredential: null,
    isTestnet: null,
    lastValidatedAt: null,
    createdAt: null,
  }
}

function buildBoundOkxStatus() {
  return {
    id: 'okx-account-1',
    exchangeId: 'okx' as const,
    isBound: true,
    name: 'Existing OKX',
    maskedCredential: 'okx****key',
    isTestnet: true,
    lastValidatedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-11T00:00:00.000Z',
  }
}

describe('ExchangeApiSection', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  async function renderSection() {
    await act(async () => {
      root?.render(<ExchangeApiSection />)
    })
    await flushPromises()
  }

  function findExchangeCard(title: string): HTMLElement {
    const article = Array.from(container.querySelectorAll('article')).find(node => node.textContent?.includes(title))
    if (!article) {
      throw new TypeError(`Unable to find exchange card: ${title}`)
    }
    return article as HTMLElement
  }

  function clickButton(scope: ParentNode, text: string) {
    const button = Array.from(scope.querySelectorAll('button')).find(node => node.textContent?.includes(text))
    if (!(button instanceof HTMLButtonElement)) {
      throw new TypeError(`Unable to find button: ${text}`)
    }
    button.click()
  }

  function findInput(scope: ParentNode, placeholder: string): HTMLInputElement {
    const input = Array.from(scope.querySelectorAll('input')).find(node => node.getAttribute('placeholder') === placeholder)
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError(`Unable to find input: ${placeholder}`)
    }
    return input
  }

  async function setInputValue(input: HTMLInputElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  async function setCheckbox(input: HTMLInputElement, checked: boolean) {
    await act(async () => {
      if (input.checked !== checked) {
        input.click()
      }
    })
  }

  async function fillOkxCredentials() {
    const okxCard = findExchangeCard('OKX API')
    await setInputValue(findInput(okxCard, 'API Key'), 'demo-key')
    await setInputValue(findInput(okxCard, 'Secret Key'), 'demo-secret')
    await setInputValue(findInput(okxCard, 'Passphrase'), 'demo-passphrase')
    return okxCard
  }

  async function flushPromises() {
    await act(async () => {
      await Promise.resolve()
    })
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockFetchUserExchangeAccountStatuses.mockReset()
    mockUpsertUserExchangeAccount.mockReset()
    mockDeleteUserExchangeAccount.mockReset()

    const emptyStatuses = [
      buildEmptyStatus('binance'),
      buildEmptyStatus('okx'),
      buildEmptyStatus('hyperliquid'),
    ]

    mockFetchUserExchangeAccountStatuses.mockResolvedValue(emptyStatuses)
    mockUpsertUserExchangeAccount.mockResolvedValue(buildBoundOkxStatus())
    mockDeleteUserExchangeAccount.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/zh/account')
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('blocks a first-time OKX bind when required credentials are blank', async () => {
    await renderSection()

    const okxCard = findExchangeCard('OKX API')

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })

    expect(mockUpsertUserExchangeAccount).not.toHaveBeenCalled()
    expect(okxCard.textContent).toContain('OKX API key, secret, and passphrase are required.')
  })

  it('trims OKX credential fields before saving a new binding', async () => {
    await renderSection()

    const okxCard = findExchangeCard('OKX API')
    await setInputValue(findInput(okxCard, 'Account Name'), '  OKX Demo  ')
    await setCheckbox(Array.from(okxCard.querySelectorAll('input')).find(node => node.type === 'checkbox') as HTMLInputElement, true)
    await setInputValue(findInput(okxCard, 'API Key'), '  demo-key  ')
    await setInputValue(findInput(okxCard, 'Secret Key'), '  demo-secret  ')
    await setInputValue(findInput(okxCard, 'Passphrase'), '  demo-passphrase  ')

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })
    await flushPromises()

    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledWith({
      exchangeId: 'okx',
      name: 'OKX Demo',
      isTestnet: true,
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
      passphrase: 'demo-passphrase',
      marketType: 'spot',
    })
  })

  it('allows editing a bound OKX account without re-entering stored credentials', async () => {
    mockFetchUserExchangeAccountStatuses.mockResolvedValue([
      buildEmptyStatus('binance'),
      buildBoundOkxStatus(),
      buildEmptyStatus('hyperliquid'),
    ])

    await renderSection()

    const okxCard = findExchangeCard('OKX API')

    await act(async () => {
      clickButton(okxCard, 'Edit Config')
    })

    await setInputValue(findInput(okxCard, 'Account Name'), '  Updated OKX  ')

    await act(async () => {
      clickButton(okxCard, 'Update API Config')
    })
    await flushPromises()

    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledTimes(1)
    const payload = mockUpsertUserExchangeAccount.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      exchangeId: 'okx',
      name: 'Updated OKX',
      isTestnet: true,
      marketType: 'spot',
    })
    expect(payload.apiKey).toBeUndefined()
    expect(payload.apiSecret).toBeUndefined()
    expect(payload.passphrase).toBeUndefined()
  })

  it('redirects back to plaza after OKX is saved with a redirect query', async () => {
    window.history.replaceState({}, '', '/zh/account?tab=ai-quant&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
    const redirectSpy = jest.spyOn(accountExchangeNavigation, 'redirectTo').mockImplementation(() => undefined)
    await renderSection()

    const okxCard = await fillOkxCredentials()

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })
    await flushPromises()

    expect(getOkxSaveRedirect()).toBe('/zh/ai-quant/plaza')
    expect(redirectSpy).toHaveBeenCalledWith('/zh/ai-quant/plaza')
    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledTimes(1)
    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(1)
  })

  it('defaults OKX recovery binding to testnet demo mode', async () => {
    window.history.replaceState({}, '', '/zh/account?tab=ai-quant&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
    await renderSection()

    const okxCard = findExchangeCard('OKX API')
    const checkbox = Array.from(okxCard.querySelectorAll('input')).find(node => node.type === 'checkbox') as HTMLInputElement

    expect(checkbox.checked).toBe(true)
  })

  it('does not return to plaza when OKX recovery binding is saved as non-demo', async () => {
    window.history.replaceState({}, '', '/zh/account?tab=ai-quant&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
    const redirectSpy = jest.spyOn(accountExchangeNavigation, 'redirectTo').mockImplementation(() => undefined)
    await renderSection()

    const okxCard = await fillOkxCredentials()
    await setCheckbox(Array.from(okxCard.querySelectorAll('input')).find(node => node.type === 'checkbox') as HTMLInputElement, false)

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })
    await flushPromises()

    expect(mockUpsertUserExchangeAccount).not.toHaveBeenCalled()
    expect(redirectSpy).not.toHaveBeenCalled()
    expect(okxCard.textContent).toContain('Please save an OKX demo trading API key before returning to Strategy Plaza.')
  })

  it('does not redirect when OKX save fails', async () => {
    window.history.replaceState({}, '', '/zh/account?tab=ai-quant&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
    const redirectSpy = jest.spyOn(accountExchangeNavigation, 'redirectTo').mockImplementation(() => undefined)
    mockUpsertUserExchangeAccount.mockRejectedValue(new Error('save failed'))
    await renderSection()

    const okxCard = await fillOkxCredentials()

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })
    await flushPromises()

    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledTimes(1)
    expect(redirectSpy).not.toHaveBeenCalled()
    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(1)
    expect(okxCard.textContent).toContain('save failed')
  })

  it('keeps non-OKX saves on the account page even with a redirect query', async () => {
    window.history.replaceState({}, '', '/zh/account?tab=ai-quant&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
    const redirectSpy = jest.spyOn(accountExchangeNavigation, 'redirectTo').mockImplementation(() => undefined)
    await renderSection()

    const binanceCard = findExchangeCard('Binance API')
    await setInputValue(findInput(binanceCard, 'API Key'), 'binance-key')
    await setInputValue(findInput(binanceCard, 'Secret Key'), 'binance-secret')

    await act(async () => {
      clickButton(binanceCard, 'Save API Config')
    })
    await flushPromises()

    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledTimes(1)
    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledWith(expect.objectContaining({ exchangeId: 'binance' }))
    expect(redirectSpy).not.toHaveBeenCalled()
    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['external URL', 'https://evil.example/zh/ai-quant/plaza'],
    ['protocol-relative URL', '//evil.example/zh/ai-quant/plaza'],
    ['javascript URL', 'javascript:alert(1)'],
  ])('ignores %s OKX save redirect', async (_label, redirect) => {
    window.history.replaceState({}, '', `/zh/account?tab=ai-quant&redirect=${encodeURIComponent(redirect)}#exchange-api`)
    const redirectSpy = jest.spyOn(accountExchangeNavigation, 'redirectTo').mockImplementation(() => undefined)
    await renderSection()

    const okxCard = await fillOkxCredentials()

    await act(async () => {
      clickButton(okxCard, 'Save API Config')
    })
    await flushPromises()

    expect(getOkxSaveRedirect()).toBeNull()
    expect(mockUpsertUserExchangeAccount).toHaveBeenCalledTimes(1)
    expect(redirectSpy).not.toHaveBeenCalled()
    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(2)
  })
})

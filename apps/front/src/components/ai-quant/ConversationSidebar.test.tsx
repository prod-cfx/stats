/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ConversationSidebar } from './ConversationSidebar'

jest.mock('lucide-react', () => ({
  CheckCircle2: () => <span data-testid="current-icon" />,
  ChevronDown: () => <span data-testid="chevron-down-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  X: () => <span data-testid="x-icon" />,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number }) => {
      const translations: Record<string, string> = {
        'aiQuant.createChat': '+ 新建会话',
        'aiQuant.updatedAt': '更新于',
        'aiQuant.current': '当前',
        'aiQuant.conversationSelector': '选择会话',
        'aiQuant.mobileCurrentSessionSummary': '当前会话 · {{count}} 个历史会话收起',
      }
      const value = translations[key] ?? options?.defaultValue ?? key
      return value.replace('{{count}}', String(options?.count ?? 0))
    },
  }),
}))

describe('ConversationSidebar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('shows a compact current icon and brighter selected background for the active conversation', async () => {
    await act(async () => {
      root.render(
        <ConversationSidebar
          items={[
            { id: 'active', title: '基于 OKX 模拟盘 BTC-U', updatedAt: 1_714_471_520_000 },
            { id: 'other', title: '另一个会话', updatedAt: 1_714_471_500_000 },
          ]}
          activeId="active"
          onCreate={() => undefined}
          onDelete={() => undefined}
          onRename={() => undefined}
          onSwitch={() => undefined}
        />,
      )
    })

    const activeItem = container.querySelector('[data-active-conversation="true"]')
    expect(activeItem).not.toBeNull()
    expect(activeItem?.querySelector('[data-testid="current-icon"]')).not.toBeNull()
    expect(activeItem?.textContent).not.toContain('当前')
    expect(activeItem?.className).toContain('bg-[#f3e8ff]')
  })

  it('keeps the conversation list compact and scrollable on narrow screens', async () => {
    await act(async () => {
      root.render(
        <ConversationSidebar
          items={[
            { id: 'active', title: '基于 OKX 模拟盘 BTC-U', updatedAt: 1_714_471_520_000 },
            { id: 'other-1', title: '另一个会话', updatedAt: 1_714_471_500_000 },
            { id: 'other-2', title: '第三个会话', updatedAt: 1_714_471_400_000 },
          ]}
          activeId="active"
          onCreate={() => undefined}
          onDelete={() => undefined}
          onRename={() => undefined}
          onSwitch={() => undefined}
        />,
      )
    })

    const sidebar = container.querySelector('aside')
    const list = sidebar?.querySelector('[data-testid="conversation-sidebar-list"]')

    expect(sidebar?.className).toContain('max-h-[42dvh]')
    expect(sidebar?.className).toContain('md:max-h-none')
    expect(list?.className).toContain('overflow-y-auto')
  })

  it('shows a compact current-session trigger for mobile', async () => {
    await act(async () => {
      root.render(
        <ConversationSidebar
          items={[
            { id: 'active', title: 'OKX BTC-USDT-SWAP · MA 6/48', updatedAt: 1_714_471_520_000 },
            { id: 'other', title: 'OKX ETH-USDT-SWAP · RSI 14', updatedAt: 1_714_471_500_000 },
          ]}
          activeId="active"
          onCreate={() => undefined}
          onDelete={() => undefined}
          onRename={() => undefined}
          onSwitch={() => undefined}
        />,
      )
    })

    const trigger = container.querySelector('[data-testid="mobile-conversation-trigger"]')

    expect(trigger).not.toBeNull()
    expect(trigger?.className).toContain('md:hidden')
    expect(trigger?.textContent).toContain('OKX BTC-USDT-SWAP · MA 6/48')
    expect(trigger?.textContent).toContain('当前会话 · 1 个历史会话收起')
    expect(trigger?.querySelector('[data-testid="chevron-down-icon"]')).not.toBeNull()
  })

  it('opens the mobile bottom sheet and closes after create or switch', async () => {
    const onCreate = jest.fn()
    const onSwitch = jest.fn()

    await act(async () => {
      root.render(
        <ConversationSidebar
          items={[
            { id: 'active', title: 'OKX BTC-USDT-SWAP · MA 6/48', updatedAt: 1_714_471_520_000 },
            { id: 'other', title: 'OKX ETH-USDT-SWAP · RSI 14', updatedAt: 1_714_471_500_000 },
          ]}
          activeId="active"
          onCreate={onCreate}
          onDelete={() => undefined}
          onRename={() => undefined}
          onSwitch={onSwitch}
        />,
      )
    })

    await act(async () => {
      container.querySelector('[data-testid="mobile-conversation-trigger"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    const sheet = container.querySelector<HTMLElement>('[data-testid="mobile-conversation-sheet"]')
    expect(sheet).not.toBeNull()
    expect(sheet?.textContent).toContain('选择会话')

    await act(async () => {
      sheet!.querySelector('[data-testid="mobile-create-conversation"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid="mobile-conversation-sheet"]')).toBeNull()

    await act(async () => {
      container.querySelector('[data-testid="mobile-conversation-trigger"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    const reopenedSheet = container.querySelector<HTMLElement>('[data-testid="mobile-conversation-sheet"]')
    expect(reopenedSheet).not.toBeNull()

    await act(async () => {
      reopenedSheet!.querySelector('[data-testid="conversation-item-other"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onSwitch).toHaveBeenCalledWith('other')
    expect(container.querySelector('[data-testid="mobile-conversation-sheet"]')).toBeNull()
  })

  it('renames and deletes from the sheet without switching conversations', async () => {
    const onDelete = jest.fn()
    const onRename = jest.fn()
    const onSwitch = jest.fn()

    await act(async () => {
      root.render(
        <ConversationSidebar
          items={[
            { id: 'active', title: 'OKX BTC-USDT-SWAP · MA 6/48', updatedAt: 1_714_471_520_000 },
            { id: 'other', title: 'OKX ETH-USDT-SWAP · RSI 14', updatedAt: 1_714_471_500_000 },
          ]}
          activeId="active"
          onCreate={() => undefined}
          onDelete={onDelete}
          onRename={onRename}
          onSwitch={onSwitch}
        />,
      )
    })

    await act(async () => {
      container.querySelector('[data-testid="mobile-conversation-trigger"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    const sheet = container.querySelector<HTMLElement>('[data-testid="mobile-conversation-sheet"]')
    expect(sheet).not.toBeNull()

    await act(async () => {
      sheet!.querySelector('[data-testid="rename-conversation-other"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    const input = sheet!.querySelector<HTMLInputElement>('[data-testid="conversation-title-input-other"]')
    expect(input).not.toBeNull()

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(input!, 'Renamed ETH session')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(onRename).toHaveBeenCalledWith('other', 'Renamed ETH session')
    expect(onSwitch).not.toHaveBeenCalled()

    await act(async () => {
      sheet!.querySelector('[data-testid="delete-conversation-other"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onDelete).toHaveBeenCalledWith('other')
    expect(onSwitch).not.toHaveBeenCalled()
  })
})

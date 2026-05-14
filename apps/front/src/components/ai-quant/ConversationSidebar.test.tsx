/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ConversationSidebar } from './ConversationSidebar'

jest.mock('lucide-react', () => ({
  CheckCircle2: () => <span data-testid="current-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'aiQuant.createChat': '+ 新建会话',
        'aiQuant.updatedAt': '更新于',
        'aiQuant.current': '当前',
      }
      return translations[key] ?? options?.defaultValue ?? key
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
})

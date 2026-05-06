/** @jest-environment jsdom */

import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantDeletionDialog } from './AiQuantDeletionDialog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

interface RenderProps {
  open?: boolean
  kind?: 'loading' | 'unknown' | 'running' | 'with-conversation' | 'no-conversation'
  pending?: boolean
  errorMessage?: string | null
  conversation?: { title: string } | null
  strategy?: { name?: string | null; id: string }
  deleteStoppedStrategy?: boolean
  onToggleDeleteStoppedStrategy?: (next: boolean) => void
  onConfirm?: () => void
  onKeepAsViewOnly?: () => void
  onGoToRunningStrategy?: () => void
  onClose?: () => void
}

async function render(props: RenderProps) {
  await act(async () => {
    root.render(
      React.createElement(AiQuantDeletionDialog, {
        open: props.open ?? true,
        kind: props.kind ?? 'with-conversation',
        pending: props.pending ?? false,
        errorMessage: props.errorMessage ?? null,
        conversation: props.conversation ?? { title: 'Conv-1' },
        strategy: props.strategy ?? { name: 'Stg-1', id: 'stg-1' },
        deleteStoppedStrategy: props.deleteStoppedStrategy ?? false,
        onToggleDeleteStoppedStrategy: props.onToggleDeleteStoppedStrategy ?? jest.fn(),
        onConfirm: props.onConfirm ?? jest.fn(),
        onKeepAsViewOnly: props.onKeepAsViewOnly,
        onGoToRunningStrategy: props.onGoToRunningStrategy,
        onClose: props.onClose ?? jest.fn(),
      }),
    )
  })
}

describe('AiQuantDeletionDialog', () => {
  it('running kind shows go-to-running-strategy and no checkbox', async () => {
    await render({ kind: 'running', onGoToRunningStrategy: jest.fn() })

    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('前往运行策略')
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('with-conversation unchecked shows "仅删除会话"', async () => {
    await render({ kind: 'with-conversation', deleteStoppedStrategy: false })
    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('仅删除会话')
  })

  it('with-conversation checked shows "删除会话和策略"', async () => {
    await render({ kind: 'with-conversation', deleteStoppedStrategy: true })
    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('删除会话和策略')
  })

  it('no-conversation shows "删除策略记录" / "保留为只读" and no "取消" text', async () => {
    await render({
      kind: 'no-conversation',
      conversation: null,
      onKeepAsViewOnly: jest.fn(),
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.textContent).not.toContain('取消')
    expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')?.textContent).toContain('删除策略记录')
    expect(container.querySelector('[data-testid="ai-quant-deletion-secondary"]')?.textContent).toContain('保留为只读')
  })

  it('renders errorMessage', async () => {
    await render({ errorMessage: '后端真实错误信息' })
    expect(container.textContent).toContain('后端真实错误信息')
  })

  it('disables buttons while pending', async () => {
    await render({ kind: 'with-conversation', pending: true })
    const primary = container.querySelector<HTMLButtonElement>('[data-testid="ai-quant-deletion-primary"]')
    const secondary = container.querySelector<HTMLButtonElement>('[data-testid="ai-quant-deletion-secondary"]')
    expect(primary?.disabled).toBe(true)
    expect(secondary?.disabled).toBe(true)
  })

  it('calls onClose on Escape when not pending', async () => {
    const onClose = jest.fn()
    await render({ onClose })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on Escape when pending', async () => {
    const onClose = jest.fn()
    await render({ onClose, pending: true })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on backdrop click when not pending', async () => {
    const onClose = jest.fn()
    await render({ onClose })

    const backdrop = container.firstChild as HTMLElement
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(onClose).toHaveBeenCalled()
  })
})

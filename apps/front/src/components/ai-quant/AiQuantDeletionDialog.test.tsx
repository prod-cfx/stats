/** @jest-environment jsdom */

import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantDeletionDialog } from './AiQuantDeletionDialog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockTranslations: Record<string, string> = {
  'aiQuant.deleteDialog.cancel': '取消',
  'aiQuant.deleteDialog.close': '关闭',
  'aiQuant.deleteDialog.conversation': '会话',
  'aiQuant.deleteDialog.deleteConversationAndStrategy': '删除会话和策略',
  'aiQuant.deleteDialog.deleteConversationOnly': '仅删除会话',
  'aiQuant.deleteDialog.deleteStoppedStrategy': '同时删除已停止策略记录',
  'aiQuant.deleteDialog.deleteStoppedStrategyHint': '删除后该策略将从我的策略列表移除，不能再次运行。',
  'aiQuant.deleteDialog.deleteStrategyPermanently': '彻底删除策略',
  'aiQuant.deleteDialog.deleteStrategyRecord': '彻底删除策略记录（不可恢复）',
  'aiQuant.deleteDialog.deleteStrategyRecordHint': '勾选后该策略将从我的策略列表移除，不能再次运行。',
  'aiQuant.deleteDialog.destructiveWarning': '此操作不可恢复。继续之前请确认你已不再需要该策略记录。',
  'aiQuant.deleteDialog.goToRunningStrategy': '前往运行策略',
  'aiQuant.deleteDialog.keepViewOnly': '保留为只读',
  'aiQuant.deleteDialog.loadingDescription': '正在确认关联策略的运行状态。',
  'aiQuant.deleteDialog.loadingTitle': '正在确认策略状态',
  'aiQuant.deleteDialog.noConversationDescription': '该策略由「策略广场」直接运行生成，没有关联 AI Quant 会话。默认保留在我的策略列表中（仅可查看详情）；如不再需要可勾选下方选项彻底删除。',
  'aiQuant.deleteDialog.noConversationTitle': '删除策略',
  'aiQuant.deleteDialog.runningDescription': '当前会话关联的策略正在运行，不能删除。请先前往策略详情停止运行；如有持仓或挂单，可选择仅停止或平仓并停止。',
  'aiQuant.deleteDialog.runningTitle': '当前策略正在运行',
  'aiQuant.deleteDialog.strategy': '策略',
  'aiQuant.deleteDialog.unknownDescription': '暂时无法确认该策略是否正在运行。为避免误删运行中的策略，请稍后重试。',
  'aiQuant.deleteDialog.unknownTitle': '暂时无法删除',
  'aiQuant.deleteDialog.withConversationDescription': '这个会话已生成过策略，当前策略已停止。默认只删除 AI 对话和生成过程，不删除我的策略列表中的策略记录。',
  'aiQuant.deleteDialog.withConversationTitle': '删除 AI Quant 会话',
}
const mockT = (key: string) => mockTranslations[key] ?? key

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}))

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

  it('no-conversation default (unchecked): primary "保留为只读", secondary "取消", checkbox shows "彻底删除策略记录"', async () => {
    await render({
      kind: 'no-conversation',
      conversation: null,
      deleteStoppedStrategy: false,
      onKeepAsViewOnly: jest.fn(),
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.textContent).toContain('策略广场')
    expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')?.textContent).toContain('保留为只读')
    expect(container.querySelector('[data-testid="ai-quant-deletion-secondary"]')?.textContent).toContain('取消')
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox).toBeTruthy()
    expect(checkbox?.checked).toBe(false)
    expect(dialog?.textContent).toContain('彻底删除策略记录（不可恢复）')
    expect(container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')).toBeNull()
  })

  it('no-conversation checked: primary swaps to "彻底删除策略" with destructive warning', async () => {
    await render({
      kind: 'no-conversation',
      conversation: null,
      deleteStoppedStrategy: true,
      onKeepAsViewOnly: jest.fn(),
    })

    expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')?.textContent).toContain('彻底删除策略')
    expect(container.querySelector('[data-testid="ai-quant-deletion-secondary"]')?.textContent).toContain('取消')
    const warning = container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')
    expect(warning?.textContent).toContain('此操作不可恢复')
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

  it('uses a viewport-bounded scrollable layout with mobile action stacking', async () => {
    await render({
      kind: 'with-conversation',
      conversation: { title: '超长会话标题用于验证移动端换行不撑破弹框' },
      strategy: { name: '超长策略名称用于验证移动端换行不撑破弹框', id: 'stg-1' },
    })

    const overlay = container.firstElementChild
    const dialog = container.querySelector('[role="dialog"]')
    const infoRows = container.querySelectorAll('[data-testid="ai-quant-deletion-info-row"]')
    const actions = container.querySelector('[data-testid="ai-quant-deletion-actions"]')

    expect(overlay?.className).toContain('py-4')
    expect(dialog?.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog?.className).toContain('overflow-y-auto')
    expect(infoRows[0]?.className).toContain('flex-col')
    expect(actions?.className).toContain('grid')
    expect(actions?.className).toContain('sm:flex')
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

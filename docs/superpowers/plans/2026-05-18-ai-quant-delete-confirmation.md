# AI Quant Delete Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require confirmation before deleting any AI Quant conversation and show a success toast after deletion completes.

**Architecture:** Keep `ConversationSidebar` presentation-only and keep deletion decisions in `AiQuantPageClient`. Extend `AiQuantDeletionDialog` with a `conversation-only` kind for ordinary conversations, while preserving existing linked-strategy states and running-strategy protection.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest/jsdom, `react-i18next`, existing `@/lib/toast` DOM toast helper.

---

## Linked Spec

- `docs/superpowers/specs/2026-05-18-ai-quant-delete-confirmation-design.md`

## Tracking Issue

- https://github.com/AlphaNet7ed/stats/issues/1476

## File Structure

- Modify `apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx`
  - Owns delete confirmation dialog rendering.
  - Add `conversation-only` kind.
  - Hide strategy checkbox for ordinary conversation deletion.
- Modify `apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx`
  - Cover the new kind and ensure no strategy controls render.
- Modify `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - Owns conversation deletion state and side effects.
  - Open dialog for every delete click.
  - Call `toast.success` after successful delete.
- Modify `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`
  - Cover confirmation-before-delete, cancel behavior, success toast, failed server delete, and existing running strategy guard.
- Modify `apps/front/public/locales/zh/common.json`
  - Add Chinese dialog/toast copy.
- Modify `apps/front/public/locales/en/common.json`
  - Add English dialog/toast copy.

## Issue Scope

This work is one issue because all changes are in one UI flow and share the same state owner. No separate worktree is required unless execution happens in parallel with other frontend changes.

## Task 1: Add Dialog Tests for Ordinary Conversation Deletion

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx`

- [ ] **Step 1: Extend the test-only kind union**

In `RenderProps`, change `kind` to include `conversation-only`:

```ts
interface RenderProps {
  open?: boolean
  kind?: 'loading' | 'unknown' | 'running' | 'with-conversation' | 'no-conversation' | 'conversation-only'
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
```

- [ ] **Step 2: Add translations for the new copy**

Add these entries to `mockTranslations`:

```ts
'aiQuant.deleteDialog.conversationOnlyTitle': '删除 AI Quant 会话',
'aiQuant.deleteDialog.conversationOnlyDescription': '删除后，这个会话里的对话内容和生成过程将无法恢复。',
'aiQuant.deleteDialog.deleteConversation': '删除会话',
```

- [ ] **Step 3: Write the failing test**

Add this test inside `describe('AiQuantDeletionDialog', () => { ... })`:

```ts
it('conversation-only kind confirms ordinary conversation deletion without strategy controls', async () => {
  const onConfirm = jest.fn()
  const onClose = jest.fn()

  await render({
    kind: 'conversation-only',
    conversation: { title: 'Price Momentum draft' },
    strategy: undefined,
    onConfirm,
    onClose,
  })

  const dialog = container.querySelector('[role="dialog"]')
  expect(dialog?.textContent).toContain('删除 AI Quant 会话')
  expect(dialog?.textContent).toContain('删除后，这个会话里的对话内容和生成过程将无法恢复。')
  expect(dialog?.textContent).toContain('Price Momentum draft')
  expect(dialog?.textContent).toContain('会话')
  expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')?.textContent).toContain('删除会话')
  expect(container.querySelector('[data-testid="ai-quant-deletion-secondary"]')?.textContent).toContain('取消')
  expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  expect(container.textContent).not.toContain('策略')

  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ai-quant-deletion-primary"]')?.click()
  })

  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run the dialog test and confirm it fails for the missing kind**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx
```

Expected: FAIL because `conversation-only` is not assignable or the dialog does not render the new copy.

- [ ] **Step 5: Commit the failing test**

```bash
git add apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx
git commit -m "test: cover ordinary ai quant conversation deletion dialog"
```

## Task 2: Implement Ordinary Conversation Dialog State

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx`
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`
- Test: `apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx`

- [ ] **Step 1: Add the new dialog kind**

Change `AiQuantDeletionDialogKind`:

```ts
export type AiQuantDeletionDialogKind =
  | 'loading'
  | 'unknown'
  | 'running'
  | 'with-conversation'
  | 'no-conversation'
  | 'conversation-only'
```

- [ ] **Step 2: Add `conversation-only` content**

In `resolveContent`, insert this case before `with-conversation`:

```ts
case 'conversation-only':
  return {
    title: t('aiQuant.deleteDialog.conversationOnlyTitle'),
    description: t('aiQuant.deleteDialog.conversationOnlyDescription'),
  }
```

- [ ] **Step 3: Add primary action behavior**

After the `running` branch and before the `with-conversation` branch, add:

```ts
} else if (kind === 'conversation-only') {
  primaryLabel = t('aiQuant.deleteDialog.deleteConversation')
  primaryClassName = DESTRUCTIVE_PRIMARY_CLASS
  primaryHandler = onConfirm
  secondaryLabel = t('aiQuant.deleteDialog.cancel')
  secondaryHandler = onClose
```

- [ ] **Step 4: Keep checkbox hidden for ordinary conversations**

Leave these derived flags as:

```ts
const showCheckbox = kind === 'with-conversation' || kind === 'no-conversation'
const showInfoBlock = kind === 'with-conversation' || kind === 'running' || kind === 'no-conversation' || kind === 'conversation-only'
```

- [ ] **Step 5: Add Chinese copy**

In `apps/front/public/locales/zh/common.json`, under `aiQuant.deleteDialog`, add:

```json
"conversationOnlyTitle": "删除 AI Quant 会话",
"conversationOnlyDescription": "删除后，这个会话里的对话内容和生成过程将无法恢复。",
"deleteConversation": "删除会话",
"conversationDeleted": "会话已删除",
"conversationAndStrategyDeleted": "会话和策略记录已删除",
```

- [ ] **Step 6: Add English copy**

In `apps/front/public/locales/en/common.json`, under `aiQuant.deleteDialog`, add:

```json
"conversationOnlyTitle": "Delete AI Quant Conversation",
"conversationOnlyDescription": "After deletion, the conversation content and generation history cannot be recovered.",
"deleteConversation": "Delete conversation",
"conversationDeleted": "Conversation deleted",
"conversationAndStrategyDeleted": "Conversation and strategy record deleted",
```

- [ ] **Step 7: Run the dialog test and confirm it passes**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit dialog implementation**

```bash
git add apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -m "feat: add ai quant conversation delete confirmation dialog"
```

## Task 3: Add Page Tests for Confirmation and Toast Behavior

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`

- [ ] **Step 1: Mock toast in page tests**

Add this mock near existing mocks:

```ts
jest.mock('@/lib/toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}))
```

- [ ] **Step 2: Update the existing server-owned deletion test**

Change the test named `deletes a server-owned conversation through the backend and keeps it removed locally` so it asserts no API call until confirmation:

```ts
await act(async () => {
  ;(container.querySelector('[data-testid="delete-conv-1"]') as HTMLButtonElement).click()
  await Promise.resolve()
})

expect(deleteAiQuantConversation).not.toHaveBeenCalled()
expect(container.textContent).toContain('aiQuant.deleteDialog.conversationOnlyTitle')
expect(container.textContent).toContain('server-conv-1')

await act(async () => {
  ;(container.querySelector('[data-testid="ai-quant-deletion-primary"]') as HTMLButtonElement).click()
  await Promise.resolve()
})

expect(deleteAiQuantConversation).toHaveBeenCalledWith('conv-1')
expect(container.textContent).not.toContain('server-message-1')
expect(container.textContent).toContain('server-message-2')
```

- [ ] **Step 3: Add cancel behavior test for ordinary server-owned deletion**

Add:

```ts
it('keeps an ordinary server-owned conversation when delete confirmation is canceled', async () => {
  localStorage.clear()

  const { listAiQuantConversations, deleteAiQuantConversation } = jest.requireMock('@/lib/api') as {
    listAiQuantConversations: jest.Mock
    deleteAiQuantConversation: jest.Mock
  }

  listAiQuantConversations.mockResolvedValue([{
    id: 'conv-cancel',
    status: 'CONFIRM_GATE',
    updatedAt: '2026-04-10T12:00:00.000Z',
    conversationTitle: 'cancel-conv',
    conversationMessages: [{ role: 'assistant', content: 'cancel-message' }],
  }])

  await act(async () => {
    root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
    await Promise.resolve()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="delete-conv-cancel"]') as HTMLButtonElement).click()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="ai-quant-deletion-secondary"]') as HTMLButtonElement).click()
    await Promise.resolve()
  })

  expect(deleteAiQuantConversation).not.toHaveBeenCalled()
  expect(container.textContent).toContain('cancel-message')
  expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')).toBeNull()
})
```

- [ ] **Step 4: Add success toast test**

Add:

```ts
it('shows a success toast after deleting an ordinary server-owned conversation', async () => {
  localStorage.clear()

  const { listAiQuantConversations } = jest.requireMock('@/lib/api') as {
    listAiQuantConversations: jest.Mock
  }
  const { toast } = jest.requireMock('@/lib/toast') as {
    toast: { success: jest.Mock }
  }

  listAiQuantConversations.mockResolvedValue([{
    id: 'conv-toast',
    status: 'CONFIRM_GATE',
    updatedAt: '2026-04-10T12:00:00.000Z',
    conversationTitle: 'toast-conv',
    conversationMessages: [{ role: 'assistant', content: 'toast-message' }],
  }])

  await act(async () => {
    root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
    await Promise.resolve()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="delete-conv-toast"]') as HTMLButtonElement).click()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="ai-quant-deletion-primary"]') as HTMLButtonElement).click()
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(toast.success).toHaveBeenCalledWith({
    title: 'aiQuant.deleteDialog.conversationDeleted',
  })
})
```

- [ ] **Step 5: Add server failure test**

Add:

```ts
it('keeps the delete dialog open and does not show success toast when ordinary server delete fails', async () => {
  localStorage.clear()

  const { listAiQuantConversations, deleteAiQuantConversation } = jest.requireMock('@/lib/api') as {
    listAiQuantConversations: jest.Mock
    deleteAiQuantConversation: jest.Mock
  }
  const { toast } = jest.requireMock('@/lib/toast') as {
    toast: { success: jest.Mock }
  }

  listAiQuantConversations.mockResolvedValue([{
    id: 'conv-fail',
    status: 'CONFIRM_GATE',
    updatedAt: '2026-04-10T12:00:00.000Z',
    conversationTitle: 'fail-conv',
    conversationMessages: [{ role: 'assistant', content: 'fail-message' }],
  }])
  deleteAiQuantConversation.mockRejectedValueOnce(new Error('gateway failed'))

  await act(async () => {
    root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
    await Promise.resolve()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="delete-conv-fail"]') as HTMLButtonElement).click()
    await Promise.resolve()
  })

  await act(async () => {
    ;(container.querySelector('[data-testid="ai-quant-deletion-primary"]') as HTMLButtonElement).click()
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(container.textContent).toContain('gateway failed')
  expect(container.textContent).toContain('fail-message')
  expect(container.querySelector('[data-testid="ai-quant-deletion-primary"]')).not.toBeNull()
  expect(toast.success).not.toHaveBeenCalled()
})
```

- [ ] **Step 6: Run page tests and confirm failures**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
```

Expected: FAIL until page deletion flow opens the dialog and emits success toast.

- [ ] **Step 7: Commit failing page tests**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
git commit -m "test: require ai quant conversation delete confirmation"
```

## Task 4: Implement Page Deletion Flow and Toasts

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`

- [ ] **Step 1: Import toast**

Add:

```ts
import { toast } from '@/lib/toast'
```

- [ ] **Step 2: Add ordinary delete status**

Change `ConversationDeleteDialogState.status`:

```ts
status: 'loading' | 'running' | 'stopped' | 'draft' | 'unknown' | 'conversation-only'
```

- [ ] **Step 3: Open dialog instead of direct local delete**

Replace the `!serverOwnedConversations` branch in `requestDeleteConversation` with:

```ts
if (!serverOwnedConversations) {
  setConversationDeleteDialog({
    conversation: targetConversation,
    serverConversationId,
    strategyInstanceId: '',
    strategy: null,
    status: 'conversation-only',
    deleteStoppedStrategy: false,
    pending: false,
    errorMessage: null,
  })
  return
}
```

- [ ] **Step 4: Open dialog instead of direct server delete for unlinked conversations**

Replace the `if (!strategyInstanceId)` branch with:

```ts
if (!strategyInstanceId) {
  setConversationDeleteDialog({
    conversation: targetConversation,
    serverConversationId,
    strategyInstanceId: '',
    strategy: null,
    status: 'conversation-only',
    deleteStoppedStrategy: false,
    pending: false,
    errorMessage: null,
  })
  return
}
```

- [ ] **Step 5: Allow ordinary delete confirmation**

Keep the running/unknown guard as:

```ts
if (conversationDeleteDialog.status === 'running' || conversationDeleteDialog.status === 'unknown') return
```

No additional guard is needed because `conversation-only`, `stopped`, and `draft` are confirmable.

- [ ] **Step 6: Support local-only delete in `deleteConversationByMode`**

Change `deleteConversationByMode` to skip the API when `serverOwnedConversations` is false:

```ts
async function deleteConversationByMode(args: {
  conversation: ConversationState
  serverConversationId: string
  deleteStoppedStrategy?: boolean
}) {
  if (serverOwnedConversations) {
    if (args.deleteStoppedStrategy) {
      await deleteAiQuantConversation(args.serverConversationId, { deleteStoppedStrategy: true })
    } else {
      await deleteAiQuantConversation(args.serverConversationId)
    }
  }
  removeDeletedConversation(args.conversation.id)
}
```

- [ ] **Step 7: Show success toast after confirmed delete**

In `confirmDeleteConversation`, after `await deleteConversationByMode(...)` and before closing the dialog, add:

```ts
toast.success({
  title: t(conversationDeleteDialog.deleteStoppedStrategy
    ? 'aiQuant.deleteDialog.conversationAndStrategyDeleted'
    : 'aiQuant.deleteDialog.conversationDeleted'),
})
```

Then keep:

```ts
setConversationDeleteDialog(null)
```

- [ ] **Step 8: Map dialog status to new kind**

In the `kind` prop mapping for `AiQuantDeletionDialog`, add:

```ts
if (status === 'conversation-only') return 'conversation-only'
```

The final mapping should still return `loading`, `running`, `unknown`, or `with-conversation` for the existing linked-strategy states.

- [ ] **Step 9: Avoid rendering strategy metadata for ordinary deletes**

Change the `strategy` prop to pass `undefined` when `strategyInstanceId` is empty:

```tsx
strategy={conversationDeleteDialog && conversationDeleteDialog.strategyInstanceId
  ? {
      name: conversationDeleteDialog.strategy?.name ?? null,
      id: conversationDeleteDialog.strategyInstanceId,
    }
  : undefined}
```

- [ ] **Step 10: Run page tests**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit page implementation**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
git commit -m "feat: confirm ai quant conversation deletion"
```

## Task 5: Final Verification

**Files:**
- Verify only; no planned file changes.

- [ ] **Step 1: Run focused dialog test**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run focused page test**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
dx build front --dev
```

Expected: PASS. Build must complete without TypeScript or Next.js errors.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended implementation files are modified or staged. Existing unrelated untracked files should remain untouched.

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification forces small corrections, commit only the touched implementation/test/i18n files:

```bash
git add apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -m "fix: stabilize ai quant delete confirmation"
```

## Acceptance Criteria

- Clicking any AI Quant conversation delete icon opens a confirmation dialog.
- No conversation is removed before confirmation.
- Canceling the dialog keeps the conversation.
- Confirming ordinary conversation deletion removes the conversation.
- Server-owned ordinary deletion calls `deleteAiQuantConversation` only after confirmation.
- Successful deletion shows a success toast.
- Server delete failure leaves the dialog open and does not show success toast.
- Running linked strategy deletion remains blocked.
- Existing stopped linked strategy delete behavior remains intact.
- Focused unit tests pass.
- `dx build front --dev` passes before PR.

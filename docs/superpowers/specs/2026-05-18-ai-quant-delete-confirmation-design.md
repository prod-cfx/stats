# AI Quant Delete Confirmation Design

Date: 2026-05-18

## Context

AI Quant conversation deletion currently has two behaviors:

- Conversations linked to a published strategy already use `AiQuantDeletionDialog` to protect running strategies and to confirm deletion for stopped strategy records.
- Conversations without a linked strategy can be deleted directly from the conversation sidebar. This is risky because a mistaken click can remove a long conversation before the user has published or run a strategy.

The requested change is to require confirmation before deleting any AI Quant conversation and to show a success toast after deletion completes.

## Scope

In scope:

- AI Quant page conversation deletion in `apps/front`.
- Desktop sidebar and mobile conversation sheet delete buttons.
- Confirmation dialog for all conversation deletion paths.
- Success toast after successful deletion.
- Existing running-strategy protection remains unchanged.
- Unit tests for the affected deletion flows.

Out of scope:

- Backend API behavior changes.
- Recover/undo deleted conversations.
- Redesigning the AI Quant sidebar.
- Refactoring unrelated deployment, codegen, or backtest flows.

## Affected Files

- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- `apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx`
- `apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx`
- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`
- `apps/front/public/locales/zh/common.json`
- `apps/front/public/locales/en/common.json`

## Architecture

`ConversationSidebar` stays presentation-only. It continues to call `onDelete(id)` when the user clicks the delete icon and does not own confirmation behavior.

`AiQuantPageClient` remains the deletion decision owner. `requestDeleteConversation(id)` will always open a deletion dialog instead of deleting directly. It will still inspect linked strategy state when `publishedStrategyInstanceId` exists.

`AiQuantDeletionDialog` gains a new ordinary conversation deletion kind named `conversation-only`. This kind displays the conversation title and a destructive confirmation button, but does not show strategy metadata or the "delete stopped strategy" checkbox.

Deletion side effects stay in `AiQuantPageClient`:

- Server-owned conversations call `deleteAiQuantConversation(serverConversationId)`.
- Local-only conversations call `removeDeletedConversation(localConversationId)`.
- Successful deletion closes the dialog and calls `toast.success`.

## Interaction

All AI Quant conversation delete clicks open a confirmation dialog.

For ordinary conversations with no linked strategy:

- Title: "Delete AI Quant Conversation" / "删除 AI Quant 会话"
- Description: tells the user conversation content and generation history cannot be recovered.
- Info block: shows the conversation title.
- Actions: cancel and destructive "Delete conversation" / "删除会话".

For linked strategy conversations, existing behavior remains:

- Running strategy: deletion is blocked and the dialog can navigate to the running strategy.
- Stopped or draft strategy: user can delete only the conversation or also delete the stopped strategy record.
- Unknown strategy status: deletion is blocked.

After successful deletion:

- Show a success toast.
- If only the conversation was deleted, toast title says the conversation was deleted.
- If the stopped strategy record was also deleted, toast title says the conversation and strategy record were deleted.

Failed server deletion:

- Dialog remains open.
- Pending state clears.
- Inline error is shown.
- No success toast is shown.

## Data Flow

1. User clicks a conversation delete icon.
2. `ConversationSidebar` calls `onDelete(id)`.
3. `AiQuantPageClient.requestDeleteConversation(id)` resolves the target conversation and server conversation id.
4. If the conversation has no linked strategy, `AiQuantPageClient` opens `AiQuantDeletionDialog` with ordinary conversation deletion state.
5. If the conversation has a linked strategy, `AiQuantPageClient` keeps the current strategy-status inspection flow and opens the appropriate dialog state.
6. User confirms deletion.
7. `confirmDeleteConversation()` executes the correct delete operation.
8. On success, `removeDeletedConversation()` updates local UI state, the dialog closes, and a success toast appears.
9. On failure, dialog state receives an error message and remains open.

## Error Handling

- Running strategy deletion remains blocked.
- Unknown strategy status remains blocked to avoid unsafe deletion.
- Server delete errors keep the dialog open and surface the API error message when available.
- Duplicate confirm clicks are prevented with the existing pending lock.
- Closing the dialog while deletion is pending remains disabled.

## Testing

Update `AiQuantPageClient.test.tsx`:

- Server-owned conversation without linked strategy does not call `deleteAiQuantConversation` until the user confirms.
- Canceling ordinary conversation deletion keeps the conversation.
- Confirming ordinary conversation deletion removes the conversation and shows success toast.
- Server delete failure keeps the dialog open and does not show success toast.
- Running linked strategy still blocks deletion and does not call `deleteAiQuantConversation`.
- Stopped linked strategy can still delete conversation and optionally strategy record.

Update `AiQuantDeletionDialog.test.tsx`:

- New ordinary conversation kind renders the expected title, description, conversation title, cancel action, and destructive confirm action.
- New ordinary conversation kind does not render strategy checkbox controls.

## Verification

Run focused frontend tests:

```bash
dx test unit front apps/front/src/components/ai-quant/AiQuantDeletionDialog.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
```

If implementation touches shared UI or i18n behavior unexpectedly, also run:

```bash
dx test unit front
dx build front --dev
```

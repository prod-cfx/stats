# Critic Round 1: Mobile Confirm Chat Script Plan

Plan: `docs/superpowers/plans/2026-06-12-mobile-confirm-chat-script.md`
Issue: #2434
Track: B

## Verdict

Pass with no Critical or Major issues.

## Checklist

- PR topology: Single PR is appropriate. No schema, backend writer/consumer, async data producer, or irreversible migration exists.
- Data flow split risk: No D2 split required. Mobile consumes existing `CodegenSessionResponseDto` and already waits for `PUBLISHED` before exposing the CTA.
- Existing route compatibility: Plan preserves `/ai/script` route and tests, while removing it from confirm default path.
- Import/type reality: `AiPublishedStrategyContext` exists in `apps/quantify-mobile/lib/data/models/ai_strategy_context.dart` and already has `fromSession`, `scriptCode`, `publishedSnapshotId`, and `hasPublishedSnapshot` style accessors used by current pages.
- Test timing: Plan correctly requires red tests first for bubble, controller/page flow, and confirm navigation.
- Verification: Required commands include `dx lint`, `dx build affected --dev`, `flutter analyze`, and focused Flutter tests named by the issue.

## Minor Notes

- Plan Step 5 mentions `codeBlock` source as if `ChatTurn` already has such a field. Current `ChatTurn` has `content` plus optional context fields, while `QzChatBubble` has `codeBlock`. Implementation should keep script source in `AiPublishedStrategyContext.scriptCode` and map it to widget `codeBlock` at render time, avoiding a duplicate `ChatTurn.codeBlock` field.
- Confirm page cannot notify an already-mounted `/ai` controller directly because it is on a separate route. Returning to `/ai` is enough for the issue's confirm-page acceptance only if chat flow tests cover confirmation from chat. If product requires confirm-page initiated chat injection later, that should be a follow-up contract.

## Required Changes Before Execution

None.

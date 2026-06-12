# Critic Round 2: Mobile Confirm Chat Script Plan

Plan: `docs/superpowers/plans/2026-06-12-mobile-confirm-chat-script.md`
Issue: #2434
Track: B

## Verdict

Pass with no Critical or Major issues.

## Recheck Notes

- The previous plan allowed confirm-page tests to prove only route navigation with a stub `/ai`. The plan now requires routing `/ai` to the real `AiHomePage` and asserting the generated chat cards, script code, backtest extra, and no default `/ai/script` navigation.
- The previous minor note about confirm-page initiated chat injection is now in scope. The plan adds `ai_confirm_chat_handoff.dart` as an explicit one-shot Riverpod bridge from `AiConfirmPage` to `AiHomePage`.
- The plan now uses the real factory name `AiPublishedStrategyContext.fromCodegen(result)` and keeps script source in `strategyContext.scriptCode`, mapped to `QzChatBubble.codeBlock` at render time.

## Checklist

- PR topology: Single PR remains appropriate; no schema, backend writer/consumer, or irreversible migration exists.
- Data flow: Confirm page owns publish completion; chat page owns chat turns. The handoff boundary is explicit and testable.
- Existing route compatibility: `/ai/script` stays registered for deep links and tests, but confirm success no longer uses it as the default path.
- Test coverage: Confirm-page acceptance now exercises real `AiHomePage`, `ai-bubble-script-generating`, `ai-bubble-script-ready`, no Markdown fence text, and `/ai/backtest-config` extra.
- Verification: Required commands still include `dx lint`, `dx build affected --dev`, Flutter analyze, focused Flutter tests, and debug APK build when needed.

## Required Changes Before Execution

None.

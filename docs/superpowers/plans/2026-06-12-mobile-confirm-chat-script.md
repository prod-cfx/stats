# Mobile Confirm Chat Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After `/ai/confirm` succeeds, return to `/ai` and show script generation progress, script-ready card, code block, and backtest CTA inside the AI conversation.

**Architecture:** Keep `/ai/script` for deep links but remove it from the confirm success path. Represent script generation as explicit chat turn kinds so normal text bubbles no longer carry Markdown fences. Bridge `/ai/confirm` back to the real `/ai` page with a one-shot Riverpod handoff carrying the published `CodegenSessionResponseDto`; `AiHomePage` consumes it, inserts a generating turn, replaces it with a ready turn, and passes `AiPublishedStrategyContext` into `/ai/backtest-config` from chat.

**Tech Stack:** Flutter, Riverpod, GoRouter, backend_api_contracts DTOs, existing `AiChatRepository` mock/API contracts.

---

## Files

- Modify: `apps/quantify-mobile/lib/data/models/ai_chat_models.dart` — add `scriptGenerating`, `scriptReady`, and published strategy context field.
- Modify: `apps/quantify-mobile/lib/pages/ai/ai_home_page_controller.dart` — create script-generating turn and replace with script-ready turn using real published snapshot context.
- Create: `apps/quantify-mobile/lib/pages/ai/ai_confirm_chat_handoff.dart` — one-shot Riverpod handoff from confirm page to chat page.
- Modify: `apps/quantify-mobile/lib/pages/ai/widgets/qz_chat_bubble.dart` — render generating card and ready card with code block plus `开始回测` CTA.
- Modify: `apps/quantify-mobile/lib/pages/ai/ai_home_page.dart` — wire script turn rendering and backtest navigation with `extra`.
- Modify: `apps/quantify-mobile/lib/pages/ai/ai_confirm_page.dart` — confirm success path writes the published result into the handoff and goes to `/ai`, not `/ai/script`.
- Modify tests: `apps/quantify-mobile/test/pages/ai_chat_page_test.dart`, `apps/quantify-mobile/test/pages/ai_confirm_page_test.dart`, `apps/quantify-mobile/test/pages/ai_script_page_test.dart`, `apps/quantify-mobile/test/widgets/qz_chat_bubble_test.dart`, plus model/repository tests if enum expectations need updates.

## Steps

- [ ] Step 1: Write failing widget tests for `QzChatBubble` script states.
  - Add tests that `scriptGenerating` style input renders `正在生成策略脚本` and `确认参数 · 生成代码 · 注入风控`.
  - Add tests that script-ready input renders `策略脚本已生成`, a code block, and `开始回测`, and tapping CTA invokes callback.
  - Run: `cd apps/quantify-mobile && flutter test test/widgets/qz_chat_bubble_test.dart --plain-name "script"`.
  - Expected: fail because widget has no script state API yet.

- [ ] Step 2: Write failing controller/page tests for chat flow.
  - Update `ai_chat_page_test.dart` so confirm intent first shows generating card, then ready card without Markdown fences, and tapping `开始回测` reaches `/ai/backtest-config` with the `AiPublishedStrategyContext` extra.
  - Run focused test and confirm failure on missing kind/card/extra.

- [ ] Step 3: Write failing confirm page test for real chat rendering.
  - Route `/ai` to the real `AiHomePage`, not a `Text('ai-chat-route')` stub.
  - After `/ai/confirm` succeeds, assert `ai-bubble-script-generating` and `确认参数 · 生成代码 · 注入风控` appear in `/ai`.
  - Then assert `ai-bubble-script-ready`, script code, no Markdown fence text, and `开始回测` route extra containing `publishedSnapshotId=snapshot-1` and `codegenSessionId=session-1`.
  - Assert `/ai/script` is not entered by default.
  - Run focused test and confirm failure because confirm page only navigates to `/ai` and does not notify `AiHomePage`.

- [ ] Step 4: Add model support.
  - Extend `ChatTurnKind` with `scriptGenerating` and `scriptReady`.
  - Add `AiPublishedStrategyContext? strategyContext` to `ChatTurn`.
  - Import `ai_strategy_context.dart` in model file.

- [ ] Step 5: Add confirm-to-chat handoff.
  - Create `ai_confirm_chat_handoff.dart` with a small `NotifierProvider` storing `AiConfirmChatHandoff?`.
  - In `AiConfirmPage._returnToChat`, set the handoff to the published result before `context.go('/ai')`.
  - In `AiHomePage`, after sessions initialize, consume and clear the handoff in a post-frame callback so provider writes do not happen during build.

- [ ] Step 6: Update chat controller.
  - In `confirmStrategyInChat`, set pending turn kind to `scriptGenerating` with content `正在生成策略脚本`.
  - Add `consumeConfirmHandoff` to append a `scriptGenerating` turn to the current chat session and replace it with `_publishedScriptTurn(result)`.
  - In `_publishedScriptTurn`, build `AiPublishedStrategyContext.fromCodegen(result)` and return kind `scriptReady`, content `策略脚本已生成`, and `strategyContext` on the turn.
  - Remove Markdown code fence from content.

- [ ] Step 7: Update bubble rendering.
  - Add `scriptState`, `scriptCode`, `onStartBacktest` or equivalent explicit constructor fields.
  - Render generating card with spinner and three semantic steps.
  - Render ready card with success header, mono code block, and `开始回测` CTA.
  - Keep existing text/params/deployed behavior compatible.

- [ ] Step 8: Wire page navigation.
  - In `ai_home_page.dart`, pass script state/code/context from `ChatTurn` to `QzChatBubble`.
  - `开始回测` calls `context.push('/ai/backtest-config', extra: t.strategyContext)` only when context has published snapshot.
  - In `ai_confirm_page.dart`, replace success push to `/ai/script` with `context.go('/ai')` after confirm polling completes.

- [ ] Step 9: Keep `/ai/script` compatible.
  - Do not remove router entry or script page tests.
  - Adjust only copy or assertions that describe it as default main path.

- [ ] Step 10: Run verification.
  - Parallel verification loop: `dx lint`, `dx build affected --dev`, Flutter focused tests.
  - Run `cd apps/quantify-mobile && flutter analyze`.
  - If Flutter implicit pub obscures exit, run `flutter pub get` then rerun tests/analyze with `--no-pub` where supported.
  - Run `flutter build apk --debug` if build affected or analyze exposes mobile build risk.

## Verify

- `dx lint`
- `dx build affected --dev`
- `cd apps/quantify-mobile && flutter analyze`
- `cd apps/quantify-mobile && flutter test test/pages/ai_chat_page_test.dart test/pages/ai_confirm_page_test.dart test/pages/ai_script_page_test.dart test/widgets/qz_chat_bubble_test.dart`
- `cd apps/quantify-mobile && flutter build apk --debug` if needed

## Commit

Use heredoc:

```bash
git add -A
git commit -F - <<'MSG'
feat: return confirm flow to chat script generation

变更说明：
- 确认策略成功后回到 AI 对话页，脚本生成和完成态由对话富气泡承载
- 为脚本生成中和脚本已生成新增明确 chat turn kind，并传递真实 published snapshot 到开始回测
- 更新确认页、对话页、脚本页兼容测试和气泡测试

Refs: #2434
MSG
```

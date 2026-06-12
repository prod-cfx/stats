# Mobile AI Entry Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align mobile AI conversation entry, top-bar action, quick chips, params bubble copy, and Flutter tests with issue #2433.

**Architecture:** Keep change in Flutter UI layer. Reuse existing GoRouter routes and existing `QzAiTopBar`, `AiHomePage`, `QzChatBubble`, mock fixture, and l10n keys. Do not change backend contracts or data models.

**Tech Stack:** Flutter, Riverpod, GoRouter, generated Flutter l10n, widget tests.

---

## Files

- Modify: `apps/quantify-mobile/test/fixtures/mock/fixtures/ai_chat.dart` for default AVAX mock title and comment.
- Modify: `apps/quantify-mobile/lib/widgets/qz_ai_top_bar.dart` to add `回测`/Backtest action between title and new-session button.
- Modify: `apps/quantify-mobile/lib/pages/ai/ai_home_page.dart` to route top-bar and quick-chip taps instead of sending chat messages.
- Modify: `apps/quantify-mobile/lib/pages/ai/widgets/qz_chat_bubble.dart` to update params prompt and CTA semantics.
- Modify: `apps/quantify-mobile/lib/l10n/app_zh.arb`, `app_en.arb`, and generated `app_localizations*.dart` to rename backtest action/copy labels.
- Modify: `apps/quantify-mobile/test/pages/ai_chat_page_test.dart`, `test/pages/ai_home_top_bar_golden_test.dart`, and `test/widgets/qz_chat_bubble_test.dart` for red/green coverage.

## Steps

- [ ] **Step 1: Write failing widget tests for issue #2433 behavior**
  - Update `ai_chat_page_test.dart` expectations:
    - default title is `AVAX 突破 · 待确认` and `待部署` absent.
    - top bar has `ai-appbar-backtest`; tapping it reaches `/ai/backtest-config`; no chat send is created.
    - quick chips `逻辑图 / 回测结果 / 部署` navigate to `/ai/confirm`, `/ai/backtest-result`, `/ai/deploy`; no chat send is created.
    - title style lookup uses `待确认`.
  - Add test router stub routes for `/ai/backtest-config`, `/ai/backtest-result`, `/ai/deploy`.
  - Update `qz_chat_bubble_test.dart` expectations to `请先确认策略逻辑，确认后我会继续生成脚本。` and `查看逻辑图`.
  - Update top-bar builder test to pass backtest tooltip/callback and assert button presence.
  - Run focused tests and confirm they fail for expected missing UI/copy/navigation.

- [ ] **Step 2: Implement mock title and l10n copy**
  - Change AVAX fixture title/comment from `待部署` to `待确认`.
  - Add/update l10n labels:
    - `aiAppBarBacktestTooltip`: zh `回测设置`, en `Backtest settings`.
    - `aiAppBarBacktestButton`: zh `回测`, en `Backtest`.
    - `aiStartBacktestPrompt`: zh `请先确认策略逻辑，确认后我会继续生成脚本。`, en `Review the strategy logic first. After confirmation, I will continue generating the script.`
    - `aiConfirmStrategy`: zh `查看逻辑图`, en `View logic graph`.
  - Update generated localizations manually to match existing generated file style.

- [ ] **Step 3: Implement top-bar backtest action**
  - Extend `QzAiTopBar` constructor with `backtestTooltip`, `backtestLabel`, and `onOpenBacktest`.
  - Render a compact text button with key `ai-appbar-backtest` before the new-session icon.
  - Keep existing history and new-session keys/geometry stable.
  - Wire `AiHomePage` `onOpenBacktest` to `context.push('/ai/backtest-config')`.

- [ ] **Step 4: Implement quick-chip navigation and CTA route**
  - Replace quick-chip send callback with index/label route mapping in `AiHomePage`:
    - `逻辑图` -> `/ai/confirm`
    - `回测结果` -> `/ai/backtest-result`
    - `部署` -> `/ai/deploy`
  - Change params-bubble `onConfirm` route from in-chat confirmation to `context.push('/ai/confirm')` when params bubble has no current codegen metadata.
  - Keep typed confirm intent flow unchanged for text replies with codegen metadata.

- [ ] **Step 5: Verify focused tests pass**
  - Run `dx test unit quantify-mobile test/pages/ai_chat_page_test.dart`.
  - Run `dx test unit quantify-mobile test/widgets/qz_chat_bubble_test.dart`.
  - Run `dx test unit quantify-mobile test/pages/ai_home_top_bar_golden_test.dart`.

- [ ] **Step 6: Run required parallel verification**
  - Run `dx lint`.
  - Run affected build: `dx build quantify-mobile --dev` if target exists, otherwise `dx build affected --dev`.
  - Run associated Flutter tests from Step 5.

- [ ] **Step 7: Commit and PR**
  - Commit with Conventional Commit and `Refs: #2433`.
  - Push branch `codex/feat/2433-mobile-ai-entry-nav`.
  - Create PR with repository template sections and `Closes: #2433`.

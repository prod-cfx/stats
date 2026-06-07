# Quantify Mobile Real Data Batch Multi-PR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each child issue task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track and sequence the `apps/quantify-mobile` migration from implicit mock fallback to real backend data while keeping `USE_MOCK=true` as explicit demo mode.

**Track:** C
**Total PRs:** 1 parent planning PR plus 8 child implementation PRs/issues
**Issue:** #2305

**Architecture:** #2305 is the parent coordination issue. Business changes stay in child issues #2306..#2313 so each domain can be reviewed, reverted, and verified independently. The mobile boundary is repository/provider first: UI consumes repositories, API implementations use generated contracts or explicit backend endpoints, and mock repositories remain available only when `USE_MOCK=true`.

**Tech Stack:** Flutter, Riverpod, generated Dart API contracts, NestJS/OpenAPI when contract gaps must be closed, `dx` command wrapper for repository verification.

---

## PR Topology

| PR | Title | Issue | Layers | Depends On | Sentinel Needed |
| --- | --- | --- | --- | --- | --- |
| Parent | `docs(quantify-mobile): plan real-data migration batch` | #2305 | docs / issue tracking | - | No |
| Child 1 | `feat(quantify-mobile): 接入行情聚合真实数据并移除详情页派生 mock` | #2306 | mobile repository + pages + optional backend contracts | Parent | No |
| Child 2 | `feat(quantify-mobile): 交易下单接入真实账户余额和下单 API` | #2307 | mobile repository + market trade sheet + optional backend contracts | Parent | No |
| Child 3 | `feat(quantify-mobile): 策略广场详情接真实指标 signals 和权益曲线` | #2308 | mobile strategy repository + pages + optional quantify contracts | Parent | No |
| Child 4 | `feat(quantify-mobile): 实盘策略详情和状态操作接真实实例 API` | #2309 | mobile live strategy repository/store + optional quantify contracts | Parent | No |
| Child 5 | `feat(quantify-mobile): AI 会话脚本回测部署接真实事件流` | #2310 | mobile AI repositories/controllers + optional event/contract endpoints | Parent | No |
| Child 6 | `feat(quantify-mobile): 巨鲸画像监控通知接真实数据并移除 fixture 兜底` | #2311 | mobile whale repositories/providers + optional backend contracts | Parent | No |
| Child 7 | `feat(quantify-mobile): Telegram 和游客登录接真实身份签发` | #2312 | auth repository/service/controller + optional backend auth endpoints | Parent | No |
| Child 8 | `chore(quantify-mobile): 收口 mock 开关文档和真实模式防回退测试` | #2313 | mobile docs + provider tests + static fixture guard | Parent and child domain decisions | No |

## Decomposition Rules

- [ ] Keep every child PR scoped to one issue and one business domain.
- [ ] Use `USE_MOCK=false` as the default real-data path. Do not read `apps/quantify-mobile/lib/data/mock/fixtures/**` from API repositories as fallback business data.
- [ ] Preserve `USE_MOCK=true` for mock repositories, demos, widget tests, and offline development.
- [ ] When a backend or contract field is missing, either add the endpoint/DTO/contracts in the same child PR or show a real empty/error state. Do not fabricate production values in widgets.
- [ ] For contract changes, run `dx build contracts` after backend/quantify swagger export can compile.
- [ ] For mobile child PRs, run `flutter analyze` and targeted `flutter test ...` commands listed in the child issue from `apps/quantify-mobile`; also run repository-level `dx build affected --dev` before push.

## Parent PR Detail

### Files

- Create: `docs/superpowers/plans/2026-06-07-quantify-mobile-real-data-batch-multi-pr.md`
- Create: `.omc/plans/quantify-mobile-real-data-batch-multi-pr-critic-round1.md`
- Modify: GitHub issue #2305 body to reference this plan and the PR topology.

### Tasks

- [ ] Verify #2305 has `## 背景`, `## 目标`, `## 方案`, and `## 验收标准` sections.
- [ ] Verify child issues #2306..#2313 exist and each body contains `Refs: #2305`.
- [ ] Write this plan with a topology table and domain boundaries.
- [ ] Run plan critic once and resolve Critical/Major findings before implementation.
- [ ] Update #2305 `## 方案` to include this plan path and PR topology.
- [ ] Run verification: `dx lint`, `dx build affected --dev`, and a focused docs/no-code test check.
- [ ] Commit, push, and create a parent planning PR.

## Child Issue Execution Matrix

### #2306 Market Aggregation

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_agg_orderbook_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/market_detail_stats.dart`
- Modify: `apps/quantify-mobile/lib/pages/market/market_detail_page.actions.part.dart`
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_controller.dart`
- Test: `apps/quantify-mobile/test/data/api_agg_orderbook_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/market_detail_panels_test.dart`
- Test: `apps/quantify-mobile/test/pages/data_hub_page_test.dart`

**Steps:**
- [ ] Write failing tests proving API aggregation does not import or return mock OI/volume in real mode.
- [ ] Map real backend/contract fields for OI, volume, 24H stats, funding, mark, and index price.
- [ ] Replace widget-level derived fake values with repository snapshots or `--` empty states.
- [ ] Run `flutter test test/data/api_agg_orderbook_repository_test.dart test/pages/market_detail_panels_test.dart test/pages/data_hub_page_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2307 Trade Order Sheet

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/qz_trade_order_sheet.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Create or modify: `apps/quantify-mobile/lib/data/repositories/trading_order_repository.dart`
- Create or modify: `apps/quantify-mobile/lib/data/api/api_trading_order_repository.dart`
- Test: `apps/quantify-mobile/test/widgets/qz_trade_order_sheet_test.dart`

**Steps:**
- [ ] Write failing tests proving real-mode submit calls a repository and failed backend responses keep the sheet open.
- [ ] Add repository methods for order context, preview, and submit.
- [ ] Make sheet summary and submit state consume repository data rather than constants and timers.
- [ ] Run `flutter test test/widgets/qz_trade_order_sheet_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2308 Strategy Plaza

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_strategy_repository.dart`
- Modify: `apps/quantify-mobile/lib/pages/strategy/strategy_detail_controller.dart`
- Modify: `apps/quantify-mobile/lib/pages/strategy/strategy_detail_page.sections.part.dart`
- Test: `apps/quantify-mobile/test/data/api_strategy_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/strategy_market_page_test.dart`
- Test: `apps/quantify-mobile/test/pages/strategy_detail_page_test.dart`

**Steps:**
- [ ] Write failing tests proving hero, details, signals, and equity curve do not come from `MockStrategyRepository` in real mode.
- [ ] Map generated contracts or add backend/quantify DTOs for missing detail fields.
- [ ] Show empty states for missing optional modules.
- [ ] Run `flutter test test/data/api_strategy_repository_test.dart test/pages/strategy_market_page_test.dart test/pages/strategy_detail_page_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2309 Live Strategy Details

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_live_strategy_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/repositories/live_strategy_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/business_providers.dart`
- Modify: `apps/quantify-mobile/lib/pages/live/live_strategy_detail_page.dart`
- Test: `apps/quantify-mobile/test/data/api_live_strategy_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/live/live_strategy_detail_page_test.dart`

**Steps:**
- [ ] Write failing tests proving real-mode position/trades/params and status actions use API repository results.
- [ ] Add pause/resume/delete repository actions with refresh or rollback semantics.
- [ ] Remove real-mode imports of `mockLivePositions` and `MockLiveStrategyRepository` fallbacks.
- [ ] Run `flutter test test/data/api_live_strategy_repository_test.dart test/pages/live/live_strategy_detail_page_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2310 AI Workflow

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_ai_chat_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_backtest_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Modify: `apps/quantify-mobile/lib/pages/ai/ai_script_page_controller.dart`
- Modify: `apps/quantify-mobile/lib/pages/ai/widgets/qz_deploy_sheet.dart`
- Test: `apps/quantify-mobile/test/data/api_ai_chat_repository_test.dart`
- Test: `apps/quantify-mobile/test/data/mock_backtest_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/ai_chat_page_test.dart`
- Test: `apps/quantify-mobile/test/pages/ai_script_page_test.dart`
- Test: `apps/quantify-mobile/test/pages/ai_load_strategy_test.dart`

**Steps:**
- [ ] Write failing tests proving real job/session IDs are required and local timers do not create success states.
- [ ] Implement repository polling or event stream for codegen, backtest, and deploy states.
- [ ] Convert `backtestResultProvider` to a family keyed by real job ID.
- [ ] Run `flutter test test/data/api_ai_chat_repository_test.dart test/data/mock_backtest_repository_test.dart test/pages/ai_chat_page_test.dart test/pages/ai_script_page_test.dart test/pages/ai_load_strategy_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2311 Whale Data

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_profile_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_leaderboard_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_watch_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/business_providers.dart`
- Modify: `apps/quantify-mobile/lib/domain/use_cases/whale_leader_use_cases.dart`
- Modify: `apps/quantify-mobile/lib/domain/use_cases/whale_holding_use_cases.dart`
- Test: `apps/quantify-mobile/test/data/api_whale_extras_repository_test.dart`
- Test: `apps/quantify-mobile/test/data/mock_whale_profile_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/whale_home_page_test.dart`
- Test: `apps/quantify-mobile/test/pages/whale_profile_page_test.dart`
- Test: `apps/quantify-mobile/test/pages/whale_watch_tab_test.dart`

**Steps:**
- [ ] Write failing tests proving empty API responses render empty state rather than mock leaders/holdings/rules.
- [ ] Remove API repository fixture fallbacks.
- [ ] Make notifications initialize from repository or push state, not `mockWhaleNotifications`.
- [ ] Run `flutter test test/data/api_whale_extras_repository_test.dart test/data/mock_whale_profile_repository_test.dart test/pages/whale_home_page_test.dart test/pages/whale_profile_page_test.dart test/pages/whale_watch_tab_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2312 Auth Entrypoints

**Files:**
- Modify: `apps/quantify-mobile/lib/data/auth/session_controller.dart`
- Modify: `apps/quantify-mobile/lib/data/repositories/auth_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_auth_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/services/auth_service.dart`
- Test: `apps/quantify-mobile/test/data/session_controller_test.dart`
- Test: `apps/quantify-mobile/test/data/api_auth_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/login_sheet_test.dart`

**Steps:**
- [ ] Write failing tests proving real mode cannot produce `guest-local` tokens or `telegram-user@mock` sessions.
- [ ] Add Telegram and guest login methods to repository and service layers.
- [ ] Make session controller call repository methods and persist only backend-issued sessions.
- [ ] Run `flutter test test/data/session_controller_test.dart test/data/api_auth_repository_test.dart test/pages/login_sheet_test.dart` from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

### #2313 Mock Switch Guard

**Files:**
- Modify: `apps/quantify-mobile/docs/mock-data.md`
- Modify: `apps/quantify-mobile/test/data/providers_test.dart`
- Modify: `apps/quantify-mobile/test/data/provider_override_widget_test.dart`
- Create or modify: a static test under `apps/quantify-mobile/test/data/` for API repository fixture imports.

**Steps:**
- [ ] Write failing tests proving `useMockProvider=false` selects API repositories.
- [ ] Add a static guard for long-term `lib/data/api` imports of `../mock/fixtures/**`, with explicit issue-linked temporary exemptions only while child issues remain open.
- [ ] Update mock-data docs to state default real mode and explicit mock mode.
- [ ] Run `flutter test test/data/providers_test.dart test/data/provider_override_widget_test.dart` plus the new guard test from `apps/quantify-mobile`.
- [ ] Run `flutter analyze` from `apps/quantify-mobile`.

## Verification For This Parent PR

- [ ] `dx lint`
- [ ] `dx build affected --dev`
- [ ] `dx test unit config`
- [ ] Confirm #2305 links #2306..#2313 and each child issue references #2305.

## Commit

```bash
git add docs/superpowers/plans/2026-06-07-quantify-mobile-real-data-batch-multi-pr.md .omc/plans/quantify-mobile-real-data-batch-multi-pr-critic-round1.md
git commit -F - <<'MSG'
docs: plan quantify mobile real-data batch

变更说明：
- 固化 #2305 父 issue 的 Track C 批次拓扑和子 issue 执行矩阵
- 明确 USE_MOCK=false 真实模式边界与子 PR 验证命令

Refs: #2305
MSG
```

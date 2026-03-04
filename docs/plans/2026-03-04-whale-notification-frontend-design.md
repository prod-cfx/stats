# Whale Monitoring Frontend Design

## Scope
- Only frontend changes.
- Keep Coinflux existing visual language and interaction style.
- No backend implementation changes in this phase.

## Goals
- Rename whale notification experience to whale monitoring.
- Enforce login guard for all monitoring-create actions (toast only, no redirect/modal).
- Whale monitoring page content must only contain two sections:
  1. 监控地址 (address monitor rules)
  2. 实时巨鲸 (symbol + threshold monitor rules)

## Naming and IA Changes
- Whale submenu label: `通知管理` -> `监控`.
- Monitoring page title: `巨鲸通知管理` -> `巨鲸监控`.
- Route remains `/{lng}/whale-tracking/notifications` to avoid link breakage.
- Inside page, remove Rules/Inbox tabs and use two stacked sections:
  - `监控地址 (N)`
  - `实时巨鲸 (N)`

## User Flows
1. Address monitor creation:
- User enters whale profile page from Discover / Realtime / Holdings.
- Click `一键监控`.
- If not logged in: show toast and stop.
- If logged in: open create monitor modal in ADDRESS mode and submit.

2. Realtime whale monitor creation:
- User clicks `关注币种推送` on realtime whales page.
- If not logged in: show toast and stop.
- If logged in: open create monitor modal in SYMBOL mode and submit.

3. Monitoring page create action:
- User clicks `创建监控` on monitoring page.
- If not logged in: show toast and stop.
- If logged in: open create monitor modal.

## Rule Types (Frontend)
- `ADDRESS`
  - `address` (required)
  - `thresholdUsd` (required, default `500000`)
  - `note` (optional)
  - channels: web/email/telegram

- `SYMBOL`
  - `symbol` (required)
  - `thresholdUsd` (required, default `500000`)
  - channels: web/email/telegram

## UI Structure (Hyperbot-like, Coinflux-compatible)
- Top action bar: title + `创建监控` button.
- Section A (监控地址): row-oriented list with address, threshold, channels, status, actions.
- Section B (实时巨鲸): row-oriented list with symbol, threshold, channels, status, actions.
- Keep Coinflux tokens and components (surface, border, spacing, rounded shape, typography).

## Auth Guard Rule
- Guard all monitor-create actions by token existence.
- If no token:
  - show toast (`请先登录后使用监控功能` / `Please log in to use monitoring features`)
  - do not navigate
  - do not open login modal

## Acceptance Mapping
- Whale submenu displays `监控`.
- Monitoring page displays `巨鲸监控`.
- Monitoring page contains only two blocks: `监控地址` and `实时巨鲸`.
- Not-logged-in users cannot create monitor rules and only see toast.
- Logged-in users can create ADDRESS and SYMBOL monitor rules normally.

## Non-Goals
- Backend monitor dispatch logic refactor.
- New login modal or auth flow redesign.
- New global notification center beyond this monitoring page.

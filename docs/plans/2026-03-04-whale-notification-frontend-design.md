# Whale Notification Frontend Design

## Scope
- Only frontend changes.
- Keep Coinflux current UI style and interaction language.
- No backend implementation changes in this phase.

## Goals
- Support two message push types only:
  1. Address rule: follow one whale address and push when that address opens large orders.
  2. Realtime symbol rule: from realtime whales page, user selects symbol and minimum order amount to push.
- Support channel selection per rule: Web / Email / Telegram.
- Global bell with unread count, and whale notification center entry.

## User Flows
1. Address rule creation:
- User enters whale address profile page from Discover / Realtime / Holdings.
- Click "一键关注" on profile page.
- Open create monitor modal (address preset).
- Submit and create rule.

2. Realtime symbol rule creation:
- User is on `/[lng]/whale-tracking/realtime`.
- Click "关注币种推送".
- Select symbol(s) and minimum amount.
- Submit and create rule.

3. Notification center:
- User clicks global navbar bell.
- Route to whale notification center tab.
- View list, mark read, mark all read, inspect per-channel delivery status.

## Information Architecture
- Add whale menu child route: `/[lng]/whale-tracking/notifications`.
- Notification page tabs:
  - Rules
  - Inbox
- Global navbar bell:
  - Shows unread count
  - Navigates to inbox tab

## Rule Types (Frontend Contract)
- `ADDRESS`
  - `address` (required)
  - `defaultThresholdUsd` (required, default `500000`)
  - `note` (optional)
  - channels: web/email/telegram

- `SYMBOL`
  - `symbol` (required)
  - `minTradeValueUsd` (required, default `500000`)
  - channels: web/email/telegram

## Channel Defaults
- Web: default on.
- Email: default on only if account is email-login.
- Telegram: default off, user can turn on manually.

## UI Constraints (Must Match Existing Coinflux)
- Reuse existing visual tokens: colors, border radius, shadows, spacing scale.
- Reuse existing modal/table/button/toast styling patterns.
- No new design language, no custom animation system.
- Keep mobile breakpoints and responsive behavior aligned with existing whale pages.

## Component Plan
- New module: `apps/front/src/features/whale-notification/`
  - `api/`: rule/inbox/unread endpoints
  - `hooks/`: data-fetch hooks
  - `components/`: modal, rule list, inbox list, channel badges
- Integrations:
  - Realtime whales page: symbol rule entry
  - Whale profile page: address rule entry
  - Navbar: bell + unread badge + route

## Data Flow
- Create rule:
  - submit form -> create API -> refresh rules list -> toast feedback.
- Inbox:
  - load list -> read single/batch -> refresh unread badge.
- Unread badge:
  - initial fetch + interval polling (simple first version).

## Error Handling
- Form-level validation for threshold/symbol/address.
- Channel partial failure shown in message item status.
- Browser notification permission is requested only when web channel is enabled.
- If browser permission denied, keep in-site message path active.

## Acceptance Mapping (Frontend)
- Address profile can create address rule via one-click follow.
- Realtime page can create symbol+amount rule.
- Rules can pick channels.
- Global bell shows unread count and links to inbox.
- Inbox displays notification records and delivery status.

## Non-Goals
- Backend module implementation details.
- New global notification platform beyond whale notifications.

# Mobile OpenAPI Path Audit

Reference swagger: `packages/api-contracts-dart/openapi/openapi.json` generated from `dist/openapi/backend.json`.
Reference repo: `/home/ubuntu/ranger_work/ai-monorepo`.

## Auth

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/auth/login` | `/auth/login` | change mobile path or generated `AuthApi` call |
| `/api/auth/login-code` | `/auth/send-verification-code` | change mobile path or generated `AuthApi` call |
| `/api/auth/login-code/verify` | `/auth/verify-email` or `/auth/password-reset/verify` depending flow | split by flow in auth migration |
| `/api/auth/logout` | missing | remove mobile call or add backend endpoint in a separate backend issue |
| `/api/auth/me` | `/users/me` | use generated `UsersApi` |

## Market Pilot

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/markets/tickers` | `/markets/ticker` | pilot uses generated `MarketsApi.marketsControllerGetTicker`; list behavior remains one request per configured symbol until backend list endpoint exists |
| `/api/markets/tickers/{symbol}` | `/markets/ticker?symbol={symbol}` | pilot uses generated `MarketsApi.marketsControllerGetTicker` |
| `/api/markets/klines` | `/kline` | migrate after ticker pilot |
| `/api/markets/orderbook` | `/orderbook/aggregated` | migrate after ticker pilot |
| `/api/markets/long-short/ratio` | `/markets/long-short-ratio` | migrate after ticker pilot |
| `/api/markets/long-short/snapshot` | missing exact match; `/markets/long-short-ratio/exchanges` exists | keep hand layer until product mapping is confirmed |

## Whale

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/whales/feed` | `/whale-alerts/realtime` or `/whale-alerts/trades` | choose per UI feed semantics before migration |
| `/api/whales/leaderboard` | `/whale-tracking/discover` | migrate after market domain |
| `/api/whales/holdings` | `/whale-holdings` | migrate after market domain |
| `/api/whales/profiles/{address}` | `/whale-tracking/traders/{address}/snapshot` | migrate after profile UI contract review |
| `/api/whales/watch/rules` | missing | keep hand/mock path or create backend issue |
| `/api/whales/watch/search` | `/whale-tracking/traders/{address}/discover-tags` is not search | keep hand/mock path or create backend issue |

## Quantify-only Placeholders

`/api/strategies/**`, `/api/live-strategies/**`, `/api/backtests/**`, `/api/account/**`, `/api/ai/sessions/**` are not in backend swagger. They likely belong to `apps/quantify`; this Dart package does not cover them.

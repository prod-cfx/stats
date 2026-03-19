#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PROVIDER="${1:-}"
MARKET="${2:-perp}"
NO_OPEN="${NO_OPEN:-0}"
PORT="${PORT:-3010}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/acceptance/quantify-provider-quick-accept.sh <binance|okx|hyperliquid> [spot|perp]

Optional env:
  NO_OPEN=1   # 仅打印链接，不自动打开浏览器
  PORT=3010   # Quantify 服务端口
EOF
}

if [ -z "$PROVIDER" ]; then
  usage
  exit 1
fi

PROVIDER="$(printf '%s' "$PROVIDER" | tr '[:upper:]' '[:lower:]')"
MARKET="$(printf '%s' "$MARKET" | tr '[:upper:]' '[:lower:]')"

case "$MARKET" in
  spot|perp) ;;
  *)
    echo "unsupported market: $MARKET (use spot|perp)" >&2
    usage
    exit 1
    ;;
esac

SYMBOL=""
BARS_PROVIDER=""
case "$PROVIDER" in
  binance)
    if [ "$MARKET" = "spot" ]; then
      SYMBOL="BTCUSDT:SPOT"
    else
      SYMBOL="BTCUSDT:PERP"
    fi
    BARS_PROVIDER="BINANCE"
    ;;
  okx)
    if [ "$MARKET" = "spot" ]; then
      SYMBOL="BTCUSDT:SPOT"
    else
      SYMBOL="BTCUSDT:PERP"
    fi
    BARS_PROVIDER="OKX"
    ;;
  hyperliquid)
    if [ "$MARKET" = "spot" ]; then
      SYMBOL="BTCUSDC:SPOT"
    else
      SYMBOL="BTCUSDC:PERP"
    fi
    BARS_PROVIDER="HYPERLIQUID"
    ;;
  *)
    echo "unsupported provider: $PROVIDER" >&2
    usage
    exit 1
    ;;
esac

if [ ! -f ".env.development" ]; then
  echo "missing .env.development" >&2
  exit 1
fi

if [ ! -f ".env.development.local" ]; then
  echo "missing .env.development.local" >&2
  exit 1
fi

echo "[accept] provider=$PROVIDER restart quantify..."
pnpm exec dotenv --override -e .env.development -e .env.development.local -- \
  bash -lc "export MARKET_DATA_PROVIDER=$PROVIDER; bash scripts/acceptance/quantify-market-data-runtime.sh restart >/dev/null"

QUOTE_URL="http://localhost:${PORT}/api/v1/market/quote?symbol=${SYMBOL}"
BARS_URL="http://localhost:${PORT}/api/v1/market/bars?symbol=${SYMBOL}&timeframe=1h&limit=10&provider=${BARS_PROVIDER}"

echo "[accept] provider=$PROVIDER"
echo "[accept] quote: $QUOTE_URL"
echo "[accept] bars : $BARS_URL"

if [ "$NO_OPEN" = "1" ]; then
  exit 0
fi

if command -v open >/dev/null 2>&1; then
  open "$QUOTE_URL"
  open "$BARS_URL"
else
  echo "command 'open' not found; please open links manually." >&2
fi

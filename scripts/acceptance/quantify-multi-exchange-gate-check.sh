#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/acceptance/quantify-acceptance-common.sh

STATE_DIR="${STATE_DIR:-tmp/quantify-min-acceptance}"
PORT="${PORT:-3010}"
OUT_FILE="${OUT_FILE:-$STATE_DIR/gate2-multi-exchange-summary.json}"
MAX_RETRY="${MAX_RETRY:-3}"

require_command bash
require_command curl
require_command psql
require_command python3

mkdir -p "$STATE_DIR"

export STATE_DIR
export PORT

# API endpoints verified by this gate:
# - /api/v1/market/quote
# - /api/v1/market/bars

normalize_symbol_code() {
  local symbol="$1"
  local upper
  upper="$(printf '%s' "$symbol" | tr '[:lower:]' '[:upper:]')"
  if [[ "$upper" == *:* ]]; then
    printf '%s' "$upper"
  else
    printf '%s:SPOT' "$upper"
  fi
}

check_provider_once() {
  local provider="$1"
  local symbol="$2"
  local t0="$3"
  local symbol_code
  symbol_code="$(normalize_symbol_code "$symbol")"

  local quote_file="$STATE_DIR/${provider}-quote.json"
  local bars_file="$STATE_DIR/${provider}-bars.json"
  local quote_tsv="$STATE_DIR/${provider}-db-quote.tsv"
  local bar_tsv="$STATE_DIR/${provider}-db-bar.tsv"

  curl -fsS "http://localhost:${PORT}/api/v1/market/quote?symbol=${symbol_code}" > "$quote_file"
  curl -fsS "http://localhost:${PORT}/api/v1/market/bars?symbol=${symbol_code}&timeframe=1h&limit=10" > "$bars_file"

  python3 - "$quote_file" "$bars_file" <<'PY'
import json
import sys

quote_path, bars_path = sys.argv[1:]
with open(quote_path, 'r', encoding='utf-8') as fh:
    quote = json.load(fh)
with open(bars_path, 'r', encoding='utf-8') as fh:
    bars = json.load(fh)

q = quote.get('data', quote)
b = bars.get('data', bars)

if not isinstance(q, dict) or not q.get('lastPrice'):
    raise SystemExit(1)
if not isinstance(b, list) or len(b) == 0:
    raise SystemExit(1)
PY

  psql -At -F $'\t' "$QUANTIFY_DATABASE_URL" -c "
select q.event_time, q.created_at, q.last_price, coalesce(q.source, '')
from market_quotes q
join market_symbols s on s.id=q.symbol_id
where s.code = '${symbol_code}'
  and (
    q.event_time >= ('${t0}'::timestamptz at time zone 'utc')
    or q.created_at >= ('${t0}'::timestamptz at time zone 'utc')
  )
  and upper(coalesce(q.source, '')) like upper('${provider}') || '%'
order by q.event_time desc
limit 1
" > "$quote_tsv"

  psql -At -F $'\t' "$QUANTIFY_DATABASE_URL" -c "
select b.time, b.created_at, b.updated_at, b.close, coalesce(b.source, '')
from market_bars b
join market_symbols s on s.id=b.symbol_id
where s.code = '${symbol_code}'
  and b.timeframe = '1h'
  and (
    b.created_at >= ('${t0}'::timestamptz at time zone 'utc')
    or b.updated_at >= ('${t0}'::timestamptz at time zone 'utc')
  )
  and upper(coalesce(b.source, '')) like upper('${provider}') || '%'
order by b.created_at desc
limit 1
" > "$bar_tsv"

  [ -s "$quote_tsv" ]
  [ -s "$bar_tsv" ]
}

check_provider() {
  local provider="$1"
  local symbol="$2"

  echo "[gate2] checking provider=${provider} symbol=${symbol}" >&2
  export MARKET_DATA_PROVIDER="$provider"
  bash scripts/acceptance/quantify-market-data-runtime.sh restart >/dev/null

  local t0
  t0="$(cat "$STATE_DIR/t0.txt")"

  local ok=0
  local error_code=""
  local error_message=""

  for attempt in $(seq 1 "$MAX_RETRY"); do
    if check_provider_once "$provider" "$symbol" "$t0"; then
      ok=1
      break
    fi
    error_code="EXCHANGE_DATA_NOT_READY"
    error_message="provider=${provider} symbol=${symbol} attempt=${attempt}"
    sleep "$attempt"
  done

  if [ "$ok" -eq 1 ]; then
    echo "[gate2] PASS provider=${provider} symbol=${symbol}" >&2
    python3 - "$provider" "$symbol" <<'PY'
import json
import sys
provider, symbol = sys.argv[1:]
print(json.dumps({
  "status": "PASS",
  "provider": provider,
  "symbol": symbol,
}, ensure_ascii=False))
PY
  else
    echo "[gate2] FAIL provider=${provider} symbol=${symbol} code=${error_code}" >&2
    python3 - "$provider" "$symbol" "$error_code" "$error_message" <<'PY'
import json
import sys
provider, symbol, code, message = sys.argv[1:]
print(json.dumps({
  "status": "FAIL",
  "provider": provider,
  "symbol": symbol,
  "error": {"code": code, "message": message},
}, ensure_ascii=False))
PY
  fi
}

BINANCE_RESULT="$(check_provider "binance" "$ACCEPT_SYMBOL_BINANCE")"
OKX_RESULT="$(check_provider "okx" "$ACCEPT_SYMBOL_OKX")"
HYPERLIQUID_RESULT="$(check_provider "hyperliquid" "$ACCEPT_SYMBOL_HYPERLIQUID")"

python3 - "$OUT_FILE" "$BINANCE_RESULT" "$OKX_RESULT" "$HYPERLIQUID_RESULT" <<'PY'
import json
import sys

out_file = sys.argv[1]
results = [json.loads(item) for item in sys.argv[2:]]
status = "PASS" if all(r.get("status") == "PASS" for r in results) else "FAIL"

payload = {
  "status": status,
  "gate": "gate2-multi-exchange",
  "results": results,
}

with open(out_file, 'w', encoding='utf-8') as fh:
  json.dump(payload, fh, ensure_ascii=False)

print(json.dumps(payload, ensure_ascii=False))
PY

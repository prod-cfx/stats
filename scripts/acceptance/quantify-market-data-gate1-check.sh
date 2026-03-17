#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATE_DIR="${STATE_DIR:-tmp/quantify-market-data-review}"
PORT="${PORT:-3010}"
SYMBOL="${1:-BTCUSDT}"
OUT_FILE="${OUT_FILE:-$STATE_DIR/gate1-check-summary.json}"
TMP_DIR="${TMP_DIR:-$STATE_DIR/tmp}"
mkdir -p "$STATE_DIR" "$TMP_DIR"

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing command: $cmd" >&2
    exit 1
  }
}

require_command psql
require_command curl
require_command rg
require_command python3

json_eval() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json
import sys

file_path = sys.argv[1]
expr = sys.argv[2]

with open(file_path, 'r', encoding='utf-8') as fh:
    payload = json.load(fh)

data = payload.get('data', payload)

def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)

if expr == 'notexist_code':
    error = payload.get('error') or {}
    if error.get('code') != 'MARKET_SYMBOL_NOT_FOUND':
        fail('unexpected missing symbol error code')
elif expr in ('invalid_limit', 'invalid_timeframe'):
    status = payload.get('status')
    error = payload.get('error') or {}
    if not (status == 400 or error.get('code') == 'BAD_REQUEST'):
        fail('unexpected bad request payload')
elif expr == 'bars_limit':
    if not isinstance(data, list) or len(data) > 10:
        fail('bars payload exceeds requested limit')
elif expr == 'bars_sorted':
    if not isinstance(data, list):
        fail('bars payload is not a list')
    times = [item['time'] for item in data]
    if times != sorted(times):
        fail('bars are not sorted ascending by time')
elif expr == 'quote_last_price':
    print(data['lastPrice'])
elif expr == 'quote_source':
    print(data.get('source') or '')
elif expr == 'bar_time':
    print(data[-1]['time'])
elif expr == 'bar_open':
    print(data[-1]['open'])
elif expr == 'bar_high':
    print(data[-1]['high'])
elif expr == 'bar_low':
    print(data[-1]['low'])
elif expr == 'bar_close':
    print(data[-1]['close'])
elif expr == 'bar_source':
    print(data[-1].get('source') or '')
else:
    fail(f'unsupported expr: {expr}')
PY
}

assert_decimal_equal() {
  local left="$1"
  local right="$2"
  python3 - "$left" "$right" <<'PY'
from decimal import Decimal
import sys

left = Decimal(sys.argv[1])
right = Decimal(sys.argv[2])
if left != right:
    raise SystemExit(1)
PY
}

assert_timestamp_equal() {
  local left="$1"
  local right="$2"
  python3 - "$left" "$right" <<'PY'
from datetime import datetime, timezone
import sys

def parse(value: str) -> datetime:
    normalized = value.strip().replace(' ', 'T')
    if normalized.endswith('Z'):
        return datetime.fromisoformat(normalized.replace('Z', '+00:00'))
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

left = parse(sys.argv[1])
right = parse(sys.argv[2])
if left != right:
    raise SystemExit(1)
PY
}

T0="$(cat "$STATE_DIR/t0.txt")"
T0_UTC_EXPR="('${T0}'::timestamptz at time zone 'utc')"

psql -At "$QUANTIFY_DATABASE_URL" -c "select code from market_symbols where code='${SYMBOL}'" > "$TMP_DIR/symbol.txt"
[ -s "$TMP_DIR/symbol.txt" ]

psql -At -F $'\t' "$QUANTIFY_DATABASE_URL" -c "
select q.event_time, q.created_at, q.last_price, coalesce(q.source, '')
from market_quotes q
join market_symbols s on s.id=q.symbol_id
where s.code='${SYMBOL}' and (q.event_time >= ${T0_UTC_EXPR} or q.created_at >= ${T0_UTC_EXPR})
order by q.event_time desc
limit 1
" > "$TMP_DIR/latest-quote.tsv"
[ -s "$TMP_DIR/latest-quote.tsv" ]

psql -At -F $'\t' "$QUANTIFY_DATABASE_URL" -c "
select b.time, b.created_at, b.updated_at, b.open, b.high, b.low, b.close, coalesce(b.source, '')
from market_bars b
join market_symbols s on s.id=b.symbol_id
where s.code='${SYMBOL}'
  and b.timeframe = '1h'
  and (b.created_at >= ${T0_UTC_EXPR} or b.updated_at >= ${T0_UTC_EXPR})
order by b.created_at desc
limit 1
" > "$TMP_DIR/latest-bar.tsv"
[ -s "$TMP_DIR/latest-bar.tsv" ]

curl -fsS "http://localhost:${PORT}/api/v1/market/quote?symbol=${SYMBOL}" > "$TMP_DIR/quote.json"
curl -fsS "http://localhost:${PORT}/api/v1/market/bars?symbol=${SYMBOL}&timeframe=1h&limit=10" > "$TMP_DIR/bars.json"
INVALID_LIMIT_CODE="$(curl -sS -o "$TMP_DIR/invalid-limit.json" -w "%{http_code}" \
  "http://localhost:${PORT}/api/v1/market/bars?symbol=${SYMBOL}&timeframe=1h&limit=abc")"
INVALID_TIMEFRAME_CODE="$(curl -sS -o "$TMP_DIR/invalid-timeframe.json" -w "%{http_code}" \
  "http://localhost:${PORT}/api/v1/market/bars?symbol=${SYMBOL}&timeframe=abc&limit=10")"
NOTEXIST_CODE="$(curl -sS -o "$TMP_DIR/notexist.json" -w "%{http_code}" \
  "http://localhost:${PORT}/api/v1/market/quote?symbol=NOTEXIST")"

[ "$INVALID_LIMIT_CODE" = "400" ]
[ "$INVALID_TIMEFRAME_CODE" = "400" ]
[ "$NOTEXIST_CODE" = "400" ]

json_eval "$TMP_DIR/notexist.json" notexist_code >/dev/null
json_eval "$TMP_DIR/invalid-limit.json" invalid_limit >/dev/null
json_eval "$TMP_DIR/invalid-timeframe.json" invalid_timeframe >/dev/null
json_eval "$TMP_DIR/bars.json" bars_limit >/dev/null
json_eval "$TMP_DIR/bars.json" bars_sorted >/dev/null

QUOTE_PRICE_HTTP="$(json_eval "$TMP_DIR/quote.json" quote_last_price)"
QUOTE_SOURCE_HTTP="$(json_eval "$TMP_DIR/quote.json" quote_source)"
BAR_TIME_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_time)"
BAR_OPEN_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_open)"
BAR_HIGH_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_high)"
BAR_LOW_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_low)"
BAR_CLOSE_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_close)"
BAR_SOURCE_HTTP="$(json_eval "$TMP_DIR/bars.json" bar_source)"

IFS=$'\t' read -r QUOTE_EVENT_TIME_DB QUOTE_CREATED_AT_DB QUOTE_PRICE_DB QUOTE_SOURCE_DB < "$TMP_DIR/latest-quote.tsv"
IFS=$'\t' read -r BAR_TIME_DB BAR_CREATED_AT_DB BAR_UPDATED_AT_DB BAR_OPEN_DB BAR_HIGH_DB BAR_LOW_DB BAR_CLOSE_DB BAR_SOURCE_DB < "$TMP_DIR/latest-bar.tsv"

[ "$QUOTE_SOURCE_HTTP" = "$QUOTE_SOURCE_DB" ]
assert_decimal_equal "$QUOTE_PRICE_HTTP" "$QUOTE_PRICE_DB"
[ "$BAR_SOURCE_HTTP" = "$BAR_SOURCE_DB" ]
assert_timestamp_equal "$BAR_TIME_HTTP" "$BAR_TIME_DB"
assert_decimal_equal "$BAR_OPEN_HTTP" "$BAR_OPEN_DB"
assert_decimal_equal "$BAR_HIGH_HTTP" "$BAR_HIGH_DB"
assert_decimal_equal "$BAR_LOW_HTTP" "$BAR_LOW_DB"
assert_decimal_equal "$BAR_CLOSE_HTTP" "$BAR_CLOSE_DB"

python3 - "$OUT_FILE" "$T0" "$SYMBOL" "$QUOTE_SOURCE_HTTP" "$QUOTE_EVENT_TIME_DB" "$QUOTE_CREATED_AT_DB" "$BAR_SOURCE_HTTP" "$BAR_TIME_HTTP" "$BAR_CREATED_AT_DB" "$BAR_UPDATED_AT_DB" <<'PY'
import json
import sys

out_file, t0, symbol, quote_source, quote_event_time, quote_created_at, bar_source, bar_time, bar_created_at, bar_updated_at = sys.argv[1:]

payload = {
    "status": "PASS",
    "t0": t0,
    "symbol": symbol,
    "quoteSource": quote_source,
    "quoteEventTime": quote_event_time,
    "quoteCreatedAt": quote_created_at,
    "barSource": bar_source,
    "barTime": bar_time,
    "barCreatedAt": bar_created_at,
    "barUpdatedAt": bar_updated_at,
    "quotePriceMatched": True,
    "latestBarMatched": True,
    "invalidLimitIs400": True,
    "invalidTimeframeIs400": True,
    "missingSymbolIs400": True,
}

with open(out_file, 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, ensure_ascii=False)
PY

cat "$OUT_FILE"

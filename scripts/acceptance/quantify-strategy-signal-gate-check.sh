#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/acceptance/quantify-acceptance-common.sh

STATE_DIR="${STATE_DIR:-tmp/quantify-min-acceptance}"
PORT="${PORT:-3010}"
OUT_FILE="${OUT_FILE:-$STATE_DIR/gate3-strategy-signal-summary.json}"
MAX_POLL="${MAX_POLL:-20}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-3}"

require_command curl
require_command psql
require_command python3
require_command rg

require_env ACCEPT_STRATEGY_INSTANCE_ID
require_env QUANTIFY_DATABASE_URL

# Verify trading_signal generation via strategy_signals table.

mkdir -p "$STATE_DIR"

TRIGGER_T0="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RESP_FILE="$STATE_DIR/gate3-trigger-response.json"

HTTP_CODE="$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X POST \
  "http://localhost:${PORT}/api/v1/ops/strategy-instances/${ACCEPT_STRATEGY_INSTANCE_ID}/generate-signal")"

if [ "$HTTP_CODE" != "200" ]; then
  payload="$(json_fail "gate3-strategy-signal" "TRIGGER_API_FAILED" "http_code=${HTTP_CODE}")"
  write_json "$OUT_FILE" "$payload"
  cat "$OUT_FILE"
  exit 1
fi

FOUND=0
for _ in $(seq 1 "$MAX_POLL"); do
  if psql -At "$QUANTIFY_DATABASE_URL" -c "
select 1
from strategy_signals
where strategy_instance_id = '${ACCEPT_STRATEGY_INSTANCE_ID}'
  and created_at >= ('${TRIGGER_T0}'::timestamptz at time zone 'utc')
limit 1
" | rg -q '^1$'; then
    FOUND=1
    break
  fi
  sleep "$POLL_INTERVAL_SEC"
done

if [ "$FOUND" != "1" ]; then
  payload="$(json_fail "gate3-strategy-signal" "SIGNAL_NOT_CREATED" "instance_id=${ACCEPT_STRATEGY_INSTANCE_ID}")"
  write_json "$OUT_FILE" "$payload"
  cat "$OUT_FILE"
  exit 1
fi

ROW_TSV="$STATE_DIR/gate3-signal-row.tsv"
psql -At -F $'\t' "$QUANTIFY_DATABASE_URL" -c "
select id, coalesce(strategy_id, ''), symbol_id, direction::text, status::text, created_at
from strategy_signals
where strategy_instance_id = '${ACCEPT_STRATEGY_INSTANCE_ID}'
  and created_at >= ('${TRIGGER_T0}'::timestamptz at time zone 'utc')
order by created_at desc
limit 1
" > "$ROW_TSV"

IFS=$'\t' read -r SIGNAL_ID STRATEGY_ID SYMBOL_ID DIRECTION STATUS CREATED_AT < "$ROW_TSV"

python3 - "$OUT_FILE" "$SIGNAL_ID" "$STRATEGY_ID" "$SYMBOL_ID" "$DIRECTION" "$STATUS" "$CREATED_AT" "$ACCEPT_STRATEGY_INSTANCE_ID" <<'PY'
import json
import sys

out_file, signal_id, strategy_id, symbol_id, direction, status, created_at, instance_id = sys.argv[1:]

if not signal_id or not symbol_id or not direction or not status:
    payload = {
        "status": "FAIL",
        "gate": "gate3-strategy-signal",
        "error": {
            "code": "SIGNAL_FIELDS_INVALID",
            "message": "missing required signal fields",
        },
    }
else:
    payload = {
        "status": "PASS",
        "gate": "gate3-strategy-signal",
        "strategyInstanceId": instance_id,
        "signal": {
            "id": signal_id,
            "strategyId": strategy_id,
            "symbolId": symbol_id,
            "direction": direction,
            "status": status,
            "createdAt": created_at,
        },
    }

with open(out_file, 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, ensure_ascii=False)

print(json.dumps(payload, ensure_ascii=False))

if payload.get("status") != "PASS":
    raise SystemExit(1)
PY

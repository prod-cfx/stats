#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/acceptance/quantify-acceptance-common.sh

STATE_DIR="${STATE_DIR:-tmp/quantify-min-acceptance}"
PORT="${PORT:-3010}"
KEEP_RUNTIME="${KEEP_RUNTIME:-0}"
SUMMARY_FILE="${SUMMARY_FILE:-$STATE_DIR/acceptance-summary.json}"

mkdir -p "$STATE_DIR"

run_gate() {
  local gate_name="$1"
  shift
  if "$@"; then
    return 0
  fi
  echo "gate failed: $gate_name" >&2
  return 1
}

cleanup() {
  if [ "$KEEP_RUNTIME" = "1" ]; then
    return
  fi
  bash scripts/acceptance/quantify-market-data-runtime.sh stop >/dev/null || true
}
trap cleanup EXIT

export STATE_DIR
export PORT

# Gate0: preflight
export MARKET_DATA_PROVIDER="${MARKET_DATA_PROVIDER:-binance}"
run_gate gate0-preflight bash scripts/acceptance/quantify-market-data-preflight.sh

# Gate1: runtime bootstrap
run_gate gate1-runtime bash scripts/acceptance/quantify-market-data-runtime.sh start

# Gate2: three exchanges data checks
GATE2_FILE="$STATE_DIR/gate2-multi-exchange-summary.json"
run_gate gate2-multi-exchange bash scripts/acceptance/quantify-multi-exchange-gate-check.sh

# Restore runtime provider for signal generation
export MARKET_DATA_PROVIDER="${SIGNAL_PROVIDER:-binance}"
run_gate gate1b-runtime-restart bash scripts/acceptance/quantify-market-data-runtime.sh restart

# Gate3: strategy signal generation
GATE3_FILE="$STATE_DIR/gate3-strategy-signal-summary.json"
run_gate gate3-strategy-signal bash scripts/acceptance/quantify-strategy-signal-gate-check.sh

python3 - "$SUMMARY_FILE" "$GATE2_FILE" "$GATE3_FILE" <<'PY'
import json
import os
import sys

summary_file, gate2_file, gate3_file = sys.argv[1:]

def load(path: str):
    with open(path, 'r', encoding='utf-8') as fh:
        return json.load(fh)

gate2 = load(gate2_file)
gate3 = load(gate3_file)
status = 'PASS' if gate2.get('status') == 'PASS' and gate3.get('status') == 'PASS' else 'FAIL'

payload = {
    'status': status,
    'gate': 'final',
    'summary': {
        'gate2': gate2,
        'gate3': gate3,
    },
    'acceptance-summary.json': os.path.basename(summary_file),
}

with open(summary_file, 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, ensure_ascii=False)

print(json.dumps(payload, ensure_ascii=False))

if status != 'PASS':
    raise SystemExit(1)
PY

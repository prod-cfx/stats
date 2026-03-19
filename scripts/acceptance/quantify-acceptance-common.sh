#!/usr/bin/env bash
set -euo pipefail

# Required acceptance inputs (documented for contract tests and callers)
: "${ACCEPT_SYMBOL_BINANCE:=BTCUSDT}"
: "${ACCEPT_SYMBOL_OKX:=BTCUSDT}"
: "${ACCEPT_SYMBOL_HYPERLIQUID:=BTCUSDC}"
: "${ACCEPT_STRATEGY_INSTANCE_ID:=}"

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing command: $cmd" >&2
    exit 1
  }
}

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "missing env: $key" >&2
    exit 1
  fi
}

json_fail() {
  local gate="$1"
  local code="$2"
  local message="$3"
  python3 - "$gate" "$code" "$message" <<'PY'
import json
import sys

gate, code, message = sys.argv[1:]
print(json.dumps({
    "status": "FAIL",
    "gate": gate,
    "error": {"code": code, "message": message},
}, ensure_ascii=False))
PY
}

json_pass() {
  local gate="$1"
  python3 - "$gate" <<'PY'
import json
import sys

gate = sys.argv[1]
print(json.dumps({
    "status": "PASS",
    "gate": gate,
}, ensure_ascii=False))
PY
}

write_json() {
  local out_file="$1"
  local payload="$2"
  mkdir -p "$(dirname "$out_file")"
  printf '%s\n' "$payload" > "$out_file"
}

read_json_field() {
  local file="$1"
  local path="$2"
  python3 - "$file" "$path" <<'PY'
import json
import sys

file_path, path = sys.argv[1:]
with open(file_path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)

node = data
for key in path.split('.'):
    if isinstance(node, dict):
        node = node.get(key)
    else:
        node = None
        break

if node is None:
    print("")
else:
    print(node)
PY
}

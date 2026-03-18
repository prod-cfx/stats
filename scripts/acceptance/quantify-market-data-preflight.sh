#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "BLOCKED: missing command: $cmd" >&2
    exit 2
  fi
}

require_command dx
require_command curl
require_command redis-cli
require_command openssl

resolve_timeout_command() {
  if command -v timeout >/dev/null 2>&1; then
    echo "timeout"
    return
  fi
  if command -v gtimeout >/dev/null 2>&1; then
    echo "gtimeout"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi

  echo "BLOCKED: missing timeout command and python3 fallback" >&2
  exit 2
}

TIMEOUT_CMD="$(resolve_timeout_command)"

run_with_timeout() {
  local seconds="$1"
  shift

  if [ "$TIMEOUT_CMD" = "timeout" ] || [ "$TIMEOUT_CMD" = "gtimeout" ]; then
    "$TIMEOUT_CMD" "$seconds" "$@"
    return
  fi

  python3 - "$seconds" "$@" <<'PY'
import subprocess
import sys

timeout_seconds = float(sys.argv[1])
cmd = sys.argv[2:]

try:
    completed = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout_seconds)
except subprocess.TimeoutExpired:
    sys.exit(124)

sys.exit(completed.returncode)
PY
}

redis_ping() {
  local redis_url="$1"
  python3 - "$redis_url" <<'PY'
import sys
import os
from urllib.parse import urlparse

url = sys.argv[1]
parsed = urlparse(url)

if parsed.scheme not in ("redis", "rediss"):
    print("BLOCKED: QUANTIFY_REDIS_URL must use redis/rediss scheme", file=sys.stderr)
    sys.exit(2)

host = parsed.hostname or "localhost"
port = parsed.port or 6379
db = (parsed.path or "/0").lstrip("/") or "0"
password = parsed.password or ""

cmd = ["redis-cli", "-h", host, "-p", str(port), "-n", db]
if parsed.scheme == "rediss":
    cmd.append("--tls")
cmd.append("PING")

import subprocess
env = None
if password:
    env = dict(os.environ, REDISCLI_AUTH=password)

completed = subprocess.run(
    cmd,
    stdin=subprocess.DEVNULL,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    env=env,
)
sys.exit(completed.returncode)
PY
}

test -n "${QUANTIFY_DATABASE_URL:-}" || { echo "BLOCKED: missing QUANTIFY_DATABASE_URL" >&2; exit 2; }
test -n "${QUANTIFY_REDIS_URL:-}" || { echo "BLOCKED: missing QUANTIFY_REDIS_URL" >&2; exit 2; }

PROVIDER="${MARKET_DATA_PROVIDER:-binance}"
if [ "$PROVIDER" != "binance" ]; then
  echo "BLOCKED: MARKET_DATA_PROVIDER must be binance, got: $PROVIDER" >&2
  exit 2
fi

REST_URL="${MARKET_DATA_API_BASE_URL:-https://api.binance.com}"
WS_URL="${MARKET_DATA_WS_URL:-wss://stream.binance.com:9443}"
if printf '%s\n%s\n' "$REST_URL" "$WS_URL" | rg -qi 'testnet'; then
  echo "BLOCKED: testnet endpoints are not allowed for local review" >&2
  exit 2
fi

echo "check: cwd=$(pwd)"
echo "check: QUANTIFY_DATABASE_URL=set"
echo "check: QUANTIFY_REDIS_URL=set"
echo "check: MARKET_DATA_PROVIDER=$PROVIDER"
echo "check: MARKET_DATA_API_BASE_URL=$REST_URL"
echo "check: MARKET_DATA_WS_URL=$WS_URL"

redis_ping "$QUANTIFY_REDIS_URL"
curl -fsS "${REST_URL%/}/api/v3/ping" >/dev/null

WS_HOST="$(printf '%s' "$WS_URL" | sed -E 's#^wss?://([^/:]+).*#\1#')"
WS_PORT="$(printf '%s' "$WS_URL" | sed -nE 's#^wss?://[^/:]+:([0-9]+).*$#\1#p')"
WS_PORT="${WS_PORT:-443}"
run_with_timeout 5 openssl s_client -connect "${WS_HOST}:${WS_PORT}" -servername "$WS_HOST"

echo "check: ws tcp/tls endpoint reachable"
echo "READY"

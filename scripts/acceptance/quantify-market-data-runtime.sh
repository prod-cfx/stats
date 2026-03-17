#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-status}"
STATE_DIR="${STATE_DIR:-tmp/quantify-market-data-review}"
PORT="${PORT:-3010}"
PID_FILE="$STATE_DIR/quantify.pid"
T0_FILE="$STATE_DIR/t0.txt"
LOG_FILE="$STATE_DIR/quantify-runtime.log"

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing command: $cmd" >&2
    exit 1
  }
}

require_command dx
require_command lsof

server_pid() {
  lsof -ti "tcp:${PORT}" | head -n 1 || true
}

is_running() {
  local pid="${1:-}"
  [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1
}

start_runtime() {
  mkdir -p "$STATE_DIR"
  : > "$LOG_FILE"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$T0_FILE"

  local existing_pid
  existing_pid="$(server_pid)"
  if [ -n "$existing_pid" ]; then
    echo "port ${PORT} already in use by pid ${existing_pid}" >&2
    exit 1
  fi

  nohup dx start quantify --dev >"$LOG_FILE" 2>&1 &

  local bound_pid=""
  for _ in $(seq 1 60); do
    bound_pid="$(server_pid)"
    if [ -n "$bound_pid" ]; then
      echo "$bound_pid" > "$PID_FILE"
      break
    fi
    sleep 2
  done

  [ -s "$PID_FILE" ] || {
    echo "FAILED: quantify did not bind port ${PORT}" >&2
    exit 1
  }

  for _ in $(seq 1 60); do
    if grep -q '行情模块初始化完成' "$LOG_FILE"; then
      break
    fi
    sleep 2
  done

  grep -q '行情模块初始化完成' "$LOG_FILE" || {
    echo "FAILED: quantify did not finish market-data initialization" >&2
    exit 1
  }

  echo "STARTED pid=$(cat "$PID_FILE") t0=$(cat "$T0_FILE") port=$PORT"
}

stop_runtime() {
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    pid="$(server_pid)"
  fi

  if [ -n "$pid" ] && is_running "$pid"; then
    kill "$pid" || true
  fi

  for _ in $(seq 1 30); do
    if [ -z "$(server_pid)" ]; then
      rm -f "$PID_FILE"
      echo "STOPPED"
      return
    fi
    sleep 1
  done

  echo "FAILED: port ${PORT} still busy after stop" >&2
  exit 1
}

status_runtime() {
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  local listener_pid
  listener_pid="$(server_pid)"
  if [ -n "$listener_pid" ] && is_running "$listener_pid"; then
    echo "RUNNING pid=${listener_pid} t0=$(cat "$T0_FILE" 2>/dev/null || echo unset) log=$LOG_FILE"
    return
  fi
  echo "STOPPED pid=${pid:-unset} port=$PORT"
}

case "$ACTION" in
  start) start_runtime ;;
  stop) stop_runtime ;;
  status) status_runtime ;;
  restart)
    stop_runtime || true
    start_runtime
    ;;
  *)
    echo "usage: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

host="${AWS_SSH_HOST:-${HOST:-}}"
port="${AWS_SSH_PORT:-${PORT:-}}"
max_attempts="${SSH_KEYSCAN_MAX_ATTEMPTS:-5}"
sleep_seconds="${SSH_KEYSCAN_RETRY_SLEEP_SECONDS:-3}"

if [[ -z "$host" ]]; then
  echo "[ERROR] AWS_SSH_HOST or HOST is required" >&2
  exit 64
fi

if [[ -z "$port" ]]; then
  echo "[ERROR] AWS_SSH_PORT or PORT is required" >&2
  exit 64
fi

if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] SSH_KEYSCAN_MAX_ATTEMPTS must be a positive integer" >&2
  exit 64
fi

if ! [[ "$sleep_seconds" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] SSH_KEYSCAN_RETRY_SLEEP_SECONDS must be a non-negative integer" >&2
  exit 64
fi

mkdir -p ~/.ssh

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  if ssh-keyscan -T 10 -p "$port" -H "$host" >> ~/.ssh/known_hosts; then
    echo "[INFO] ssh known_hosts preheated on attempt ${attempt}/${max_attempts}"
    exit 0
  fi

  if ((attempt < max_attempts)); then
    echo "[WARN] ssh-keyscan failed on attempt ${attempt}/${max_attempts}; retrying in ${sleep_seconds}s" >&2
    sleep "$sleep_seconds"
  fi
done

echo "[ERROR] ssh-keyscan failed after ${max_attempts} attempts" >&2
exit 1

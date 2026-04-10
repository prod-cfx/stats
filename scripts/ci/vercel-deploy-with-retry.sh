#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?usage: vercel-deploy-with-retry.sh <front|admin> <--staging|--prod>}"
DEPLOY_FLAG="${2:?usage: vercel-deploy-with-retry.sh <front|admin> <--staging|--prod>}"
DX_VERSION="${DX_VERSION:?DX_VERSION is required}"
MAX_ATTEMPTS="${VERCEL_DEPLOY_MAX_ATTEMPTS:-3}"
BACKOFF_SECONDS="${VERCEL_DEPLOY_RETRY_BACKOFF_SECONDS:-15}"

if ! [[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] || (( MAX_ATTEMPTS < 1 )); then
  echo "VERCEL_DEPLOY_MAX_ATTEMPTS must be a positive integer" >&2
  exit 64
fi

if ! [[ "$BACKOFF_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "VERCEL_DEPLOY_RETRY_BACKOFF_SECONDS must be a non-negative integer" >&2
  exit 64
fi

log_file="$(mktemp)"
cleanup() {
  rm -f "$log_file"
}
trap cleanup EXIT

run_deploy_once() {
  if [[ -n "${VERCEL_DEPLOY_TEST_COMMAND:-}" ]]; then
    bash -lc "$VERCEL_DEPLOY_TEST_COMMAND"
    return
  fi

  npx -y "@ranger1/dx@${DX_VERSION}" deploy "$TARGET" "$DEPLOY_FLAG" -Y
}

is_retryable_failure() {
  local file="$1"

  grep -Fq 'Error: Unexpected error. Please try again later.' "$file"
}

attempt=1
while (( attempt <= MAX_ATTEMPTS )); do
  echo "[vercel-deploy-retry] target=${TARGET} attempt=${attempt}/${MAX_ATTEMPTS}"
  : > "$log_file"

  set +e
  run_deploy_once 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e

  if (( status == 0 )); then
    echo "[vercel-deploy-retry] target=${TARGET} succeeded on attempt ${attempt}/${MAX_ATTEMPTS}"
    exit 0
  fi

  if (( attempt == MAX_ATTEMPTS )); then
    echo "[vercel-deploy-retry] target=${TARGET} failed after ${MAX_ATTEMPTS} attempts" >&2
    exit "$status"
  fi

  if ! is_retryable_failure "$log_file"; then
    echo "[vercel-deploy-retry] target=${TARGET} failed with a non-retryable error; stopping after attempt ${attempt}/${MAX_ATTEMPTS}" >&2
    exit "$status"
  fi

  sleep_seconds=$(( BACKOFF_SECONDS * attempt ))
  echo "[vercel-deploy-retry] target=${TARGET} hit a retryable Vercel platform error; sleeping ${sleep_seconds}s before retry"
  sleep "$sleep_seconds"
  attempt=$(( attempt + 1 ))
done

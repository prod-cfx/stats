#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?usage: vercel-deploy-with-retry.sh <front|admin> <--staging|--prod>}"
DEPLOY_FLAG="${2:?usage: vercel-deploy-with-retry.sh <front|admin> <--staging|--prod>}"
DX_VERSION="${DX_VERSION:?DX_VERSION is required}"
VERCEL_TOKEN="${VERCEL_TOKEN:-}"
MAX_ATTEMPTS="${VERCEL_DEPLOY_MAX_ATTEMPTS:-3}"
BACKOFF_SECONDS="${VERCEL_DEPLOY_RETRY_BACKOFF_SECONDS:-15}"

case "$TARGET" in
  front)
    VERCEL_CONFIG="vercel.front.json"
    VERCEL_PROJECT_ID_KEY="VERCEL_PROJECT_ID_FRONT"
    ;;
  admin)
    VERCEL_CONFIG="vercel.admin.json"
    VERCEL_PROJECT_ID_KEY="VERCEL_PROJECT_ID_ADMIN"
    ;;
  *)
    echo "unsupported Vercel deploy target: $TARGET" >&2
    exit 64
    ;;
esac

case "$DEPLOY_FLAG" in
  --staging)
    # Staging projects use fixed custom domains attached to Vercel production deployments.
    # Keep preview env vars for staging config, but publish the deployment to the alias.
    VERCEL_PROD_ARG="--prod"
    VERCEL_PULL_ENV="preview"
    VERCEL_ENV_FILE=".env.staging"
    ;;
  --prod)
    VERCEL_PROD_ARG="--prod"
    VERCEL_PULL_ENV="production"
    VERCEL_ENV_FILE=".env.production"
    ;;
  *)
    echo "unsupported Vercel deploy flag: $DEPLOY_FLAG" >&2
    exit 64
    ;;
esac

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "VERCEL_TOKEN is required" >&2
  exit 64
fi

if ! [[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] || (( MAX_ATTEMPTS < 1 )); then
  echo "VERCEL_DEPLOY_MAX_ATTEMPTS must be a positive integer" >&2
  exit 64
fi

if ! [[ "$BACKOFF_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "VERCEL_DEPLOY_RETRY_BACKOFF_SECONDS must be a non-negative integer" >&2
  exit 64
fi

read_env_value() {
  local key="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  awk -F= -v key="$key" '$1 == key { print substr($0, length(key) + 2); exit }' "$file"
}

VERCEL_ORG_ID="${VERCEL_ORG_ID:-$(read_env_value VERCEL_ORG_ID "$VERCEL_ENV_FILE")}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-$(read_env_value "$VERCEL_PROJECT_ID_KEY" "$VERCEL_ENV_FILE")}"

if [[ -z "$VERCEL_ORG_ID" ]]; then
  echo "VERCEL_ORG_ID is required" >&2
  exit 64
fi

if [[ -z "$VERCEL_PROJECT_ID" ]]; then
  echo "$VERCEL_PROJECT_ID_KEY is required" >&2
  exit 64
fi

export VERCEL_ORG_ID
export VERCEL_PROJECT_ID

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

  local pull_cmd=(vercel pull --yes --environment "$VERCEL_PULL_ENV" --token "$VERCEL_TOKEN")
  local build_cmd=(vercel build --token "$VERCEL_TOKEN")
  local deploy_cmd=(vercel deploy --prebuilt --yes --token "$VERCEL_TOKEN")

  if [[ -n "$VERCEL_PROD_ARG" ]]; then
    build_cmd+=("$VERCEL_PROD_ARG")
    deploy_cmd+=("$VERCEL_PROD_ARG")
  fi

  build_cmd+=(--local-config "$VERCEL_CONFIG")
  deploy_cmd+=(--local-config "$VERCEL_CONFIG")

  if [[ "${VERCEL_DEPLOY_DRY_RUN:-}" == "1" ]]; then
    printf '+'
    printf ' %q' "${pull_cmd[@]}"
    printf '\n'
    printf '+'
    printf ' %q' "${build_cmd[@]}"
    printf '\n'
    printf '+'
    printf ' %q' "${deploy_cmd[@]}"
    printf '\n'
    return
  fi

  "${pull_cmd[@]}"
  "${build_cmd[@]}"
  "${deploy_cmd[@]}"
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

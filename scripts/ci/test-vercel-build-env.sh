#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"

case "$TARGET" in
  all | front | admin)
    ;;
  *)
    echo "Usage: test-vercel-build-env.sh [all|front|admin]" >&2
    exit 64
    ;;
esac

assert_output() {
  local expected="$1"
  shift

  local output
  output="$("$@")"

  if [[ "$output" != "$expected" ]]; then
    echo "Unexpected output for: $*" >&2
    echo "Expected:" >&2
    printf '%s\n' "$expected" >&2
    echo "Actual:" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

assert_failure() {
  local stdout_file
  local stderr_file
  stdout_file="$(mktemp)"
  stderr_file="$(mktemp)"
  trap 'rm -f "$stdout_file" "$stderr_file"' RETURN

  set +e
  "$@" >"$stdout_file" 2>"$stderr_file"
  local status=$?
  set -e

  if (( status == 0 )); then
    echo "Expected failure for: $*" >&2
    exit 1
  fi
}

if [[ "$TARGET" == "all" || "$TARGET" == "front" ]]; then
  assert_output \
    "pnpm exec dx build front --staging" \
    env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

  env \
    APP_ENV=staging \
    NEXT_PUBLIC_APP_ENV=staging \
    NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
    node apps/front/scripts/check-env.js >/dev/null

  assert_output \
    "pnpm exec dx build front --prod" \
    env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

  assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh
fi

if [[ "$TARGET" == "all" || "$TARGET" == "admin" ]]; then
  assert_output \
    $'APP_ENV=staging pnpm exec dx build shared\nAPP_ENV=staging pnpm exec dx build admin --staging' \
    env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

  assert_output \
    $'APP_ENV=production pnpm exec dx build shared\nAPP_ENV=production pnpm exec dx build admin --prod' \
    env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

  assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh
fi

echo "Vercel build env smoke tests passed"

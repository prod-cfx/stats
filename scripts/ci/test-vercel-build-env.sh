#!/usr/bin/env bash
set -euo pipefail

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
  set +e
  "$@" >/tmp/vercel-build-env-test.out 2>/tmp/vercel-build-env-test.err
  local status=$?
  set -e

  rm -f /tmp/vercel-build-env-test.out /tmp/vercel-build-env-test.err

  if (( status == 0 )); then
    echo "Expected failure for: $*" >&2
    exit 1
  fi
}

assert_output \
  "pnpm exec dx build front --staging" \
  env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

assert_output \
  "pnpm exec dx build front --prod" \
  env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

assert_output \
  $'APP_ENV=staging pnpm exec dx build shared\nAPP_ENV=staging pnpm exec dx build admin --staging' \
  env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

assert_output \
  $'APP_ENV=production pnpm exec dx build shared\nAPP_ENV=production pnpm exec dx build admin --prod' \
  env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh
assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

echo "Vercel build env smoke tests passed"

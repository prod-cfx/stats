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
  "npx -y @ranger1/dx@0.1.97 build front --staging" \
  env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

assert_output \
  "npx -y @ranger1/dx@0.1.97 build front --prod" \
  env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh

assert_output \
  $'APP_ENV=staging npx -y @ranger1/dx@0.1.97 build shared\nAPP_ENV=staging npx -y @ranger1/dx@0.1.97 build admin --staging' \
  env APP_ENV=staging VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

assert_output \
  $'APP_ENV=production npx -y @ranger1/dx@0.1.97 build shared\nAPP_ENV=production npx -y @ranger1/dx@0.1.97 build admin --prod' \
  env APP_ENV=production VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-front.sh
assert_failure env -u APP_ENV VERCEL_BUILD_DRY_RUN=1 bash scripts/ci/vercel-build-admin.sh

echo "Vercel build env smoke tests passed"

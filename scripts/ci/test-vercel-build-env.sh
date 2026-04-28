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

run_build_command() {
  local config_file="$1"
  local project_dir="$2"
  local command
  command="$(node -e "process.stdout.write(require('./${config_file}').buildCommand)")"
  (cd "$project_dir" && bash -lc "$command")
}

run_build_command_with_app_env() {
  local app_env="$1"
  local config_file="$2"
  local project_dir="$3"

  APP_ENV="$app_env" VERCEL_BUILD_DRY_RUN=1 run_build_command "$config_file" "$project_dir"
}

run_build_command_without_app_env() {
  local config_file="$1"
  local project_dir="$2"

  unset APP_ENV
  VERCEL_BUILD_DRY_RUN=1 run_build_command "$config_file" "$project_dir"
}

if [[ "$TARGET" == "all" || "$TARGET" == "front" ]]; then
  assert_output \
    "pnpm exec dx build front --staging" \
    run_build_command_with_app_env staging vercel.front.json apps/front

  env \
    APP_ENV=staging \
    NEXT_PUBLIC_APP_ENV=staging \
    NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
    node apps/front/scripts/check-env.js >/dev/null

  assert_output \
    "pnpm exec dx build front --prod" \
    run_build_command_with_app_env production vercel.front.json apps/front

  assert_failure run_build_command_without_app_env vercel.front.json apps/front
  assert_failure run_build_command_with_app_env prod vercel.front.json apps/front
  assert_failure run_build_command_with_app_env development vercel.front.json apps/front
fi

if [[ "$TARGET" == "all" || "$TARGET" == "admin" ]]; then
  assert_output \
    $'APP_ENV=staging pnpm exec dx build shared\nAPP_ENV=staging pnpm exec dx build admin --staging' \
    run_build_command_with_app_env staging vercel.admin.json apps/admin-front

  assert_output \
    $'APP_ENV=production pnpm exec dx build shared\nAPP_ENV=production pnpm exec dx build admin --prod' \
    run_build_command_with_app_env production vercel.admin.json apps/admin-front

  assert_failure run_build_command_without_app_env vercel.admin.json apps/admin-front
  assert_failure run_build_command_with_app_env prod vercel.admin.json apps/admin-front
  assert_failure run_build_command_with_app_env development vercel.admin.json apps/admin-front
fi

echo "Vercel build env smoke tests passed"

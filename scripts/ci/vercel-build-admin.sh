#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${APP_ENV:?APP_ENV is required}"

case "$APP_ENV" in
  production)
    APP_ENV_FOR_BUILD="production"
    DX_ENV_FLAG="--prod"
    ;;
  staging)
    APP_ENV_FOR_BUILD="staging"
    DX_ENV_FLAG="--staging"
    ;;
  *)
    echo "Unsupported APP_ENV for admin Vercel build: $APP_ENV" >&2
    exit 64
    ;;
esac

run_dx() {
  if [[ "${VERCEL_BUILD_DRY_RUN:-}" == "1" ]]; then
    printf 'APP_ENV=%s pnpm exec dx %s\n' "$APP_ENV_FOR_BUILD" "$*"
    return
  fi

  APP_ENV="$APP_ENV_FOR_BUILD" pnpm exec dx "$@"
}

run_dx build shared
run_dx build admin "$DX_ENV_FLAG"

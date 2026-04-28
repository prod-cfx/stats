#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${APP_ENV:?APP_ENV is required}"
DX_VERSION="${DX_VERSION:-0.1.97}"

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
    printf 'APP_ENV=%s npx -y @ranger1/dx@%s %s\n' "$APP_ENV_FOR_BUILD" "$DX_VERSION" "$*"
    return
  fi

  APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" "$@"
}

run_dx build shared
run_dx build admin "$DX_ENV_FLAG"

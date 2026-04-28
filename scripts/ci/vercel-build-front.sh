#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${APP_ENV:?APP_ENV is required}"

case "$APP_ENV" in
  production)
    DX_ENV_FLAG="--prod"
    ;;
  staging)
    DX_ENV_FLAG="--staging"
    ;;
  *)
    echo "Unsupported APP_ENV for front Vercel build: $APP_ENV" >&2
    exit 64
    ;;
esac

if [[ "${VERCEL_BUILD_DRY_RUN:-}" == "1" ]]; then
  printf 'pnpm exec dx build front %s\n' "$DX_ENV_FLAG"
  exit 0
fi

pnpm exec dx build front "$DX_ENV_FLAG"

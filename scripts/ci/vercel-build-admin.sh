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

APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" build shared
APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" build admin "$DX_ENV_FLAG"

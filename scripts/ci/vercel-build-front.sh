#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${APP_ENV:?APP_ENV is required}"
DX_VERSION="${DX_VERSION:-0.1.97}"

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

npx -y "@ranger1/dx@${DX_VERSION}" build front "$DX_ENV_FLAG"

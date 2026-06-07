#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"
OPENAPI_FILE="$PROJECT_DIR/openapi/openapi.json"
BACKEND_OPENAPI_FILE="$REPO_ROOT/dist/openapi/backend.json"
OUTPUT_DIR="$PROJECT_DIR"

if [[ "${1:-}" == "--skip-export" ]]; then
  echo "skip backend swagger export"
else
  echo "export backend swagger"
  cd "$REPO_ROOT"
  npx nx run backend:swagger
  mkdir -p "$PROJECT_DIR/openapi"
  cp "$BACKEND_OPENAPI_FILE" "$OPENAPI_FILE"
fi

if [ ! -f "$OPENAPI_FILE" ]; then
  echo "missing $OPENAPI_FILE"
  exit 1
fi

rm -rf "$OUTPUT_DIR/lib" "$OUTPUT_DIR/test" "$OUTPUT_DIR/doc" "$OUTPUT_DIR/.openapi-generator"

cd "$PROJECT_DIR"
npx --yes @openapitools/openapi-generator-cli generate \
  -i "$OPENAPI_FILE" \
  -g dart-dio \
  -o "$OUTPUT_DIR" \
  --skip-validate-spec \
  --additional-properties=pubName=backend_api_contracts,pubVersion=0.0.1,nullableFields=true,useEnumExtension=true

node "$SCRIPT_DIR/patch-generated-dart.mjs"

if command -v dart >/dev/null 2>&1; then
  dart pub get
  dart run build_runner build --delete-conflicting-outputs
  # 只分析交付产物 lib/（generated test/ 缺 package:test dev_dependency，非交付物）。
  # dart-dio 生成代码自带 1270+ 条 style info（use_super_parameters 等），纯生成器噪声；
  # dart 3.12 的 dart analyze 只要有 info 就 exit 3，--no-fatal-warnings 也无法放行 info。
  # 因此用 --format=machine 解析 severity（机器格式不着色、不本地化，按 `|` 分列稳定），
  # 仅 ERROR 阻断；INFO/WARNING 噪声放行，且显式打印放行/阻断日志，避免 gate 假阴/假阳。
  analyze_log="$(mktemp)"
  set +e
  dart analyze --format=machine lib >"$analyze_log" 2>&1
  set -e
  error_count="$(grep -c '^ERROR|' "$analyze_log" || true)"
  warning_count="$(grep -c '^WARNING|' "$analyze_log" || true)"
  info_count="$(grep -c '^INFO|' "$analyze_log" || true)"
  echo "dart analyze: ERROR=${error_count} WARNING=${warning_count} INFO=${info_count}（INFO/WARNING 为生成器噪声，放行；仅 ERROR 阻断）"
  if [ "$error_count" -gt 0 ]; then
    echo "dart analyze gate FAILED: 检测到 ${error_count} 个 ERROR 级问题，阻断构建" >&2
    grep '^ERROR|' "$analyze_log" >&2
    rm -f "$analyze_log"
    exit 1
  fi
  rm -f "$analyze_log"
  echo "dart analyze gate PASSED: 0 ERROR（INFO/WARNING 噪声已放行）"
else
  echo "dart command not found; run manually: cd packages/api-contracts-dart && dart pub get && dart run build_runner build --delete-conflicting-outputs && dart analyze"
fi

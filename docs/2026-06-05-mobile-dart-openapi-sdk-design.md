# Mobile Dart OpenAPI SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable Dart OpenAPI SDK pipeline for `apps/quantify-mobile`, generated from stats backend swagger, then pilot one mobile repository through the generated client.

**Architecture:** `dist/openapi/backend.json` remains the single backend contract source. `packages/api-contracts` keeps generating TypeScript contracts, while new `packages/api-contracts-dart` generates `dart-dio` + `built_value` code as package `backend_api_contracts`; mobile consumes it by path dependency and shares current Dio auth/error behavior. Reference project is `/home/ubuntu/ranger_work/ai-monorepo`, especially `/home/ubuntu/ranger_work/ai-monorepo/packages/api-contracts-dart`.

**Tech Stack:** Nx 19, `dx`, NestJS Swagger, `@openapitools/openapi-generator-cli -g dart-dio`, Dart SDK `^3.11.5`, Dio `^5.7.0`, built_value, Flutter Riverpod.

---

## Decision Check

**[核心判断]**
值得做：mobile 当前有手写 Dio + 手写 model + 占位 path，真实 backend swagger 已存在，生成 SDK 能减少契约漂移。

**[关键洞察]**

- 数据结构：OpenAPI source is `dist/openapi/backend.json`; generated Dart package owns only generated client/model code.
- 复杂度：do not change backend; first prove generator, path audit, provider, one read-only pilot.
- 风险点：OpenAPI generator needs Java at generation time; CI may need `setup-java`.

**[行动计划]**
Scaffold package -> add generator -> register `dx build contracts-dart` -> generate/analyze -> write path audit -> wire mobile provider -> pilot ticker -> verify.

## File Structure

- Create: `packages/api-contracts-dart/package.json` — local generator script and dev dependency.
- Create: `packages/api-contracts-dart/project.json` — Nx project metadata.
- Create: `packages/api-contracts-dart/pubspec.yaml` — Dart package `backend_api_contracts`.
- Create: `packages/api-contracts-dart/analysis_options.yaml` — Dart analyzer settings.
- Create: `packages/api-contracts-dart/.openapi-generator-ignore` — protect handwritten files.
- Create: `packages/api-contracts-dart/.gitignore` — ignore generator/cache files.
- Create: `packages/api-contracts-dart/README.md` — generation and usage notes.
- Create: `packages/api-contracts-dart/scripts/generate.sh` — export/copy swagger, generate Dart, run build_runner.
- Create: `packages/api-contracts-dart/scripts/patch-generated-dart.mjs` — post-process generated Dart for missing `JsonObject` import and Dio re-export.
- Create by command: `packages/api-contracts-dart/openapi/openapi.json` — copied backend swagger.
- Create by command: `packages/api-contracts-dart/lib/**` — generated SDK.
- Modify: `dx/config/commands.json` — add `build.contracts-dart`.
- Create: `docs/mobile-openapi-path-audit.md` — mobile placeholder path vs real swagger path.
- Modify: `apps/quantify-mobile/pubspec.yaml` — add path dependency.
- Modify: `apps/quantify-mobile/lib/data/services/api_client.dart` — expose reusable Dio construction.
- Create: `apps/quantify-mobile/lib/data/services/generated_backend_api.dart` — generated SDK wrapper.
- Modify: `apps/quantify-mobile/lib/data/providers/service_providers.dart` — add generated SDK provider.
- Modify: `apps/quantify-mobile/lib/data/api/api_ticker_repository.dart` — pilot ticker through generated `MarketsApi`.
- Create: `apps/quantify-mobile/test/data/generated_backend_api_test.dart` — auth/error behavior tests.
- Create: `apps/quantify-mobile/test/data/api_ticker_repository_generated_test.dart` — generated ticker mapping tests.

## Task 1: Scaffold Dart Contracts Package

**Files:**
- Create: `packages/api-contracts-dart/package.json`
- Create: `packages/api-contracts-dart/project.json`
- Create: `packages/api-contracts-dart/pubspec.yaml`
- Create: `packages/api-contracts-dart/analysis_options.yaml`
- Create: `packages/api-contracts-dart/.openapi-generator-ignore`
- Create: `packages/api-contracts-dart/.gitignore`
- Create: `packages/api-contracts-dart/README.md`

- [ ] **Step 1: Create package files**

Use these exact file contents.

`packages/api-contracts-dart/package.json`:

```json
{
  "name": "@ai/backend-api-contracts-dart",
  "version": "0.0.0",
  "private": true,
  "scripts": { "generate": "./scripts/generate.sh" },
  "devDependencies": { "@openapitools/openapi-generator-cli": "^2.13.4" }
}
```

`packages/api-contracts-dart/project.json`:

```json
{
  "name": "api-contracts-dart",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/api-contracts-dart/lib",
  "projectType": "library",
  "tags": ["scope:contracts", "type:lib"],
  "targets": {
    "generate": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/lib", "{projectRoot}/openapi/openapi.json"],
      "options": { "command": "cd packages/api-contracts-dart && pnpm generate" }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/lib", "{projectRoot}/openapi/openapi.json"],
      "inputs": [
        "{projectRoot}/scripts/**/*",
        "{projectRoot}/pubspec.yaml",
        "{projectRoot}/.openapi-generator-ignore",
        "{workspaceRoot}/apps/backend/src/**/*",
        "{workspaceRoot}/apps/backend/prisma/schema/**/*"
      ],
      "options": { "command": "cd packages/api-contracts-dart && pnpm generate" }
    }
  }
}
```

`packages/api-contracts-dart/pubspec.yaml`:

```yaml
name: backend_api_contracts
description: Stats backend OpenAPI Dart client generated by openapi-generator dart-dio.
version: 0.0.1
publish_to: 'none'

environment:
  sdk: ^3.11.5

dependencies:
  dio: ^5.7.0
  built_value: ^8.9.2
  built_collection: ^5.1.1
  one_of: ^1.5.0
  one_of_serializer: ^1.5.0

dev_dependencies:
  lints: ^5.1.1
  build_runner: ^2.4.13
  built_value_generator: ^8.9.2
```

`packages/api-contracts-dart/analysis_options.yaml`:

```yaml
include: package:lints/recommended.yaml

analyzer:
  exclude:
    - lib/**/*.g.dart
```

`packages/api-contracts-dart/.openapi-generator-ignore`:

```gitignore
README.md
pubspec.yaml
.gitignore
analysis_options.yaml
package.json
project.json
scripts/**
```

`packages/api-contracts-dart/.gitignore`:

```gitignore
test/
doc/
.openapi-generator/
openapitools.json
node_modules/
.dart_tool/
.packages
pubspec.lock
build/
*.dart-e
```

`packages/api-contracts-dart/README.md`:

```markdown
# backend_api_contracts

Stats backend OpenAPI Dart client for `apps/quantify-mobile`.

Reference implementation: `/home/ubuntu/ranger_work/ai-monorepo/packages/api-contracts-dart`.

## Generate

```bash
dx build contracts-dart
```

Skip swagger export when `packages/api-contracts-dart/openapi/openapi.json` already exists:

```bash
packages/api-contracts-dart/scripts/generate.sh --skip-export
```

## Requirements

- Node and pnpm from repo baseline
- Java 11+ for `@openapitools/openapi-generator-cli`
- Dart SDK `^3.11.5`

## Mobile dependency

```yaml
backend_api_contracts:
  path: ../../packages/api-contracts-dart
```

Generated files under `lib/` are not hand edited.
```

- [ ] **Step 2: Verify scaffold exists**

Run:

```bash
test -f packages/api-contracts-dart/package.json
test -f packages/api-contracts-dart/pubspec.yaml
test -f packages/api-contracts-dart/.openapi-generator-ignore
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit**

Run:

```bash
git add packages/api-contracts-dart
git commit -F - <<'MSG'
feat: scaffold Dart backend contracts package

Refs: #2189
MSG
```

Expected: commit created on an issue branch.

## Task 2: Add Generator Script

**Files:**
- Create: `packages/api-contracts-dart/scripts/generate.sh`
- Create: `packages/api-contracts-dart/scripts/patch-generated-dart.mjs`

- [ ] **Step 1: Create post-processing script**

Create `packages/api-contracts-dart/scripts/patch-generated-dart.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const libRoot = path.join(projectRoot, 'lib')
const jsonObjectImport = "import 'package:built_value/json_object.dart';"

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && entry.name.endsWith('.dart') ? [full] : []
  })
}

for (const file of walk(libRoot)) {
  const src = fs.readFileSync(file, 'utf8')
  if (!/\bJsonObject\b/.test(src) || src.includes(jsonObjectImport)) continue
  const lines = src.split('\n')
  const builtValueImport = lines.findIndex((line) => line.startsWith("import 'package:built_value/"))
  const firstImport = lines.findIndex((line) => line.startsWith('import '))
  const insertAt = builtValueImport >= 0 ? builtValueImport : firstImport >= 0 ? firstImport : 0
  lines.splice(insertAt, 0, jsonObjectImport)
  fs.writeFileSync(file, lines.join('\n'))
}

const barrel = path.join(libRoot, 'backend_api_contracts.dart')
const dioExport = "export 'package:dio/dio.dart' show Dio, Response, DioException, BaseOptions, Interceptor, InterceptorsWrapper, RequestOptions, CancelToken;"
if (fs.existsSync(barrel)) {
  const src = fs.readFileSync(barrel, 'utf8')
  if (!src.includes(dioExport)) fs.appendFileSync(barrel, `\n// dio type re-export for mobile consumers.\n${dioExport}\n`)
}
```

- [ ] **Step 2: Create generator script**

Create `packages/api-contracts-dart/scripts/generate.sh`:

```bash
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
  --additional-properties=pubName=backend_api_contracts,pubVersion=0.0.1,nullableFields=true,useEnumExtension=true

node "$SCRIPT_DIR/patch-generated-dart.mjs"

if command -v dart >/dev/null 2>&1; then
  dart pub get
  dart run build_runner build --delete-conflicting-outputs
  dart analyze
else
  echo "dart command not found; run manually: cd packages/api-contracts-dart && dart pub get && dart run build_runner build --delete-conflicting-outputs && dart analyze"
fi
```

- [ ] **Step 3: Make script executable**

Run:

```bash
chmod +x packages/api-contracts-dart/scripts/generate.sh
ls -l packages/api-contracts-dart/scripts/generate.sh
```

Expected: mode includes `x`.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/api-contracts-dart/scripts/generate.sh packages/api-contracts-dart/scripts/patch-generated-dart.mjs
git commit -F - <<'MSG'
feat: add Dart contracts generator

Refs: #2189
MSG
```

Expected: commit created.

## Task 3: Register DX Command And Generate SDK

**Files:**
- Modify: `dx/config/commands.json`
- Create by command: `packages/api-contracts-dart/openapi/openapi.json`
- Create by command: `packages/api-contracts-dart/lib/**`

- [ ] **Step 1: Verify command absent before edit**

Run:

```bash
dx build contracts-dart --dev
```

Expected before edit: command fails because `contracts-dart` is unknown.

- [ ] **Step 2: Add command**

In `dx/config/commands.json`, add this sibling next to existing `build.contracts`:

```json
"contracts-dart": {
  "command": "bash -lc 'set -euo pipefail; packages/api-contracts-dart/scripts/generate.sh'",
  "app": "backend",
  "description": "生成 Dart API 合约 (packages/api-contracts-dart)"
}
```

Keep valid JSON commas around the new object.

- [ ] **Step 3: Generate SDK**

Run:

```bash
dx build contracts-dart --dev
```

Expected:

```text
export backend swagger
Successfully generated code
```

If Java is missing, install Java 11+ in local/CI and rerun. Do not remove generator step.

- [ ] **Step 4: Verify generated output**

Run:

```bash
test -f packages/api-contracts-dart/openapi/openapi.json
test -f packages/api-contracts-dart/lib/backend_api_contracts.dart
rg -n "class MarketsApi|marketsControllerGetTicker|TickerResponseDto" packages/api-contracts-dart/lib
```

Expected: all commands exit `0`; `rg` prints generated API/model references.

- [ ] **Step 5: Commit**

Run:

```bash
git add dx/config/commands.json packages/api-contracts-dart/openapi packages/api-contracts-dart/lib
git commit -F - <<'MSG'
feat: generate Dart backend contracts

Refs: #2189
MSG
```

Expected: commit created.

## Task 4: Write Mobile Path Audit

**Files:**
- Create: `docs/mobile-openapi-path-audit.md`

- [ ] **Step 1: Generate raw path lists**

Run:

```bash
rg -n "['\"]/(api/)?[A-Za-z0-9_{}?&=./:-]+" apps/quantify-mobile/lib/data/services -g '*.dart'
jq -r '.paths | keys[]' packages/api-contracts-dart/openapi/openapi.json
```

Expected: first command lists mobile placeholder paths; second command lists real swagger paths with no global `/api` prefix.

- [ ] **Step 2: Create audit document**

Create `docs/mobile-openapi-path-audit.md`:

```markdown
# Mobile OpenAPI Path Audit

Reference swagger: `packages/api-contracts-dart/openapi/openapi.json` generated from `dist/openapi/backend.json`.
Reference repo: `/home/ubuntu/ranger_work/ai-monorepo`.

## Auth

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/auth/login` | `/auth/login` | change mobile path or generated `AuthApi` call |
| `/api/auth/login-code` | `/auth/send-verification-code` | change mobile path or generated `AuthApi` call |
| `/api/auth/login-code/verify` | `/auth/verify-email` or `/auth/password-reset/verify` depending flow | split by flow in auth migration |
| `/api/auth/logout` | missing | remove mobile call or add backend endpoint in a separate backend issue |
| `/api/auth/me` | `/users/me` | use generated `UsersApi` |

## Market Pilot

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/markets/tickers` | `/markets/ticker` | pilot uses generated `MarketsApi.marketsControllerGetTicker`; list behavior remains one request per configured symbol until backend list endpoint exists |
| `/api/markets/tickers/{symbol}` | `/markets/ticker?symbol={symbol}` | pilot uses generated `MarketsApi.marketsControllerGetTicker` |
| `/api/markets/klines` | `/kline` | migrate after ticker pilot |
| `/api/markets/orderbook` | `/orderbook/aggregated` | migrate after ticker pilot |
| `/api/markets/long-short/ratio` | `/markets/long-short-ratio` | migrate after ticker pilot |
| `/api/markets/long-short/snapshot` | missing exact match; `/markets/long-short-ratio/exchanges` exists | keep hand layer until product mapping is confirmed |

## Whale

| Mobile placeholder path | Real swagger path | Action |
|---|---|---|
| `/api/whales/feed` | `/whale-alerts/realtime` or `/whale-alerts/trades` | choose per UI feed semantics before migration |
| `/api/whales/leaderboard` | `/whale-tracking/discover` | migrate after market domain |
| `/api/whales/holdings` | `/whale-holdings` | migrate after market domain |
| `/api/whales/profiles/{address}` | `/whale-tracking/traders/{address}/snapshot` | migrate after profile UI contract review |
| `/api/whales/watch/rules` | missing | keep hand/mock path or create backend issue |
| `/api/whales/watch/search` | `/whale-tracking/traders/{address}/discover-tags` is not search | keep hand/mock path or create backend issue |

## Quantify-only Placeholders

`/api/strategies/**`, `/api/live-strategies/**`, `/api/backtests/**`, `/api/account/**`, `/api/ai/sessions/**` are not in backend swagger. They likely belong to `apps/quantify`; this Dart package does not cover them.
```

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/mobile-openapi-path-audit.md
git commit -F - <<'MSG'
docs: add mobile OpenAPI path audit

Refs: #2189
MSG
```

Expected: commit created.

## Task 5: Add Mobile Generated API Provider

**Files:**
- Modify: `apps/quantify-mobile/pubspec.yaml`
- Modify: `apps/quantify-mobile/lib/data/services/api_client.dart`
- Create: `apps/quantify-mobile/lib/data/services/generated_backend_api.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/service_providers.dart`
- Create: `apps/quantify-mobile/test/data/generated_backend_api_test.dart`

- [ ] **Step 1: Write failing test for shared Dio behavior**

Create `apps/quantify-mobile/test/data/generated_backend_api_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

void main() {
  test('GeneratedBackendApi uses provided Dio baseUrl', () {
    final Dio dio = buildApiDio(baseUrl: 'https://api.example.test');
    final GeneratedBackendApi api = GeneratedBackendApi(dio: dio);

    expect(api.dio.options.baseUrl, 'https://api.example.test');
  });

  test('buildApiDio injects bearer token from latest supplier value', () async {
    String token = 'first-token';
    final Dio dio = buildApiDio(
      baseUrl: 'https://api.example.test',
      tokenSupplier: () => token,
    );
    final RequestOptions options = RequestOptions(path: '/x');

    await dio.interceptors.first.onRequest(
      options,
      RequestInterceptorHandler(),
    );

    expect(options.headers['Authorization'], 'Bearer first-token');
  });
}
```

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/generated_backend_api_test.dart
```

Expected before implementation: compile failure because `GeneratedBackendApi` and `buildApiDio` do not exist.

- [ ] **Step 2: Add path dependency**

Modify `apps/quantify-mobile/pubspec.yaml` dependencies:

```yaml
  backend_api_contracts:
    path: ../../packages/api-contracts-dart
```

- [ ] **Step 3: Refactor `ApiClient` to expose Dio builder**

In `apps/quantify-mobile/lib/data/services/api_client.dart`, add this top-level function above `class ApiClient`, then make `ApiClient` call it when `dio == null`:

```dart
Dio buildApiDio({
  required String baseUrl,
  String Function()? tokenSupplier,
  Duration connectTimeout = const Duration(seconds: 10),
  Duration receiveTimeout = const Duration(seconds: 30),
}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: connectTimeout,
      receiveTimeout: receiveTimeout,
      headers: <String, dynamic>{'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(buildApiInterceptor(tokenSupplier: tokenSupplier));
  return dio;
}

InterceptorsWrapper buildApiInterceptor({String Function()? tokenSupplier}) {
  return InterceptorsWrapper(
    onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
      final String token = tokenSupplier?.call() ?? '';
      if (token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (DioException e, ErrorInterceptorHandler handler) {
      handler.reject(
        DioException(
          requestOptions: e.requestOptions,
          error: ApiException.fromDio(e),
          type: e.type,
          response: e.response,
        ),
      );
    },
  );
}
```

Constructor assignment becomes:

```dart
  }) : _dio = dio ??
            buildApiDio(
              baseUrl: baseUrl,
              tokenSupplier: tokenSupplier,
              connectTimeout: connectTimeout,
              receiveTimeout: receiveTimeout,
            );
```

- [ ] **Step 4: Add generated SDK wrapper**

Create `apps/quantify-mobile/lib/data/services/generated_backend_api.dart`:

```dart
import 'package:backend_api_contracts/backend_api_contracts.dart';

class GeneratedBackendApi {
  GeneratedBackendApi({required Dio dio})
      : dio = dio,
        client = BackendApiContracts(dio: dio);

  final Dio dio;
  final BackendApiContracts client;
}
```

- [ ] **Step 5: Register provider**

Modify `apps/quantify-mobile/lib/data/providers/service_providers.dart`:

```dart
import '../services/generated_backend_api.dart';
```

Add after `apiClientProvider`:

```dart
final Provider<GeneratedBackendApi> generatedBackendApiProvider =
    Provider<GeneratedBackendApi>((Ref ref) {
  return GeneratedBackendApi(dio: ref.watch(apiClientProvider).raw);
});
```

- [ ] **Step 6: Run test**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/generated_backend_api_test.dart
```

Expected: tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/quantify-mobile/pubspec.yaml apps/quantify-mobile/pubspec.lock apps/quantify-mobile/lib/data/services/api_client.dart apps/quantify-mobile/lib/data/services/generated_backend_api.dart apps/quantify-mobile/lib/data/providers/service_providers.dart apps/quantify-mobile/test/data/generated_backend_api_test.dart
git commit -F - <<'MSG'
feat: wire generated backend API into mobile

Refs: #2189
MSG
```

Expected: commit created.

## Task 6: Pilot Ticker Repository Through Generated SDK

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_ticker_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Create: `apps/quantify-mobile/test/data/api_ticker_repository_generated_test.dart`

- [ ] **Step 1: Confirm generated names**

Run:

```bash
rg -n "class MarketsApi|marketsControllerGetTicker|class TickerResponseDto" packages/api-contracts-dart/lib
```

Expected: generated `MarketsApi`, `marketsControllerGetTicker`, and `TickerResponseDto` exist. If method name differs, use the generated method printed by this command in this task.

- [ ] **Step 2: Write failing repository test**

Create `apps/quantify-mobile/test/data/api_ticker_repository_generated_test.dart` with a fake generated API adapter only if generated `MarketsApi` cannot be instantiated with a mock Dio response. Preferred test after generated SDK exists:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';

void main() {
  test('generated ticker fields map to mobile Ticker fields', () {
    final Ticker ticker = Ticker.fromBackendFields(
      symbol: 'BTC',
      currentPrice: '87010.5',
      priceChangePercent24h: '-0.45',
      volumeUsd: '1234567890.12',
    );

    expect(ticker.symbol, 'BTC');
    expect(ticker.price, 87010.5);
    expect(ticker.changePercent, -0.45);
    expect(ticker.volume24h, 1234567890.12);
  });
}
```

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_ticker_repository_generated_test.dart
```

Expected before implementation: compile failure because `Ticker.fromBackendFields` does not exist.

- [ ] **Step 3: Add mapper to existing mobile model**

Modify `apps/quantify-mobile/lib/data/models/ticker_models.dart` inside `class Ticker`:

```dart
  factory Ticker.fromBackendFields({
    required String symbol,
    required String currentPrice,
    String? priceChangePercent24h,
    required String volumeUsd,
  }) {
    return Ticker(
      symbol: symbol,
      price: _parseDouble(currentPrice),
      changePercent: _parseDouble(priceChangePercent24h),
      volume24h: _parseDouble(volumeUsd),
    );
  }
```

Update `_parseDouble` so string numbers parse:

```dart
  static double _parseDouble(Object? raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw) ?? 0.0;
    return 0.0;
  }
```

- [ ] **Step 4: Change repository to generated SDK**

Modify `apps/quantify-mobile/lib/data/api/api_ticker_repository.dart` to use generated client:

```dart
import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import '../services/generated_backend_api.dart';

class ApiTickerRepository implements TickerRepository {
  ApiTickerRepository(this._api);

  final GeneratedBackendApi _api;

  Ticker _map(TickerResponseDto dto) {
    return Ticker.fromBackendFields(
      symbol: dto.symbol,
      currentPrice: dto.currentPrice,
      priceChangePercent24h: dto.priceChangePercent24h,
      volumeUsd: dto.volumeUsd,
    );
  }

  @override
  Future<List<Ticker>> listTickers() async {
    const List<String> symbols = <String>['BTC', 'ETH', 'SOL'];
    final List<Ticker> result = <Ticker>[];
    for (final String symbol in symbols) {
      final Response<TickerResponseDto> response =
          await _api.client.getMarketsApi().marketsControllerGetTicker(
                symbol: symbol,
              );
      final TickerResponseDto? data = response.data;
      if (data != null) result.add(_map(data));
    }
    return result;
  }

  @override
  Stream<Ticker> watchTicker(String symbol) async* {
    Future<Ticker> fetchOne() async {
      final Response<TickerResponseDto> response =
          await _api.client.getMarketsApi().marketsControllerGetTicker(
                symbol: symbol,
              );
      final TickerResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: 'empty ticker response');
      }
      return _map(data);
    }

    yield await fetchOne();
    yield* Stream<void>.periodic(const Duration(seconds: 2)).asyncMap((_) => fetchOne());
  }
}
```

- [ ] **Step 5: Update repository provider constructor**

Modify `apps/quantify-mobile/lib/data/providers/repository_providers.dart` ticker provider:

```dart
final Provider<TickerRepository> tickerRepositoryProvider =
    Provider<TickerRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockTickerRepository()
          : ApiTickerRepository(ref.watch(generatedBackendApiProvider));
    });
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_ticker_repository_generated_test.dart test/data/mock_ticker_repository_test.dart
```

Expected: tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/quantify-mobile/lib/data/models/ticker_models.dart apps/quantify-mobile/lib/data/api/api_ticker_repository.dart apps/quantify-mobile/lib/data/providers/repository_providers.dart apps/quantify-mobile/test/data/api_ticker_repository_generated_test.dart
git commit -F - <<'MSG'
feat: pilot ticker repository on generated SDK

Refs: #2189
MSG
```

Expected: commit created.

## Task 7: Verification And CI Notes

**Files:**
- Modify if CI exists: `.github/workflows/**` or current CI config file discovered with `rg --files .github dx scripts | rg 'workflow|ci|build'`

- [ ] **Step 1: Run contracts verification**

Run:

```bash
dx build contracts-dart --dev
```

Expected: command exits `0`; generated package `dart analyze` exits `0`.

- [ ] **Step 2: Run Flutter analysis**

Run:

```bash
cd apps/quantify-mobile && flutter analyze
```

Expected: no analyzer errors.

- [ ] **Step 3: Run focused Flutter tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/generated_backend_api_test.dart test/data/api_ticker_repository_generated_test.dart test/pages/market/market_home_controller_test.dart test/pages/market/market_detail_controller_test.dart
```

Expected: tests pass.

- [ ] **Step 4: Run repo checks**

Run from repo root:

```bash
dx lint
dx build affected --dev
```

Expected: both commands exit `0`.

- [ ] **Step 5: Document CI Java requirement**

If CI runs `dx build contracts-dart`, ensure workflow installs Java before generation. For GitHub Actions, add before contracts generation:

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: '17'
```

Expected: CI has Java for generator JAR; app runtime remains unaffected.

- [ ] **Step 6: Final commit if CI config changed**

Run:

```bash
git add .github dx scripts
git commit -F - <<'MSG'
ci: support Dart OpenAPI generation

Refs: #2189
MSG
```

Expected: commit created only when CI files changed.

## Self-Review

- Spec coverage: package scaffold, generator, dx command, path audit, mobile provider, ticker pilot, verification, and CI Java risk are covered.
- Placeholder scan: plan uses no `TBD`, no deferred code blocks, and only references `/home/ubuntu/ranger_work/ai-monorepo` as the comparison repo.
- Type consistency: package name is `backend_api_contracts`; wrapper type is `GeneratedBackendApi`; pilot DTO is `TickerResponseDto`; generated method is expected as `marketsControllerGetTicker` and must be confirmed by `rg` after generation.

## Execution Handoff

Plan complete and saved to `docs/2026-06-05-mobile-dart-openapi-sdk-design.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

# Mobile Aggregated Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile aggregated orderbook, open interest, and volume pages use real generated Dart backend contracts for current mobile controls and display scope.

**Architecture:** Keep `AggOrderbookRepository` as the domain boundary and make request parameters explicit with a small `AggMarketRequest` value object. Use Riverpod provider families to fetch market-specific bundles, while repository adapters own contract envelope unwrapping and DTO mapping.

**Tech Stack:** Flutter, Dart, Riverpod, Dio, `backend_api_contracts` generated SDK, Flutter widget/unit tests.

---

## File Structure

- Modify `apps/quantify-mobile/lib/data/repositories/agg_orderbook_repository.dart`: add `AggMarketRequest` and extend `getMarketData` signature.
- Modify `apps/quantify-mobile/lib/data/api/api_agg_orderbook_repository.dart`: use request parameters, generated `MarketsApi`, and adapter unwrap helpers.
- Modify `apps/quantify-mobile/lib/data/providers/repository_providers.dart`: add a provider family keyed by `AggMarketRequest`; keep existing provider as BTC/perp compatibility alias.
- Modify `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_card.dart`: pass selected coin and market type into the provider.
- Modify `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_controller.dart`: reset invalid exchange selections when venue set changes.
- Modify `apps/quantify-mobile/lib/pages/market/widgets/agg_open_interest_tab.dart`: use market-specific data provider with selected coin.
- Modify `apps/quantify-mobile/lib/pages/market/widgets/agg_volume_tab.dart`: use market-specific data provider with selected coin.
- Modify `apps/quantify-mobile/test/data/api_agg_orderbook_repository_test.dart`: cover request value, mapping, generated volume adapter, and envelope helpers.
- Modify/add widget/provider tests under `apps/quantify-mobile/test/pages/` as needed for control-driven provider inputs and empty states.

### Task 1: Repository Request Contract

**Files:**
- Modify: `apps/quantify-mobile/lib/data/repositories/agg_orderbook_repository.dart`
- Test: `apps/quantify-mobile/test/data/api_agg_orderbook_repository_test.dart`

- [ ] **Step 1: Write the failing request object tests**

Add tests to `api_agg_orderbook_repository_test.dart`:

```dart
test('AggMarketRequest normalizes base and type', () {
  const AggMarketRequest request = AggMarketRequest(base: ' btc ', type: 'PERP');

  expect(request.normalizedBase, 'BTC');
  expect(request.normalizedType, 'perp');
});

test('AggMarketRequest defaults to BTC perp', () {
  const AggMarketRequest request = AggMarketRequest.defaultMarket();

  expect(request.normalizedBase, 'BTC');
  expect(request.normalizedType, 'perp');
});
```

- [ ] **Step 2: Run request object tests and verify fail**

Run from `apps/quantify-mobile`:

```bash
flutter test test/data/api_agg_orderbook_repository_test.dart --plain-name "AggMarketRequest"
```

Expected: fail because `AggMarketRequest` does not exist.

- [ ] **Step 3: Add request object and repository signature**

Update `agg_orderbook_repository.dart`:

```dart
import '../models/agg_market_data.dart';

class AggMarketRequest {
  const AggMarketRequest({required this.base, required this.type});

  const AggMarketRequest.defaultMarket()
      : base = 'BTC',
        type = 'perp';

  final String base;
  final String type;

  String get normalizedBase => base.trim().toUpperCase();

  String get normalizedType => type.trim().toLowerCase();

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AggMarketRequest &&
          runtimeType == other.runtimeType &&
          normalizedBase == other.normalizedBase &&
          normalizedType == other.normalizedType;

  @override
  int get hashCode => Object.hash(normalizedBase, normalizedType);
}

abstract class AggOrderbookRepository {
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  });
}
```

- [ ] **Step 4: Run request object tests and verify pass**

Run:

```bash
flutter test test/data/api_agg_orderbook_repository_test.dart --plain-name "AggMarketRequest"
```

Expected: pass.

### Task 2: API Adapter Uses Generated Contracts

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_agg_orderbook_repository.dart`
- Test: `apps/quantify-mobile/test/data/api_agg_orderbook_repository_test.dart`

- [ ] **Step 1: Write failing adapter tests for generated volume and request mapping**

Add tests using a `Dio` interceptor to `api_agg_orderbook_repository_test.dart`:

```dart
test('getMarketData passes base and type into generated orderbook API', () async {
  final List<Uri> calls = <Uri>[];
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler h) {
          calls.add(options.uri);
          if (options.path == '/orderbook/aggregated') {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{'data': _dtoJson('ETH', 'spot'), 'message': 'Success'},
            ));
            return;
          }
          if (options.path.startsWith('/open-interest/aggregate/')) {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 404,
              data: <String, Object?>{'code': 'OPEN_INTEREST_NOT_FOUND'},
            ));
            return;
          }
          if (options.path.startsWith('/markets/volume/snapshot/')) {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{'symbol': 'ETH', 'total': 0, 'rows': <Object?>[]},
            ));
            return;
          }
          h.next(options);
        },
      ),
    );

  final ApiAggOrderbookRepository repo = ApiAggOrderbookRepository(
    GeneratedBackendApi(dio: dio),
  );

  final AggMarketData data = await repo.getMarketData(
    request: const AggMarketRequest(base: 'ETH', type: 'spot'),
  );

  final Uri orderbookCall = calls.singleWhere((Uri uri) => uri.path == '/orderbook/aggregated');
  expect(orderbookCall.queryParameters['base'], 'ETH');
  expect(orderbookCall.queryParameters['type'], 'spot');
  expect(data.asks, isNotEmpty);
});

test('getMarketData uses generated MarketsApi volume snapshot path', () async {
  final List<String> paths = <String>[];
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler h) {
          paths.add(options.path);
          if (options.path == '/orderbook/aggregated') {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{'data': _dtoJson('BTC', 'perp'), 'message': 'Success'},
            ));
            return;
          }
          if (options.path.startsWith('/open-interest/aggregate/')) {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 404,
              data: <String, Object?>{'code': 'OPEN_INTEREST_NOT_FOUND'},
            ));
            return;
          }
          if (options.path == '/markets/volume/snapshot/BTC') {
            h.resolve(Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{'symbol': 'BTC', 'total': 1000, 'rows': <Object?>[]},
            ));
            return;
          }
          h.next(options);
        },
      ),
    );

  final ApiAggOrderbookRepository repo = ApiAggOrderbookRepository(
    GeneratedBackendApi(dio: dio),
  );

  await repo.getMarketData(request: const AggMarketRequest.defaultMarket());

  expect(paths, contains('/markets/volume/snapshot/BTC'));
});
```

Add helper JSON in the test file:

```dart
Map<String, Object?> _dtoJson(String base, String type) => <String, Object?>{
      'marketKey': '$base-$type',
      'base': base,
      'type': type,
      'midPrice': 100,
      'updatedAt': 0,
      'asks': <Object?>[
        <String, Object?>{
          'price': 101,
          'sizeTotal': 2,
          'details': <Object?>[<String, Object?>{'venueId': 'binance', 'size': 2}],
        },
      ],
      'bids': <Object?>[
        <String, Object?>{
          'price': 99,
          'sizeTotal': 3,
          'details': <Object?>[<String, Object?>{'venueId': 'okx', 'size': 3}],
        },
      ],
      'venues': <Object?>['binance', 'okx'],
      'mergedQuotes': <Object?>[],
    };
```

- [ ] **Step 2: Run adapter tests and verify fail**

Run:

```bash
flutter test test/data/api_agg_orderbook_repository_test.dart --plain-name "getMarketData"
```

Expected: fail because repository signature and generated volume path are not wired yet.

- [ ] **Step 3: Implement adapter changes**

Update `ApiAggOrderbookRepository.getMarketData`, `_fetchOrderbook`, and `_fetchVolumeSnapshots`:

```dart
  @override
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  }) async {
    final String base = request.normalizedBase;
    final String type = request.normalizedType;
    final List<String> metricCoins = _metricCoinsFor(base);
    final (
      AggregatedOrderbookResponseDto? orderbook,
      Map<String, OiSnapshot> oiData,
      Map<String, VolSnapshot> volData,
    ) = await (
      _fetchOrderbook(base: base, type: type),
      _fetchOiSnapshots(metricCoins),
      _fetchVolumeSnapshots(metricCoins),
    ).wait;

    if (orderbook == null) {
      throw const ApiException(message: 'empty aggregated orderbook response');
    }
    return buildMarketData(orderbook, oiData: oiData, volData: volData);
  }

  Future<AggregatedOrderbookResponseDto?> _fetchOrderbook({
    required String base,
    required String type,
  }) async {
    final Response<AggregatedOrderbookControllerGetAggregatedOrderbook200Response>
    response = await _api.client
        .getOrderbookApi()
        .aggregatedOrderbookControllerGetAggregatedOrderbook(
          base_: base,
          type: type,
        );
    return response.data?.data;
  }

  Future<Map<String, VolSnapshot>> _fetchVolumeSnapshots(
    List<String> symbols,
  ) async {
    final List<(String, VolSnapshot)?> entries = await Future.wait(
      symbols.map((String symbol) async {
        try {
          final Response<AggregatedVolumeSnapshotResponseDto> response =
              await _api.client
                  .getMarketsApi()
                  .marketsControllerGetAggregatedVolumeSnapshot(symbol: symbol);
          final AggregatedVolumeSnapshotResponseDto? data = response.data;
          if (data == null) return null;
          return (symbol, mapVolSnapshot(data));
        } catch (_) {
          return null;
        }
      }),
    );
    return <String, VolSnapshot>{
      for (final e in entries)
        if (e != null) e.$1: e.$2,
    };
  }

  static List<String> _metricCoinsFor(String base) {
    final List<String> coins = <String>[base];
    for (final String coin in _defaultMetricCoins) {
      if (coin != base) coins.add(coin);
    }
    return coins;
  }
```

Remove unused direct `dio.get` decode path only if tests prove generated method handles runtime data. Keep pure `unwrapEnvelopeData` helper if still used by tests or OI.

- [ ] **Step 4: Run adapter tests and verify pass**

Run:

```bash
flutter test test/data/api_agg_orderbook_repository_test.dart
```

Expected: pass.

### Task 3: Provider Families and Orderbook UI Parameters

**Files:**
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_card.dart`
- Test: `apps/quantify-mobile/test/pages/agg_orders_body_test.dart`

- [ ] **Step 1: Add failing widget/provider test for orderbook control input**

Add a test that overrides `aggOrderbookRepositoryProvider` with a fake repository recording `AggMarketRequest` values. Pump `AggOrderbookCard`, tap ETH and spot controls, and expect the fake to receive `ETH/spot`.

```dart
class _RecordingAggRepo implements AggOrderbookRepository {
  final List<AggMarketRequest> requests = <AggMarketRequest>[];

  @override
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  }) async {
    requests.add(request);
    return kEmptyAggData;
  }
}
```

Test assertion:

```dart
expect(repo.requests.any((AggMarketRequest r) =>
    r.normalizedBase == 'ETH' && r.normalizedType == 'spot'), isTrue);
```

- [ ] **Step 2: Run widget test and verify fail**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart --plain-name "orderbook"
```

Expected: fail because orderbook UI still watches non-family `aggOrderbookProvider`.

- [ ] **Step 3: Add provider family**

Update `repository_providers.dart`:

```dart
final FutureProviderFamily<AggMarketData, AggMarketRequest>
aggOrderbookByMarketProvider = FutureProvider.family<AggMarketData, AggMarketRequest>(
  (Ref ref, AggMarketRequest request) async {
    return ref.watch(aggOrderbookRepositoryProvider).getMarketData(
      request: request,
    );
  },
);

final FutureProvider<AggMarketData> aggOrderbookProvider =
    FutureProvider<AggMarketData>((Ref ref) async {
  return ref.watch(
    aggOrderbookByMarketProvider(const AggMarketRequest.defaultMarket()).future,
  );
});
```

- [ ] **Step 4: Wire `AggOrderbookCard` to provider family**

Inside `AggOrderbookCard.build`, create request from state and watch family:

```dart
final AggMarketRequest request = AggMarketRequest(
  base: _coin,
  type: _futures ? 'perp' : 'spot',
);
final AggMarketData data =
    ref.watch(aggOrderbookByMarketProvider(request)).value ?? kEmptyAggData;
```

Keep the rest of rendering unchanged.

- [ ] **Step 5: Run widget/provider test and verify pass**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart --plain-name "orderbook"
```

Expected: pass.

### Task 4: OI and Volume Tabs Use Selected Symbol Data

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_open_interest_tab.dart`
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_volume_tab.dart`
- Test: `apps/quantify-mobile/test/pages/agg_orders_body_test.dart`

- [ ] **Step 1: Write failing tab selection tests**

Add tests with a fake repository returning distinct BTC and ETH `OiSnapshot`/`VolSnapshot` values. Tap ETH chip in each tab and assert ETH values appear.

Expected visible strings can use existing formatters: `fmtOiQty`, `fmtOiUsd`, and `fmtVolUsd` values produced from the fake data.

- [ ] **Step 2: Run tab tests and verify fail if current provider cannot refresh selected symbol**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart --plain-name "chip"
```

Expected: fail if selected symbol data is not driven through the provider path.

- [ ] **Step 3: Keep selected chip state but read from market-aware provider**

For `AggOpenInterestTab`, watch:

```dart
final AggMarketData? agg = ref
    .watch(aggOrderbookByMarketProvider(AggMarketRequest(base: _coin, type: 'perp')))
    .value;
```

For `AggVolumeTab`, watch:

```dart
final AggMarketData? agg = ref
    .watch(aggOrderbookByMarketProvider(AggMarketRequest(base: _coin, type: 'perp')))
    .value;
```

Keep current empty state and row rendering unchanged.

- [ ] **Step 4: Run tab tests and verify pass**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart --plain-name "chip"
```

Expected: pass.

### Task 5: Exchange Selection Reset and Regression Checks

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_controller.dart`
- Test: `apps/quantify-mobile/test/pages/agg_orders_body_test.dart`

- [ ] **Step 1: Write failing test for invalid selected exchanges**

Add controller test or widget test where state selected exchanges are `{'binance'}` then data venues become only `{'okx'}`. Expect derived asks/bids not to stay empty solely because stale selection is invalid.

- [ ] **Step 2: Run test and verify fail**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart --plain-name "exchange"
```

Expected: fail if stale exchange selection filters all new market data.

- [ ] **Step 3: Clamp selection to current venue set**

Update `_resolveSelection` in `agg_orderbook_controller.dart`:

```dart
  Set<String> _resolveSelection(AggMarketData data) {
    final Set<String> all = data.exchanges.map((AggExchange e) => e.key).toSet();
    final Set<String>? selected = state.selectedEx;
    if (all.isEmpty) return const <String>{};
    if (selected == null) return all;
    final Set<String> clamped = selected.intersection(all);
    return clamped.isEmpty ? all : clamped;
  }
```

- [ ] **Step 4: Run regression tests**

Run:

```bash
flutter test test/pages/agg_orders_body_test.dart
flutter test test/data/api_agg_orderbook_repository_test.dart
```

Expected: pass.

### Task 6: Final Verification and Delivery Prep

**Files:**
- All changed files.

- [ ] **Step 1: Run focused mobile test suite**

Run from `apps/quantify-mobile`:

```bash
flutter test test/data/api_agg_orderbook_repository_test.dart test/pages/agg_orders_body_test.dart test/data/providers_test.dart
```

Expected: pass.

- [ ] **Step 2: Run repository-required checks**

Run from repo root:

```bash
dx lint
dx build quantify-mobile --dev
```

Expected: pass. If `quantify-mobile` is not a supported `dx build` target, record the exact unsupported-target output and run the nearest Flutter build/analyze check available from the mobile app.

- [ ] **Step 3: Commit implementation**

Commit with Issue reference:

```bash
git add apps/quantify-mobile docs/superpowers/plans/2026-06-10-mobile-aggregated-market-data.md
git commit -F - <<'MSG'
feat: connect mobile aggregated market data

Refs: #2405
MSG
```

- [ ] **Step 4: Use git-commit-and-pr skill for final delivery**

Invoke `git-commit-and-pr` after implementation and verification to push the branch and open a PR linked to `#2405`.


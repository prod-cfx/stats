# Mobile Coin Stock Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect `apps/quantify-mobile` coin stock page to the real Dart backend contract while preserving the current mobile display scope.

**Architecture:** Keep `CoinStockRepository` as the only page data boundary. `ApiCoinStockRepository` calls generated `CryptoStockQuotesApi`, merges `BBX_SCRAPER` holdings data with `BBX` price data by `symbol`, and maps the merged DTOs into existing `CoinStock` view models.

**Tech Stack:** Flutter, Dart, Riverpod, `backend_api_contracts` generated SDK, `flutter_test`.

---

## File Structure

- Modify: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`
  - Add a small injectable loader seam so tests can simulate `BBX_SCRAPER` and `BBX` success/failure without mocking generated SDK internals.
  - Keep production path on `GeneratedBackendApi.client.getCryptoStockQuotesApi().cryptoStockQuotesControllerGetLatest(source_: source)`.
  - Keep mapping and merge helpers static and testable.
- Modify: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`
  - Extend `_dto` helper with quote fields needed by merge assertions.
  - Add repository-level tests for single-source failure and double-source failure.
  - Add merge assertion that scraper-only extension fields survive while quote fields prefer `BBX`.
- No changes: `packages/api-contracts-dart/lib/**`
  - Generated files are consumed, not edited.
- No changes: backend/front files
  - Backend contract and front behavior remain unchanged.

## Task 1: Repository Failure Semantics Tests

**Files:**
- Modify: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`
- Modify later: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`

- [ ] **Step 1: Write failing tests for source fallback behavior**

Add this test group after the existing `mergeQuotesBySymbol` group:

```dart
  group('ApiCoinStockRepository.listCoinStocks', () {
    test('returns BBX rows when BBX_SCRAPER fails', () async {
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX_SCRAPER') throw StateError('scraper down');
          return <CryptoStockQuoteResponseDto>[
            _dto(
              source: 'BBX',
              assetSymbol: 'BTC',
              price: '165.12',
              priceChangePercent: '2.37',
            ),
          ];
        },
      );

      final List<CoinStock> rows = await repo.listCoinStocks();

      expect(rows, hasLength(1));
      expect(rows.single.sym, 'MSTR');
      expect(rows.single.px, '165.12');
      expect(rows.single.ch, '+2.37%');
      expect(rows.single.coin, 'BTC');
    });

    test('returns BBX_SCRAPER rows when BBX fails', () async {
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX') throw StateError('bbx down');
          return <CryptoStockQuoteResponseDto>[
            _dto(
              source: 'BBX_SCRAPER',
              assetSymbol: 'ETH',
              holdingsValue: r'$12.67B',
              holdingsAmount: '4.07M ETH',
              price: '30.07',
            ),
          ];
        },
      );

      final List<CoinStock> rows = await repo.listCoinStocks();

      expect(rows, hasLength(1));
      expect(rows.single.coin, 'ETH');
      expect(rows.single.holdV, r'$12.67B');
      expect(rows.single.holdQ, '4.07M ETH');
      expect(rows.single.px, '30.07');
    });

    test('throws first source error when both sources fail', () async {
      final StateError scraperError = StateError('scraper down');
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX_SCRAPER') throw scraperError;
          throw StateError('bbx down');
        },
      );

      expect(repo.listCoinStocks(), throwsA(same(scraperError)));
    });
  });
```

- [ ] **Step 2: Run focused test to verify it fails**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_coin_stock_repository_test.dart
```

Expected: FAIL because `ApiCoinStockRepository.test` does not exist.

## Task 2: Injectable Loader Seam

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`
- Test: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`

- [ ] **Step 1: Add a typed quote loader and test constructor**

In `api_coin_stock_repository.dart`, add this typedef near imports:

```dart
typedef CoinStockQuoteLoader = Future<List<CryptoStockQuoteResponseDto>> Function(
  String source,
);
```

Replace constructor and fields with:

```dart
class ApiCoinStockRepository implements CoinStockRepository {
  ApiCoinStockRepository(this._api) : _loadQuotesOverride = null;

  @visibleForTesting
  ApiCoinStockRepository.test({required CoinStockQuoteLoader loadQuotes})
      : _api = null,
        _loadQuotesOverride = loadQuotes;

  final GeneratedBackendApi? _api;
  final CoinStockQuoteLoader? _loadQuotesOverride;
```

- [ ] **Step 2: Route `_loadQuotes` through seam while preserving production SDK path**

Replace `_loadQuotes` with:

```dart
  Future<_QuoteLoadResult> _loadQuotes(String source) async {
    try {
      final CoinStockQuoteLoader? override = _loadQuotesOverride;
      if (override != null) {
        return _QuoteLoadResult(quotes: await override(source));
      }

      final GeneratedBackendApi api = _api!;
      final response = await api.client
          .getCryptoStockQuotesApi()
          .cryptoStockQuotesControllerGetLatest(source_: source);
      return _QuoteLoadResult(
        quotes:
            response.data?.data?.toList() ??
            const <CryptoStockQuoteResponseDto>[],
      );
    } catch (error, stackTrace) {
      return _QuoteLoadResult(error: error, stackTrace: stackTrace);
    }
  }
```

- [ ] **Step 3: Run focused test to verify fallback behavior passes**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_coin_stock_repository_test.dart
```

Expected: PASS for all tests in `api_coin_stock_repository_test.dart`.

## Task 3: Front-Compatible Merge Assertions

**Files:**
- Modify: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`
- Modify if needed: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`

- [ ] **Step 1: Extend `_dto` helper with quote timestamps and price fields**

Add optional parameters to `_dto`:

```dart
  String? openPrice,
  String? highPrice,
  String? lowPrice,
  String? closePrice,
  String? priceChange,
  DateTime? quoteTimestamp,
  DateTime? updatedAt,
```

Set them in builder:

```dart
      ..openPrice = openPrice
      ..highPrice = highPrice
      ..lowPrice = lowPrice
      ..closePrice = closePrice
      ..priceChange = priceChange
      ..quoteTimestamp = quoteTimestamp ?? t
      ..createdAt = t
      ..updatedAt = updatedAt ?? t;
```

- [ ] **Step 2: Strengthen existing merge test**

In `prefers BBX quote fields while keeping holdings fields`, set distinct quote fields and assert them:

```dart
      final DateTime holdingTime = DateTime.utc(2026, 6, 6);
      final DateTime priceTime = DateTime.utc(2026, 6, 7);
      final CryptoStockQuoteResponseDto holding = _dto(
        holdingsValue: r'$58.00B',
        holdingsAmount: '671.27K BTC',
        price: '100',
        openPrice: '90',
        highPrice: '110',
        lowPrice: '80',
        closePrice: '95',
        priceChange: '0',
        priceChangePercent: '0',
        assetSymbol: 'BTC',
        companyType: 'Treasury',
        infoParagraphs: <String>['holding intro'],
        quoteTimestamp: holdingTime,
        updatedAt: holdingTime,
        source: 'BBX_SCRAPER',
      );
      final CryptoStockQuoteResponseDto price = _dto(
        price: '165.12',
        openPrice: '160',
        highPrice: '170',
        lowPrice: '155',
        closePrice: '158',
        priceChange: '3.81',
        priceChangePercent: '2.37',
        quoteTimestamp: priceTime,
        updatedAt: priceTime,
        source: 'BBX',
      );
```

Add expectations:

```dart
      expect(merged.first.openPrice, '160');
      expect(merged.first.highPrice, '170');
      expect(merged.first.lowPrice, '155');
      expect(merged.first.closePrice, '158');
      expect(merged.first.priceChange, '3.81');
      expect(merged.first.quoteTimestamp, priceTime);
      expect(merged.first.updatedAt, priceTime);
      expect(merged.first.assetSymbol, 'BTC');
      expect(merged.first.companyType, 'Treasury');
      expect(merged.first.infoParagraphs?.toList(), <String>['holding intro']);
```

- [ ] **Step 3: Fix merge timestamp fallback if test exposes mismatch**

If the test fails because timestamps become nullable or empty-preferred behavior differs, update `mergeQuotesBySymbol` to keep front semantics for timestamps:

```dart
              ..quoteTimestamp = priceQuote.quoteTimestamp
              ..updatedAt = priceQuote.updatedAt
```

Keep extension fields untouched by not assigning them during `rebuild`.

- [ ] **Step 4: Run focused test**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_coin_stock_repository_test.dart
```

Expected: PASS.

## Task 4: Mapping Polish and Existing Page Derivations

**Files:**
- Modify if needed: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`
- Test: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`
- Test: `apps/quantify-mobile/test/pages/market/coin_stock_derive_test.dart`

- [ ] **Step 1: Add one mapping test for lowercase asset normalization and invalid percent**

Add under `ApiCoinStockRepository.mapCoinStock`:

```dart
    test('normalizes lowercase asset and keeps invalid change empty', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(assetSymbol: ' eth ', priceChangePercent: 'not-a-number'),
      );

      expect(c.coin, 'ETH');
      expect(c.hold, 'ETH');
      expect(c.ch, '');
      expect(c.up, isTrue);
    });
```

- [ ] **Step 2: Ensure mapper already satisfies test or adjust `_normalizeAsset`**

Expected implementation:

```dart
  static String _normalizeAsset(String? raw) {
    final String asset = raw?.trim().toUpperCase() ?? '';
    return asset.isEmpty ? 'OTHER' : asset;
  }
```

Expected invalid percent behavior stays:

```dart
    final double? changePct = double.tryParse(dto.priceChangePercent ?? '');
    // ch == '' and up == true when changePct is null
```

- [ ] **Step 3: Run repository and derivation tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_coin_stock_repository_test.dart test/pages/market/coin_stock_derive_test.dart
```

Expected: PASS.

## Task 5: Verification and Delivery Prep

**Files:**
- Verify: `apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart`
- Verify: `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`
- Verify: `docs/superpowers/specs/2026-06-10-mobile-coin-stock-contract-design.md`
- Verify: `docs/superpowers/plans/2026-06-10-mobile-coin-stock-contract.md`

- [ ] **Step 1: Format changed Dart files**

Run:

```bash
dart format apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart
```

Expected: `Changed` or `Formatted 2 files` / `Formatted 0 files` with exit 0.

- [ ] **Step 2: Run focused Flutter tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_coin_stock_repository_test.dart test/pages/market/coin_stock_derive_test.dart
```

Expected: all tests pass.

- [ ] **Step 3: Run static analysis for mobile app**

Run:

```bash
cd apps/quantify-mobile && flutter analyze
```

Expected: `No issues found!`.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart
```

Expected: only planned repository/test/doc changes.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add apps/quantify-mobile/lib/data/api/api_coin_stock_repository.dart apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart docs/superpowers/plans/2026-06-10-mobile-coin-stock-contract.md
git commit -F - <<'MSG'
feat: connect mobile coin stocks to backend contract

变更说明：
- 通过 Dart 生成 SDK 保持 mobile 币股真实接口接入
- 补齐 BBX_SCRAPER 与 BBX 双源容错测试
- 明确 mobile 字段映射与 front 合并语义一致

Refs: #2404
MSG
```

Use `git add -f docs/superpowers/plans/2026-06-10-mobile-coin-stock-contract.md` if the ignored docs path blocks staging.

- [ ] **Step 6: Run `/git-commit-and-pr` workflow**

After implementation commit exists and working tree is clean, use the `git-commit-and-pr` skill to push this branch and create a PR against `main` with `Closes: #2404`.

## Self-Review

- Spec coverage: Tasks cover generated SDK data boundary, front-compatible dual-source merge, current mobile-only field mapping, no backend/front changes, and tests for mapping/merge/failure.
- Placeholder scan: no incomplete marker items.
- Type consistency: `CoinStockQuoteLoader`, `ApiCoinStockRepository.test`, and `CryptoStockQuoteResponseDto` fields match current Dart names including `source_`.

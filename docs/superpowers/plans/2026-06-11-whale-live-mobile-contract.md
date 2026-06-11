# Whale Live Mobile Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect `apps/quantify-mobile` whale live cards to the generated Dart `/whale-alerts/trades` contract and display whale addresses with the mobile abbreviation format.

**Architecture:** Keep the existing `WhaleLiveTabController -> WhaleFeedRepository -> ApiWhaleFeedRepository -> packages/api-contracts-dart` boundary. Add address abbreviation at the row presentation layer only, so navigation and stats still receive the full address. Tighten repository mapping tests around generated SDK usage and add row widget coverage for abbreviated display.

**Tech Stack:** Flutter, Riverpod, Dio, `backend_api_contracts` generated Dart SDK, `flutter_test`.

---

## File Structure

- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/qz_whale_row.dart`
  - Responsibility: render a single mobile whale live card. Add a small static display helper and use it for header address text only.
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_feed_repository.dart`
  - Responsibility: map generated `WhaleTradeDto` into `WhaleEvent`. Keep endpoint as `/whale-alerts/trades`; avoid fabricated leverage. Ensure polling failures do not clear existing controller state by leaving controller behavior unchanged.
- Modify: `apps/quantify-mobile/test/data/api_whale_feed_repository_generated_test.dart`
  - Responsibility: contract-level test for generated SDK path, query, DTO decoding, and `WhaleEvent` mapping.
- Modify: `apps/quantify-mobile/test/pages/whale_live_tab_test.dart`
  - Responsibility: widget-level regression for card address abbreviation while preserving the complete address in model-driven interactions.

## Task 1: Repository Contract Mapping

**Files:**
- Modify: `apps/quantify-mobile/test/data/api_whale_feed_repository_generated_test.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_feed_repository.dart`

- [ ] **Step 1: Strengthen the failing contract test**

Replace the existing expectation block in `api_whale_feed_repository_generated_test.dart` with checks that assert the endpoint, default query behavior, full DTO mapping, and no fabricated leverage:

```dart
expect(requests, hasLength(1));
expect(requests.single.path, '/whale-alerts/trades');
expect(requests.single.queryParameters['limit'], 7);
expect(requests.single.queryParameters['page'], 1);
expect(
  requests.single.queryParameters.containsKey('min_trade_value_usd'),
  isFalse,
);

expect(events, hasLength(1));
final WhaleEvent event = events.single;
expect(
  event.id,
  '0xabcdefabcdefabcdef01-BTC-2026-06-09T01:02:03.000Z-16250.125-65000.5',
);
expect(event.address, '0xabcdefabcdefabcdef01');
expect(event.symbol, 'BTC');
expect(event.amountUsd, 16250.125);
expect(event.direction, 'out');
expect(event.fromLabel, 'Hyperliquid');
expect(event.toLabel, 'BTC Short');
expect(event.side, 'short');
expect(event.mode, '全仓');
expect(event.leverage, isNull);
expect(event.positionValue, 16250.125);
expect(event.quantity, '0.2500 BTC');
expect(event.openPrice, 65000.5);
expect(event.traderTag, '成交');
expect(event.isFresh, isTrue);
expect(event.winRate, inInclusiveRange(45, 85));
expect(event.timestamp, DateTime.parse('2026-06-09T01:02:03.000Z'));
```

- [ ] **Step 2: Run the focused repository test and confirm failure if current code differs**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_whale_feed_repository_generated_test.dart
```

Expected before implementation if a gap exists: test fails on `page`, `mode`, `leverage`, or mapping assertion. If it already passes, treat this task as a regression guard and continue.

- [ ] **Step 3: Keep implementation minimal and explicit**

Ensure `_mapTrade` in `api_whale_feed_repository.dart` has this shape. Do not add `leverage`; keep it null by omission.

```dart
WhaleEvent _mapTrade(WhaleTradeDto trade) {
  final String sideLabel = trade.side == WhaleTradeDtoSideEnum.short
      ? 'Short'
      : 'Long';
  final String sideName = sideLabel.toLowerCase();
  final double tradeSize = trade.tradeSize.toDouble().abs();
  final String symbol = trade.symbol.toUpperCase();
  final DateTime timestamp =
      DateTime.tryParse(trade.tradeTime) ?? DateTime.now().toUtc();

  return WhaleEvent(
    id: '${trade.userAddress}-$symbol-${trade.tradeTime}-${trade.tradeValueUsd}-${trade.price}',
    symbol: symbol,
    amountUsd: trade.tradeValueUsd.toDouble(),
    direction: sideName == 'short' ? 'out' : 'in',
    fromLabel: 'Hyperliquid',
    toLabel: '$symbol $sideLabel',
    timestamp: timestamp,
    winRate: _stableWinRate(trade.userAddress, symbol),
    address: trade.userAddress,
    traderTag: '成交',
    isFresh: true,
    mode: '全仓',
    side: sideName,
    positionValue: trade.tradeValueUsd.toDouble(),
    quantity: '${tradeSize.toStringAsFixed(4)} $symbol',
    openPrice: trade.price.toDouble(),
  );
}
```

- [ ] **Step 4: Run repository test**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_whale_feed_repository_generated_test.dart
```

Expected: all tests pass.

## Task 2: Mobile Address Abbreviation

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/qz_whale_row.dart`
- Modify: `apps/quantify-mobile/test/pages/whale_live_tab_test.dart`

- [ ] **Step 1: Add failing pure helper tests**

In `whale_live_tab_test.dart`, add a group near existing `QzWhaleRow` helper tests:

```dart
group('QzWhaleRow.formatDisplayAddress', () {
  test('shortens standard 0x whale address for mobile cards', () {
    expect(
      QzWhaleRow.formatDisplayAddress('0xabcdefabcdefabcdef01'),
      '0xabcd…ef01',
    );
  });

  test('keeps non-standard and short labels unchanged', () {
    expect(QzWhaleRow.formatDisplayAddress('Hyperliquid'), 'Hyperliquid');
    expect(QzWhaleRow.formatDisplayAddress('0xabc'), '0xabc');
  });
});
```

- [ ] **Step 2: Run helper tests and confirm failure**

Run:

```bash
cd apps/quantify-mobile && flutter test test/pages/whale_live_tab_test.dart --plain-name 'QzWhaleRow.formatDisplayAddress'
```

Expected: failure because `formatDisplayAddress` does not exist.

- [ ] **Step 3: Implement the display helper**

In `QzWhaleRow`, below `static const String _dash = '--';`, add:

```dart
static String formatDisplayAddress(String raw) {
  if (!raw.startsWith('0x') || raw.length < 12) return raw;
  final String head = raw.substring(2, 6);
  final String tail = raw.substring(raw.length - 4);
  return '0x$head…$tail';
}
```

- [ ] **Step 4: Use abbreviation in header text only**

In `_buildHeaderRow`, replace:

```dart
final String addressText = event.address ?? event.fromLabel;
```

with:

```dart
final String rawAddress = event.address ?? event.fromLabel;
final String addressText = formatDisplayAddress(rawAddress);
```

Do not change `onOpen` or `onStats`; they are already provided by parent callbacks using `WhaleEvent` with full `event.address`.

- [ ] **Step 5: Run helper tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/pages/whale_live_tab_test.dart --plain-name 'QzWhaleRow.formatDisplayAddress'
```

Expected: tests pass.

## Task 3: Widget Regression For Display And Full Address Preservation

**Files:**
- Modify: `apps/quantify-mobile/test/pages/whale_live_tab_test.dart`

- [ ] **Step 1: Add widget test for abbreviated card text**

Add this test in the `WhaleLiveTab` widget test group, using the existing fake repository harness in that file:

```dart
testWidgets('WhaleLiveTab shows abbreviated address but keeps full model address', (
  WidgetTester tester,
) async {
  final WhaleEvent event = WhaleEvent(
    id: 'live-btc-short',
    symbol: 'BTC',
    amountUsd: 16250.125,
    direction: 'out',
    fromLabel: 'Hyperliquid',
    toLabel: 'BTC Short',
    timestamp: DateTime.utc(2026, 6, 9, 1, 2, 3),
    winRate: 72,
    address: '0xabcdefabcdefabcdef01',
    traderTag: '成交',
    isFresh: true,
    mode: '全仓',
    side: 'short',
    positionValue: 16250.125,
    quantity: '0.2500 BTC',
    openPrice: 65000.5,
  );
  final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository(
    history: <WhaleEvent>[event],
  );

  await pumpWhaleLiveTab(tester, repo);
  await tester.pumpAndSettle();

  expect(find.text('0xabcd…ef01'), findsOneWidget);
  expect(find.text('0xabcdefabcdefabcdef01'), findsNothing);
  expect(repo.history.single.address, '0xabcdefabcdefabcdef01');
});
```

If local helper names differ, use existing `_FakeWhaleFeedRepository` and pump helper definitions from `whale_live_tab_test.dart`; keep the assertion content unchanged.

- [ ] **Step 2: Run the widget regression**

Run:

```bash
cd apps/quantify-mobile && flutter test test/pages/whale_live_tab_test.dart --plain-name 'WhaleLiveTab shows abbreviated address but keeps full model address'
```

Expected: passes after Task 2 implementation.

## Task 4: Focused Regression Suite

**Files:**
- No code changes expected.

- [ ] **Step 1: Run whale live controller tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/pages/whale/whale_live_tab_controller_test.dart
```

Expected: all tests pass. Existing controller loading, dedupe, sorting, and error behavior remain unchanged.

- [ ] **Step 2: Run whale live widget tests**

Run:

```bash
cd apps/quantify-mobile && flutter test test/pages/whale_live_tab_test.dart
```

Expected: all tests pass.

- [ ] **Step 3: Run repository test**

Run:

```bash
cd apps/quantify-mobile && flutter test test/data/api_whale_feed_repository_generated_test.dart
```

Expected: all tests pass.

## Task 5: Repo Validation And Delivery Prep

**Files:**
- No code changes expected unless validation reveals formatting issues.

- [ ] **Step 1: Run repository lint**

Run from repo root:

```bash
dx lint
```

Expected: command exits 0. If formatting issues are reported, run the repository-suggested formatter command and repeat `dx lint`.

- [ ] **Step 2: Run mobile build target**

Run from repo root:

```bash
dx build quantify-mobile --dev
```

Expected: command exits 0. If this target name is not supported, run `dx build affected --dev` and record the unsupported target output plus affected build result in the PR body.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes limited to mobile whale row/repository tests/plan files plus approved spec commit already in history.

- [ ] **Step 4: Delivery**

Use the `git-commit-and-pr` skill after implementation and validation. The PR body must mention:

- front realtime page uses `/whale-alerts/trades`.
- mobile consumes generated Dart `WhaleAlertsApi.whaleAlertControllerGetWhaleTrades`.
- address abbreviation is display-only; full address remains in `WhaleEvent.address`.
- validation commands and results.

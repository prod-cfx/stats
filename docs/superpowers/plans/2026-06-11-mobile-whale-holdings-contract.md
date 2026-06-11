# Mobile Whale Holdings Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect `apps/quantify-mobile` Whale > Holdings to the generated Dart `/whale-holdings` backend contract while keeping mobile card address display shortened and full address actions intact.

**Architecture:** Keep backend and front unchanged. Extend the mobile domain row with `displayAddress`, map generated `WhaleHoldingDto` rows in `ApiWhaleHoldingsRepository`, and let `WhaleHoldingCard` render shortened text while copy/route/stats use the full `address`.

**Tech Stack:** Flutter, Riverpod, generated `backend_api_contracts`, Dio, built_value serializers, Flutter widget tests.

---

## File Structure

- Modify: `apps/quantify-mobile/lib/domain/models/whale_holding_models.dart`
  - Add `displayAddress` to `WhaleHoldingPosition`.
  - Keep `address` as full business address.
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart`
  - Add private address-shortening helper.
  - Map `WhaleHoldingDto.userAddress` to full `address` and shortened `displayAddress`.
  - Keep `/whale-holdings` request parameters unchanged.
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`
  - Add optional `displayAddress` to `WhaleAddressLink`.
  - Default display text to `address` for existing callers.
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_holding_card.dart`
  - Pass `entry.displayAddress` into `WhaleAddressLink`.
- Modify: `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_holdings.dart`
  - Add `displayAddress` to each fixture row, matching existing shortened fixture address.
- Modify: `apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart`
  - Assert full address and shortened display address.
- Modify: `apps/quantify-mobile/test/pages/whale_holdings_tab_test.dart`
  - Assert rendered card uses shortened address and copy uses full address.

## Task 1: Domain Model Address Split

**Files:**
- Modify: `apps/quantify-mobile/lib/domain/models/whale_holding_models.dart`
- Modify: `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_holdings.dart`

- [ ] **Step 1: Write the expected domain constructor shape**

Open `apps/quantify-mobile/lib/domain/models/whale_holding_models.dart` and update `WhaleHoldingPosition` so the constructor requires `displayAddress` immediately after `address`:

```dart
class WhaleHoldingPosition {
  const WhaleHoldingPosition({
    required this.address,
    required this.displayAddress,
    required this.symbol,
    required this.symbolColorHex,
    required this.mode,
    required this.side,
    required this.leverage,
    required this.value,
    required this.valueDisplay,
    required this.qtyDisplay,
    required this.pnl,
    required this.pnlDisplay,
    required this.pnlPctDisplay,
    required this.margin,
    required this.marginDisplay,
    required this.openDisplay,
    required this.liqDisplay,
    required this.liqBreached,
    required this.hoursAgo,
    required this.timeDisplay,
  });

  final String address; // 完整地址，用于复制 / 路由 / 统计。
  final String displayAddress; // 缩写地址，如 '0xa5b0…1d41'。
  final String symbol; // BTC / ETH / HYPE ...
```

- [ ] **Step 2: Run focused compile feedback and verify fixtures fail**

Run:

```bash
flutter test test/pages/whale_holdings_tab_test.dart
```

Expected: FAIL with missing required named parameter `displayAddress` from `WhaleHoldingPosition` fixture construction.

- [ ] **Step 3: Update mock whale holdings fixtures**

In `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_holdings.dart`, add `displayAddress` to every `WhaleHoldingPosition` entry, using the current shortened `address` value.

Example transformation:

```dart
WhaleHoldingPosition(
  address: '0xa5b0…1d41',
  displayAddress: '0xa5b0…1d41',
  symbol: 'ETH',
```

Apply the same pattern to all rows in that fixture file. Do not change numeric values or row order.

- [ ] **Step 4: Run focused widget/domain tests**

Run:

```bash
flutter test test/pages/whale_holdings_tab_test.dart
```

Expected: PASS, because fixtures now satisfy the domain constructor and UI still reads `address` for display before later tasks change it.

- [ ] **Step 5: Commit task 1**

Run:

```bash
git add apps/quantify-mobile/lib/domain/models/whale_holding_models.dart apps/quantify-mobile/test/fixtures/mock/fixtures/whale_holdings.dart
git commit -F - <<'MSG'
feat: split whale holding display address

Refs: #2416
MSG
```

## Task 2: Repository Contract Mapping

**Files:**
- Modify: `apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart`
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart`

- [ ] **Step 1: Update repository test expectations first**

In `apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart`, keep the existing test and add a `displayAddress` assertion after the full address assertion:

```dart
expect(row.address, '0xabcdefabcdefabcdef01');
expect(row.displayAddress, '0xabcd…ef01');
```

Keep existing assertions for request path, query parameters, value display, quantity display, PnL, percent, margin, entry price, and liquidation price.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
flutter test test/data/api_whale_holdings_repository_generated_test.dart
```

Expected: FAIL because `ApiWhaleHoldingsRepository._map()` does not provide `displayAddress` yet, or because the field exists but is not populated.

- [ ] **Step 3: Implement address shortening and DTO mapping**

In `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart`, update `_map()` so `address` stays full and `displayAddress` is shortened:

```dart
  WhaleHoldingPosition _map(WhaleHoldingDto dto) {
    final double value = dto.positionValueUsd.toDouble();
    final double leverage = dto.leverage?.toDouble() ?? 10;
    final double margin = value / (leverage > 0 ? leverage : 10);
    final double pnl = dto.pnl?.toDouble() ?? 0;
    final double roe = dto.roe?.toDouble() ?? 0;
    final double? liq = dto.liquidationPrice?.toDouble();
    final int hoursAgo = _hoursAgo(dto.snapshotTime);

    return WhaleHoldingPosition(
      address: dto.userAddress,
      displayAddress: _shortenAddress(dto.userAddress),
      symbol: dto.symbol,
      symbolColorHex: _symbolColor(dto.symbol),
      mode: 'Cross',
      side: _side(dto.side),
      leverage: dto.leverage?.round() ?? 0,
      value: value,
      valueDisplay: _formatUsdCompact(value),
      qtyDisplay:
          '${dto.positionSize.toDouble().toStringAsFixed(4)} ${dto.symbol}',
      pnl: pnl,
      pnlDisplay: _formatUsdCompact(pnl, signed: true),
      pnlPctDisplay: _formatPercent(roe),
      margin: margin,
      marginDisplay: _formatUsdCompact(margin),
      openDisplay: _formatUsdPrice(dto.entryPrice.toDouble()),
      liqDisplay: liq == null ? '--' : _formatUsdPrice(liq),
      liqBreached: false,
      hoursAgo: hoursAgo,
      timeDisplay: _formatHoursAgo(hoursAgo),
    );
  }
```

Add this private helper near other static format helpers in the same file:

```dart
  static String _shortenAddress(String address) {
    final String value = address.trim();
    if (!value.startsWith('0x') || value.length < 11) return address;
    return '${value.substring(0, 6)}…${value.substring(value.length - 4)}';
  }
```

This helper returns the original input for short or malformed values and uses `0x` + 4 chars + `…` + 4 chars for normal addresses.

- [ ] **Step 4: Run repository contract test**

Run:

```bash
flutter test test/data/api_whale_holdings_repository_generated_test.dart
```

Expected: PASS. Confirm the request still uses `/whale-holdings` with `page=1`, `limit=200`, and `minPositionValueUsd=1000000`.

- [ ] **Step 5: Commit task 2**

Run:

```bash
git add apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart
git commit -F - <<'MSG'
feat: map whale holdings contract addresses

Refs: #2416
MSG
```

## Task 3: Card Address Rendering

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_holding_card.dart`
- Modify: `apps/quantify-mobile/test/pages/whale_holdings_tab_test.dart`

- [ ] **Step 1: Add widget test for shortened render and full copy**

In `apps/quantify-mobile/test/pages/whale_holdings_tab_test.dart`, update `_FakeHoldingsRepo` to return a row with full `address` and shortened `displayAddress`, or add a dedicated fake class for this test.

Add this test in the `持仓 tab 渲染与交互` group:

```dart
testWidgets('真实地址行展示缩写地址但复制完整地址', (WidgetTester tester) async {
  const String full = '0xabcdefabcdefabcdef01';
  const String short = '0xabcd…ef01';
  final List<MethodCall> calls = <MethodCall>[];
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (MethodCall call) async {
      if (call.method == 'Clipboard.setData') calls.add(call);
      return null;
    },
  );

  await tester.binding.setSurfaceSize(const Size(420, 1200));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        whaleHoldingsRepositoryProvider.overrideWithValue(
          _SingleHoldingRepo(
            const WhaleHoldingPosition(
              address: full,
              displayAddress: short,
              symbol: 'BTC',
              symbolColorHex: 0xFFF7931A,
              mode: 'Cross',
              side: WhaleHoldingSide.long,
              leverage: 10,
              value: 1000000,
              valueDisplay: r'$1.00M',
              qtyDisplay: '10.0000 BTC',
              pnl: 1000,
              pnlDisplay: r'+$1.00K',
              pnlPctDisplay: '+1.00%',
              margin: 100000,
              marginDisplay: r'$100.00K',
              openDisplay: r'$100,000.00',
              liqDisplay: r'$90,000.00',
              liqBreached: false,
              hoursAgo: 1,
              timeDisplay: '1 小时前',
            ),
          ),
        ),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        home: const Scaffold(body: WhaleHoldingsTab()),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));

  expect(find.text(short), findsOneWidget);
  expect(find.text(full), findsNothing);

  await tester.tap(find.byType(WhaleCopyButton).first);
  await tester.pump();
  expect((calls.first.arguments as Map<dynamic, dynamic>)['text'], full);

  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    null,
  );
});
```

Add the helper fake class near `_FakeHoldingsRepo`:

```dart
class _SingleHoldingRepo implements WhaleHoldingsRepository {
  const _SingleHoldingRepo(this.row);

  final WhaleHoldingPosition row;

  @override
  Future<List<WhaleHoldingPosition>> getHoldings() async =>
      <WhaleHoldingPosition>[row];
}
```

- [ ] **Step 2: Run widget test to verify it fails**

Run:

```bash
flutter test test/pages/whale_holdings_tab_test.dart
```

Expected: FAIL because `WhaleAddressLink` still renders `address` instead of `displayAddress`.

- [ ] **Step 3: Add optional display text to WhaleAddressLink**

In `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`, update the class constructor and fields:

```dart
class WhaleAddressLink extends StatelessWidget {
  const WhaleAddressLink({
    required this.address,
    required this.onOpen,
    this.displayAddress,
    this.fontSize = 14,
    super.key,
  });

  final String address;
  final String? displayAddress;
  final VoidCallback onOpen;
  final double fontSize;
```

Inside `build`, before returning `InkWell`, add:

```dart
    final String label = displayAddress ?? address;
```

Change the `Text` widget to render `label`:

```dart
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
```

- [ ] **Step 4: Pass displayAddress from holding card**

In `apps/quantify-mobile/lib/pages/whale/widgets/whale_holding_card.dart`, update the `WhaleAddressLink` call:

```dart
                child: WhaleAddressLink(
                  address: entry.address,
                  displayAddress: entry.displayAddress,
                  onOpen: onOpen,
                  fontSize: 13,
                ),
```

- [ ] **Step 5: Run widget tests**

Run:

```bash
flutter test test/pages/whale_holdings_tab_test.dart
```

Expected: PASS. The new test should show shortened address and copy full address.

- [ ] **Step 6: Commit task 3**

Run:

```bash
git add apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart apps/quantify-mobile/lib/pages/whale/widgets/whale_holding_card.dart apps/quantify-mobile/test/pages/whale_holdings_tab_test.dart
git commit -F - <<'MSG'
feat: render shortened whale holding addresses

Refs: #2416
MSG
```

## Task 4: Verification and Delivery Prep

**Files:**
- No required source edits unless verification exposes a compile or test issue.

- [ ] **Step 1: Run focused tests together**

Run:

```bash
flutter test test/data/api_whale_holdings_repository_generated_test.dart test/pages/whale_holdings_tab_test.dart
```

Expected: PASS for both files.

- [ ] **Step 2: Run build gate**

Run:

```bash
dx build quantify-mobile --dev
```

Expected: PASS. If the target is not supported, capture the exact error and run:

```bash
flutter analyze
```

Expected fallback: PASS. Report unsupported `dx` target in the final PR verification notes.

- [ ] **Step 3: Inspect git diff against main**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: source/test/docs files only; `git diff --check` exits 0.

- [ ] **Step 4: Final delivery with git-commit-and-pr skill**

Use `/git-commit-and-pr` as requested by the user. PR body must include:

```markdown
## 变更目的

- 对应 Issue 验收标准 [1]：mobile “巨鲸 > 持仓”页通过 Dart generated `/whale-holdings` contract 获取真实数据。
- 对应 Issue 验收标准 [2]、[3]：持仓卡展示缩写地址，复制/路由/统计使用完整地址。
- 对应 Issue 验收标准 [4]：backend contract 和 front 接入不变。
- 对应 Issue 验收标准 [5]：补充 repository contract test 和 widget interaction test。

## 主要改动和解决的问题
- 改动点：`WhaleHoldingPosition` 拆分 `address` 与 `displayAddress`。
- 改动点：`ApiWhaleHoldingsRepository` 映射 `/whale-holdings` DTO 到 mobile domain model。
- 改动点：`WhaleHoldingCard` 只展示缩写地址，保留完整地址用于复制、详情和统计。
- 改动原因：真实 API 返回完整地址，mobile 设计要求卡片展示缩写地址。

## 遗留的问题

- 无。

## 已做的验证

- `flutter test test/data/api_whale_holdings_repository_generated_test.dart test/pages/whale_holdings_tab_test.dart` → 通过
- `dx build quantify-mobile --dev` → 通过

##  PR 遗留未做的
- 无。

## 关联

- Closes: #2416
```

If `dx build quantify-mobile --dev` is unsupported and fallback was used, replace the build line with the exact unsupported-target note plus the fallback `flutter analyze` result.

## Self-Review Checklist

- Spec coverage:
  - `/whale-holdings` Dart contract remains the source: Task 2.
  - Shortened card address with full action address: Tasks 1, 2, 3.
  - No backend/front changes: all tasks only touch mobile/docs/tests.
  - Empty response and decode behavior unchanged: Task 2 keeps current repository behavior.
  - Tests and verification: Tasks 2, 3, 4.
- Placeholder scan: no placeholder markers or deferred-detail wording in implementation steps.
- Type consistency:
  - `WhaleHoldingPosition.displayAddress` is required by constructor and used by `WhaleHoldingCard`.
  - `WhaleAddressLink.displayAddress` is optional and does not break existing callers.
  - Repository helper `_shortenAddress` is private and covered through repository contract test.

# Mobile Whale Discover Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile whale discover cards consume the generated Dart backend contract while displaying abbreviated addresses and using full addresses for behavior.

**Architecture:** Keep the current repository/provider/widget flow. Add a UI-only `displayAddress` field to `WhaleLeaderEntry`, derive it in `ApiWhaleLeaderboardRepository`, and render it through existing whale card controls while callbacks continue to use `entry.id`.

**Tech Stack:** Flutter, Dart, Riverpod, Dio, generated `backend_api_contracts`, `flutter_test`.

---

## File Structure

- Modify `apps/quantify-mobile/lib/domain/models/whale_leader_models.dart`: add `displayAddress` and clarify `id` as full address.
- Modify `apps/quantify-mobile/lib/data/api/api_whale_leaderboard_repository.dart`: derive `displayAddress` from DTO `address` with ASCII `...` abbreviation.
- Modify `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`: let `WhaleAddressLink` accept `displayAddress` while keeping `address` as fallback.
- Modify `apps/quantify-mobile/lib/pages/whale/widgets/whale_leader_card.dart`: render `entry.displayAddress`.
- Modify `apps/quantify-mobile/lib/pages/whale/widgets/whale_top_slideshow.dart`: render `entry.displayAddress`.
- Modify `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_leaders.dart`: add `displayAddress` to existing fixture entries, matching current mock `id` strings.
- Modify `apps/quantify-mobile/test/data/api_whale_real_empty_repository_test.dart`: assert full `id` and abbreviated `displayAddress` mapping.
- Add `apps/quantify-mobile/test/widgets/whale_address_link_test.dart`: guard display text versus callback behavior.

## Task 1: Domain Model Display Address

**Files:**
- Modify: `apps/quantify-mobile/lib/domain/models/whale_leader_models.dart`
- Modify: `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_leaders.dart`

- [ ] **Step 1: Add `displayAddress` to `WhaleLeaderEntry`**

Edit `apps/quantify-mobile/lib/domain/models/whale_leader_models.dart` so the constructor and fields include:

```dart
required this.id,
required this.displayAddress,
```

```dart
final String id; // 完整链上地址，用于复制、详情页和 API 调用。
final String displayAddress; // 卡片展示地址，如 '0x8ba1...ba72'。
```

- [ ] **Step 2: Update mock whale leader fixtures**

In `apps/quantify-mobile/test/fixtures/mock/fixtures/whale_leaders.dart`, add `displayAddress` next to every `id`. Each current fixture `id` is already the desired display string, so use the same value. The exact additions are:

```dart
id: '0x8ba1...ba72',
displayAddress: '0x8ba1...ba72',

id: '0x742d...f44e',
displayAddress: '0x742d...f44e',

id: '0x66f8...2054',
displayAddress: '0x66f8...2054',

id: '0x2810...cb16',
displayAddress: '0x2810...cb16',

id: '0xd551...92ff',
displayAddress: '0xd551...92ff',

id: '0xfe9e...51c8',
displayAddress: '0xfe9e...51c8',

id: '0x53d2...8a3d',
displayAddress: '0x53d2...8a3d',

id: '0x1151...e30f',
displayAddress: '0x1151...e30f',

id: '0xbe0e...33e8',
displayAddress: '0xbe0e...33e8',

id: '0x267b...fdc0',
displayAddress: '0x267b...fdc0',
```

- [ ] **Step 3: Run affected domain tests**

Run:

```bash
cd apps/quantify-mobile
flutter test test/domain/use_cases/whale_leader_use_cases_test.dart
```

Expected: PASS.

- [ ] **Step 4: Commit Task 1**

Run from repository root:

```bash
git add apps/quantify-mobile/lib/domain/models/whale_leader_models.dart apps/quantify-mobile/test/fixtures/mock/fixtures/whale_leaders.dart
git commit -F - <<'MSG'
feat: split whale leader display address

Refs: #2413
MSG
```

## Task 2: Contract Mapper Address Abbreviation

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_leaderboard_repository.dart`
- Modify: `apps/quantify-mobile/test/data/api_whale_real_empty_repository_test.dart`

- [ ] **Step 1: Write failing mapping assertions**

In `apps/quantify-mobile/test/data/api_whale_real_empty_repository_test.dart`, update the discover mapping test assertions:

```dart
expect(entries.first.id, '0xabcdefabcdefabcdef01');
expect(entries.first.displayAddress, '0xabcd...ef01');
expect(entries.last.id, '0x11112222333344445555');
expect(entries.last.displayAddress, '0x1111...5555');
```

In the BaseResponse unwrap test, add:

```dart
expect(entries.single.id, '0xabcdefabcdefabcdef01');
expect(entries.single.displayAddress, '0xabcd...ef01');
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd apps/quantify-mobile
flutter test test/data/api_whale_real_empty_repository_test.dart
```

Expected: FAIL because mapper does not yet provide `displayAddress`.

- [ ] **Step 3: Implement mapper helper**

In `apps/quantify-mobile/lib/data/api/api_whale_leaderboard_repository.dart`, update `mapDiscoverTrader`:

```dart
return WhaleLeaderEntry(
  id: dto.address,
  displayAddress: _abbreviateAddress(dto.address),
  aumDisplay: _formatUsdCompact(dto.totalValueUsd),
  aumValue: dto.totalValueUsd.toDouble(),
  pnlDisplay: _formatUsdCompact(dto.pnlUsd, signed: true),
  pnlValue: dto.pnlUsd.toDouble(),
  pnlPositive: dto.pnlUsd >= 0,
  trades: dto.trades?.round() ?? 0,
  positions: dto.positions?.round() ?? 0,
  winRate: dto.winRatePct.toDouble(),
  tags:
      dto.aiTags
          ?.map((WhaleDiscoverTraderAiTagDto tag) => _aiTagLabel(tag.key))
          .toList(growable: false) ??
      const <String>[],
  avatarText: recommended ? _avatarText(dto.address) : null,
  avatarBgHex: recommended ? _parseColorHex(dto.avatarColor) : null,
  avatarTextHex: recommended ? 0xFFFFFFFF : null,
  tier: recommended ? dto.tag : null,
);
```

Add helper near `_avatarText`:

```dart
static String _abbreviateAddress(String address) {
  final String trimmed = address.trim();
  if (trimmed.length <= 13) return trimmed;
  return '${trimmed.substring(0, 6)}...${trimmed.substring(trimmed.length - 4)}';
}
```

- [ ] **Step 4: Run mapper tests to verify GREEN**

Run:

```bash
cd apps/quantify-mobile
flutter test test/data/api_whale_real_empty_repository_test.dart
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run from repository root:

```bash
git add apps/quantify-mobile/lib/data/api/api_whale_leaderboard_repository.dart apps/quantify-mobile/test/data/api_whale_real_empty_repository_test.dart
git commit -F - <<'MSG'
feat: map whale discover display address

Refs: #2413
MSG
```

## Task 3: Card Rendering Uses Display Address

**Files:**
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_leader_card.dart`
- Modify: `apps/quantify-mobile/lib/pages/whale/widgets/whale_top_slideshow.dart`
- Add: `apps/quantify-mobile/test/widgets/whale_address_link_test.dart`

- [ ] **Step 1: Add failing widget test**

Create `apps/quantify-mobile/test/widgets/whale_address_link_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_card_controls.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

void main() {
  testWidgets('WhaleAddressLink renders displayAddress and keeps tap callback', (
    WidgetTester tester,
  ) async {
    int taps = 0;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('zh'),
        theme: buildQzThemeData(QzTheme.fallback),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: WhaleAddressLink(
            address: '0xabcdefabcdefabcdef01',
            displayAddress: '0xabcd...ef01',
            onOpen: () => taps++,
          ),
        ),
      ),
    );

    expect(find.text('0xabcd...ef01'), findsOneWidget);
    expect(find.text('0xabcdefabcdefabcdef01'), findsNothing);

    await tester.tap(find.text('0xabcd...ef01'));
    expect(taps, 1);
  });
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd apps/quantify-mobile
flutter test test/widgets/whale_address_link_test.dart
```

Expected: FAIL because `WhaleAddressLink` has no `displayAddress` parameter.

- [ ] **Step 3: Implement `WhaleAddressLink.displayAddress`**

In `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart`, update constructor and fields:

```dart
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

Before `return InkWell`, add:

```dart
final String label = displayAddress ?? address;
```

Change the `Text` child from `address` to `label`.

- [ ] **Step 4: Wire list and top cards**

In `apps/quantify-mobile/lib/pages/whale/widgets/whale_leader_card.dart`, use:

```dart
WhaleAddressLink(
  address: entry.id,
  displayAddress: entry.displayAddress,
  onOpen: onOpen,
),
```

In `apps/quantify-mobile/lib/pages/whale/widgets/whale_top_slideshow.dart`, use:

```dart
WhaleAddressLink(
  address: entry.id,
  displayAddress: entry.displayAddress,
  onOpen: onOpen,
  fontSize: 13,
),
```

- [ ] **Step 5: Run widget test to verify GREEN**

Run:

```bash
cd apps/quantify-mobile
flutter test test/widgets/whale_address_link_test.dart
```

Expected: PASS.

- [ ] **Step 6: Run combined focused tests**

Run:

```bash
cd apps/quantify-mobile
flutter test test/widgets/whale_address_link_test.dart test/data/api_whale_real_empty_repository_test.dart
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run from repository root:

```bash
git add apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart apps/quantify-mobile/lib/pages/whale/widgets/whale_leader_card.dart apps/quantify-mobile/lib/pages/whale/widgets/whale_top_slideshow.dart apps/quantify-mobile/test/widgets/whale_address_link_test.dart
git commit -F - <<'MSG'
feat: render whale display addresses on cards

Refs: #2413
MSG
```

## Task 4: Final Verification And PR Prep

**Files:**
- Verify: `apps/quantify-mobile`
- Verify: repository root checks

- [ ] **Step 1: Run focused mobile tests**

Run:

```bash
cd apps/quantify-mobile
flutter test test/data/api_whale_real_empty_repository_test.dart test/widgets/whale_address_link_test.dart test/domain/use_cases/whale_leader_use_cases_test.dart
```

Expected: all tests PASS.

- [ ] **Step 2: Run repo lint**

Run from repository root:

```bash
dx lint
```

Expected: exit 0.

- [ ] **Step 3: Run mobile build target or record unsupported target**

Run from repository root:

```bash
dx build quantify-mobile --dev
```

Expected: exit 0. If `quantify-mobile` is not a registered `dx build` target, record the exact error and run:

```bash
cd apps/quantify-mobile
flutter test
```

Expected fallback: exit 0.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git log --oneline --decorate -5
```

Expected: only spec, plan, and mobile discover contract files changed; commits reference `#2413`.

- [ ] **Step 5: Use git-commit-and-pr delivery skill**

Invoke `$git-commit-and-pr` or follow its workflow to push `codex/feat/2413-mobile-whale-discover-contract` and create a PR that closes `#2413`.

PR body must include:

```markdown
## 变更目的

- 对应 Issue 验收标准 [1]：移动端巨鲸发现页继续通过 Dart 生成契约读取 `/whale-tracking/discover`。
- 对应 Issue 验收标准 [2]：卡片地址显示 `0x1234...abcd` 风格缩写。
- 对应 Issue 验收标准 [3]：复制、详情、统计行为继续使用完整地址。
- 对应 Issue 验收标准 [4]：只映射 mobile 当前需要的推荐、列表、排序、AI 标签与统计入口字段。
- 对应 Issue 验收标准 [5]：补充 repository mapping 与地址显示/行为分离测试。

## 主要改动和解决的问题
- 解决了真实地址与展示缩写混用的问题。
- 改动点：`WhaleLeaderEntry` 增加 `displayAddress`，discover DTO mapper 派生缩写，卡片控件渲染 display 地址。
- 改动原因：mobile 设计需要缩写展示，但 API 行为必须保留完整地址。

## 遗留的问题

- 无。

## 已做的验证

- `flutter test test/data/api_whale_real_empty_repository_test.dart test/widgets/whale_address_link_test.dart test/domain/use_cases/whale_leader_use_cases_test.dart` → 通过
- `dx lint` → 通过
- `dx build quantify-mobile --dev` → 通过或记录不支持并列出 fallback `flutter test` 结果

##  PR 遗留未做的
- 无。

## 关联

Closes: #2413
```

## Self-Review

- Spec coverage: all goals map to Tasks 1-4.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `WhaleLeaderEntry.displayAddress` is introduced before mapper and widget tasks consume it.

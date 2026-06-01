import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/qz_whale_row.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// QzWhaleRow widget 渲染测试。
///
/// 覆盖 issue #1602 验收标准：
/// - `displayTimestamp` 注入时，相对时间基于它而不是 `event.timestamp`，
///   保证 mock 场景行内时间与分组语义一致。
/// - 不传 `displayTimestamp` 时回退到 `event.timestamp`，真实数据正常工作。
/// - 边界 `formatRelativeTime` 仍按 just now / Nm / Nh / Nd 分档。
Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(body: child),
    ),
  );
  await tester.pump();
}

WhaleEvent _ev({
  String id = 'w-x',
  required DateTime ts,
  double winRate = 72,
}) {
  return WhaleEvent(
    id: id,
    symbol: 'BTCUSDT',
    amountUsd: 1_500_000,
    direction: 'in',
    fromLabel: 'A',
    toLabel: 'B',
    timestamp: ts,
    winRate: winRate,
  );
}

void main() {
  testWidgets('displayTimestamp 注入时行内显示派生相对时间（与分组一致）',
      (WidgetTester tester) async {
    final DateTime now = DateTime(2026, 5, 19, 12, 0, 0);
    // event.timestamp 为远古时间，但 displayTimestamp 指向 now-2min
    final WhaleEvent event = _ev(
      ts: DateTime(2024, 5, 18, 12, 0, 0),
    );
    await _pump(
      tester,
      QzWhaleRow(
        event: event,
        now: now,
        displayTimestamp: now.subtract(const Duration(minutes: 2)),
      ),
    );

    // 不允许出现「731 天前」/「天前」级别的时间穿帮
    expect(find.textContaining('天前'), findsNothing,
        reason: '注入 displayTimestamp 后应使用派生时间，不应出现 天前');
    expect(find.text('2 分钟前'), findsOneWidget);
  });

  testWidgets('未注入 displayTimestamp 时回退 event.timestamp',
      (WidgetTester tester) async {
    final DateTime now = DateTime(2026, 5, 19, 12, 0, 0);
    final WhaleEvent event = _ev(
      ts: now.subtract(const Duration(hours: 3)),
    );
    await _pump(
      tester,
      QzWhaleRow(event: event, now: now),
    );

    expect(find.text('3 小时前'), findsOneWidget);
  });

  testWidgets('displayTimestamp 指向 just now 边界',
      (WidgetTester tester) async {
    final DateTime now = DateTime(2026, 5, 19, 12, 0, 0);
    final WhaleEvent event = _ev(ts: DateTime(2024, 1, 1));
    await _pump(
      tester,
      QzWhaleRow(
        event: event,
        now: now,
        displayTimestamp: now.subtract(const Duration(seconds: 10)),
      ),
    );

    expect(find.text('刚刚'), findsOneWidget);
    expect(find.textContaining('天前'), findsNothing);
  });

  test('formatRelativeTime 纯函数边界覆盖', () {
    final DateTime now = DateTime(2026, 5, 19, 12, 0, 0);
    expect(QzWhaleRow.formatRelativeTime(now, now), 'just now');
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(minutes: 5)),
        now,
      ),
      '5m ago',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(hours: 3)),
        now,
      ),
      '3h ago',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(days: 2)),
        now,
      ),
      '2d ago',
    );
  });

  test('formatAmountUsd 三档边界', () {
    expect(QzWhaleRow.formatAmountUsd(500), '\$500');
    expect(QzWhaleRow.formatAmountUsd(12_500), '\$13K');
    expect(QzWhaleRow.formatAmountUsd(12_500_000), '\$12.50M');
  });

  test('formatWinRate 整数百分比 (issue #1983)', () {
    expect(QzWhaleRow.formatWinRate(85), '85%');
    expect(QzWhaleRow.formatWinRate(49.6), '50%');
    expect(QzWhaleRow.formatWinRate(0), '0%');
    expect(QzWhaleRow.formatWinRate(100), '100%');
  });

  test('winRateColor 三档阈值着色 绿≥70 / 橙≥50 / 红<50 (issue #1983)', () {
    final QzColorScheme c = qzColors(QzBg.dark, QzAccent.violet);
    // 边界与档内取值
    expect(QzWhaleRow.winRateColor(70, c), c.statusOk);
    expect(QzWhaleRow.winRateColor(85, c), c.statusOk);
    expect(QzWhaleRow.winRateColor(50, c), c.statusWarn);
    expect(QzWhaleRow.winRateColor(69.9, c), c.statusWarn);
    expect(QzWhaleRow.winRateColor(49.9, c), c.statusDanger);
    expect(QzWhaleRow.winRateColor(0, c), c.statusDanger);
  });

  testWidgets('行卡渲染胜率列文本 (issue #1983)', (WidgetTester tester) async {
    final DateTime now = DateTime(2026, 5, 19, 12, 0, 0);
    await _pump(
      tester,
      QzWhaleRow(
        event: _ev(ts: now.subtract(const Duration(minutes: 1)), winRate: 73),
        now: now,
      ),
    );
    expect(find.text('73%'), findsOneWidget);
  });
}

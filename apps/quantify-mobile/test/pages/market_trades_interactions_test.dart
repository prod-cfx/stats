import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/trade_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/widgets/trades_panel.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

List<Trade> _trades() {
  final DateTime base = DateTime(2026, 1, 1, 12);
  return <Trade>[
    Trade(time: base, price: 100, qty: 0.05, isBuy: true),
    Trade(time: base.subtract(const Duration(seconds: 1)), price: 101, qty: 0.5, isBuy: false),
    Trade(time: base.subtract(const Duration(seconds: 2)), price: 99, qty: 0.4, isBuy: true),
    Trade(time: base.subtract(const Duration(seconds: 3)), price: 102, qty: 0.02, isBuy: false),
  ];
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(
        body: SingleChildScrollView(
          child: TradesPanel(symbol: 'BTCUSDT', mid: 100, trades: _trades()),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('filterBigTrades', () {
    test('只保留 qty >= 阈值', () {
      final List<Trade> big = filterBigTrades(_trades());
      expect(big.length, 2); // 0.5 + 0.4
      expect(big.every((Trade t) => t.qty >= kBigTradeQtyThreshold), isTrue);
    });
  });

  group('sortTrades', () {
    test('默认按时间倒序', () {
      final List<Trade> out = sortTrades(_trades(), byQty: false);
      expect(out.first.time.isAfter(out.last.time), isTrue);
    });

    test('byQty 按数量降序', () {
      final List<Trade> out = sortTrades(_trades(), byQty: true);
      expect(out.first.qty, 0.5);
      expect(out.last.qty, 0.02);
    });
  });

  testWidgets('默认最新成交显示全部行，切大额成交行数减少', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.text('最新成交'), findsOneWidget);
    expect(find.text('大额成交'), findsOneWidget);

    // 最新：4 行（数量 0.05/0.5/0.4/0.02 各一行，价格 4 列）
    expect(find.text('0.0500'), findsOneWidget);
    expect(find.text('0.0200'), findsOneWidget);

    await tester.tap(find.text('大额成交'));
    await tester.pump();
    // 大额：仅 0.5 / 0.4 两行；小额 0.05 / 0.02 不再出现
    expect(find.text('0.5000'), findsOneWidget);
    expect(find.text('0.4000'), findsOneWidget);
    expect(find.text('0.0500'), findsNothing);
    expect(find.text('0.0200'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('点击排序按钮切换排序且不抛异常', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byTooltip('排序'));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}

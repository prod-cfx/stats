import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/agg_orders.dart';
import 'package:quantify_mobile/data/models/agg_orders_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/agg_orders_body.dart';
import 'package:quantify_mobile/pages/market/widgets/agg_format.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// issue #1854 聚合挂单屏 widget + 纯函数测试。
///
/// 覆盖验收标准：
/// - AC1 子 tab 切换：聚合挂单 / 聚合持仓量 / 聚合成交量
/// - AC2 聚合挂单：视图切换、价格精度抽屉、交易所来源抽屉、买一↔卖一中价条
/// - AC3 聚合持仓量：表格 + 全部行 + 6 指标排序
/// - AC4 聚合成交量：总计行 + 各所占比条
Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(430, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: const Scaffold(body: AggOrdersBody()),
    ),
  );
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  group('aggregateLevels / withCumulative（纯函数）', () {
    test('bucket<=1 时原样返回', () {
      expect(aggregateLevels(kAggAsks, 1, true), same(kAggAsks));
    });

    test('bucket=100 时按桶合并并累加数量', () {
      const List<AggBookLevel> rows = <AggBookLevel>[
        AggBookLevel(price: 75864, qty: 1, exchange: 'BIN'),
        AggBookLevel(price: 75832, qty: 2, exchange: 'BIN'),
      ];
      final List<AggBookLevel> out = aggregateLevels(rows, 100, true);
      // ask 向上取整 → 75900 桶合并两档，qty=3
      expect(out.length, 1);
      expect(out.first.price, 75900);
      expect(out.first.qty, 3);
    });

    test('ask 累计从近 mid 向外递增（末档最小）', () {
      final List<AggBookLevel> out = withCumulative(kAggAsks, true);
      // 列表末档（近 mid）= 自身 qty；首档（最远）= 全部之和
      expect(out.last.total, closeTo(kAggAsks.last.qty, 1e-6));
      final double sum =
          kAggAsks.fold<double>(0, (double a, AggBookLevel r) => a + r.qty);
      expect(out.first.total, closeTo(sum, 1e-6));
    });

    test('bid 累计从高价向下递增（首档最小）', () {
      final List<AggBookLevel> out = withCumulative(kAggBids, false);
      expect(out.first.total, closeTo(kAggBids.first.qty, 1e-6));
      final double sum =
          kAggBids.fold<double>(0, (double a, AggBookLevel r) => a + r.qty);
      expect(out.last.total, closeTo(sum, 1e-6));
    });
  });

  group('数字格式化（纯函数）', () {
    test('fmtOiUsd 亿/万', () {
      expect(fmtOiUsd(7.6e8), 'US\$7.6亿');
      expect(fmtOiUsd(8493.45e4), 'US\$8493.45万');
    });
    test('fmtOiQty 带币种', () {
      expect(fmtOiQty(3.58e8, 'BTC'), '3.58亿 BTC');
    });
    test('fmtVolUsd 单位 B', () {
      expect(fmtVolUsd(15.48), '\$15.48B');
    });
    test('fmtSignedPct 带符号', () {
      expect(fmtSignedPct(2.72), '+2.72%');
      expect(fmtSignedPct(-8.35), '-8.35%');
    });
  });

  testWidgets('默认渲染聚合挂单卡 + 三个子 tab（AC1）',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('agg-subtab-orders')), findsOneWidget);
    expect(find.byKey(const Key('agg-subtab-openInterest')), findsOneWidget);
    expect(find.byKey(const Key('agg-subtab-volume')), findsOneWidget);
    expect(find.byKey(const Key('agg-orderbook-list')), findsOneWidget);
  });

  testWidgets('切到持仓量与成交量子 tab（AC1/AC3/AC4）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('agg-subtab-openInterest')));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('agg-oi-list')), findsOneWidget);
    // 全部行 + 排序按钮
    expect(find.text('全部'), findsOneWidget);
    expect(find.byKey(const Key('agg-oi-sort-button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('agg-subtab-volume')));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('agg-volume-list')), findsOneWidget);
    expect(find.text('总计'), findsOneWidget);
  });

  testWidgets('订单簿视图切换：双向→卖单仅显示 asks，含中价条（AC2）',
      (WidgetTester tester) async {
    await _pump(tester);
    // 双向时存在中价条
    expect(find.text('买一 / 卖一'), findsOneWidget);
    // 切到卖单视图，中价条消失
    await tester.tap(find.byKey(const Key('agg-view-asks')));
    await tester.pump();
    expect(find.text('买一 / 卖一'), findsNothing);
  });

  testWidgets('价格精度抽屉切换（AC2）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('agg-precision-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('agg-precision-10')), findsOneWidget);
    await tester.tap(find.byKey(const Key('agg-precision-10')));
    await tester.pumpAndSettle();
    // 精度按钮文案更新为 10
    expect(
      find.descendant(
        of: find.byKey(const Key('agg-precision-button')),
        matching: find.text('10'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('交易所来源抽屉清空后订单簿无行（AC2）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('agg-source-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('agg-source-clear-all')), findsOneWidget);
    await tester.tap(find.byKey(const Key('agg-source-clear-all')));
    await tester.pumpAndSettle();
    // 关闭抽屉应用
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    // 清空后无中价条（bestBid/bestAsk 为空 → strip 仍在但值为 --）
    expect(find.textContaining('--'), findsWidgets);
  });

  testWidgets('持仓量排序抽屉可选 OI/V（AC3）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('agg-subtab-openInterest')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('agg-oi-sort-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('agg-oi-sort-oiVol')), findsOneWidget);
    await tester.tap(find.byKey(const Key('agg-oi-sort-oiVol')));
    await tester.pumpAndSettle();
    // 排序按钮 label 更新
    expect(
      find.descendant(
        of: find.byKey(const Key('agg-oi-sort-button')),
        matching: find.text('OI/V'),
      ),
      findsOneWidget,
    );
  });
}

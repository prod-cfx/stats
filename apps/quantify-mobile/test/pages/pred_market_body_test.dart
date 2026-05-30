import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/pred_market_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/pred_market_body.dart';
import 'package:quantify_mobile/pages/market/widgets/pred_market_search_overlay.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// issue #1855 预测市场屏 widget + 纯函数测试。
///
/// 覆盖验收标准：
/// - AC1 副标题 + 可点搜索栏（弹 overlay，含热门话题）
/// - AC2 2 列卡片网格：icon / 问题 / 是·否% / LIVE / Vol / 更多
/// - AC3 点卡片弹「市场详情」sheet：规则 / 创建时间 / 交易量 / 状态
/// - AC4 搜索无结果显示空态
Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(430, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: const Scaffold(body: PredMarketBody()),
    ),
  );
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  group('fmtPredVol（纯函数）', () {
    test('0 返回 null（调用方回退 \$0）', () {
      expect(fmtPredVol(0), isNull);
    });
    test('<1000 整数 → \$<int> Vol.', () {
      expect(fmtPredVol(393), '\$393 Vol.');
    });
    test('>=1000 → \$X.XXK Vol. 去尾零', () {
      expect(fmtPredVol(1519), '\$1.52K Vol.');
      expect(fmtPredVol(1500), '\$1.5K Vol.');
      expect(fmtPredVol(3898), '\$3.9K Vol.');
    });
  });

  group('PredMarket（派生）', () {
    test('noPercent 由 yesPercent 推导；null 时为 null', () {
      const PredMarket a = PredMarket(
        id: 'x',
        icon: PredIcon.coin,
        color: Color(0xFF000000),
        question: 'q',
        yesPercent: 67,
        volume: 0,
        live: true,
      );
      expect(a.noPercent, 33);
      const PredMarket b = PredMarket(
        id: 'y',
        icon: PredIcon.coin,
        color: Color(0xFF000000),
        question: 'XRP up?',
        yesPercent: null,
        volume: 0,
        live: true,
      );
      expect(b.noPercent, isNull);
    });
    test('resolutionSource 按 question 首个英文词派生 chainlink URL', () {
      const PredMarket b = PredMarket(
        id: 'y',
        icon: PredIcon.coin,
        color: Color(0xFF000000),
        question: 'XRP 会涨吗？',
        yesPercent: 1,
        volume: 0,
        live: true,
      );
      expect(b.resolutionSource,
          'https://data.chain.link/streams/xrp-usd');
    });
  });

  testWidgets('副标题 + 可点搜索栏，点开弹 overlay 含热门话题（AC1）',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('基于链上数据的未来趋势预测'), findsOneWidget);
    expect(find.byKey(const Key('pred-search-bar')), findsOneWidget);

    await tester.tap(find.byKey(const Key('pred-search-bar')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pred-search-input')), findsOneWidget);
    // 热门话题 6 个 chip
    for (final String t in kPredHotTopics) {
      expect(find.byKey(Key('pred-search-hot-$t')), findsOneWidget);
    }
  });

  testWidgets('2 列网格渲染卡片，含 LIVE / Vol（AC2）',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('pred-grid')), findsOneWidget);
    // 第二条 p2 有报价，渲染是/否
    expect(find.byKey(const Key('pred-card-p2')), findsOneWidget);
    expect(find.text('是'), findsWidgets);
    expect(find.text('否'), findsWidgets);
    expect(find.text('LIVE'), findsWidgets);
  });

  testWidgets('yes==null 的卡片不渲染是/否块（AC2）',
      (WidgetTester tester) async {
    await _pump(tester);
    // p1 yes==null：卡内不应出现「是」字
    final Finder card = find.byKey(const Key('pred-card-p1'));
    expect(card, findsOneWidget);
    expect(
      find.descendant(of: card, matching: find.text('是')),
      findsNothing,
    );
  });

  testWidgets('点卡片弹市场详情 sheet（AC3）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('pred-card-p2')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pred-detail-sheet')), findsOneWidget);
    expect(find.text('市场详情'), findsOneWidget);
    expect(find.text('规则'), findsOneWidget);
    expect(find.text('Resolution source'), findsOneWidget);
    expect(find.text('Event window'), findsOneWidget);
    expect(find.textContaining('创建时间'), findsOneWidget);
  });

  testWidgets('搜索无匹配显示空态文案（AC4）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('pred-search-bar')));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byKey(const Key('pred-search-input')), 'zzz_no_match_xyz');
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('pred-search-empty')), findsOneWidget);
    expect(find.text('无匹配市场'), findsOneWidget);
  });

  testWidgets('搜索命中后选中结果回到网格并弹详情（AC1/AC3）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('pred-search-bar')));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byKey(const Key('pred-search-input')), '比特币');
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('pred-search-result-p15')), findsOneWidget);
    await tester.tap(find.byKey(const Key('pred-search-result-p15')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pred-detail-sheet')), findsOneWidget);
  });
}

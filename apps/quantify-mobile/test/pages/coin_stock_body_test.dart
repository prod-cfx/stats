import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/coin_stock_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/coin_stock_body.dart';
import 'package:quantify_mobile/pages/market/widgets/coin_stock_card.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// issue #1856 币股屏 widget + 纯函数测试。
///
/// 覆盖验收标准：
/// - AC1 类型 tab（全部/BTC/ETH/其他）+ 搜索（弹 overlay，含热门标的）
/// - AC2 排序按钮 + 「筛选&排序」sheet（指标 pills + 升序/降序/不排序）
/// - AC3 公司卡：代码 + 名称 + 股价 + 涨跌 badge + 4 项 stats
/// - AC4 公司详情 sheet：股价卡 / 概况 / chips / 核心指标网格
/// - AC5 列表无匹配显示空态文案

const List<CoinStock> _fixtures = <CoinStock>[
  CoinStock(
    coin: 'BTC',
    sym: 'MSTR',
    cn: 'Strategy',
    ex: 'MSTR 美股-NASDAQ',
    mnav: '1.842',
    mcap: '42.18 B',
    holdV: '39.66 B',
    holdQ: '580.25 K',
    hold: 'BTC',
    px: '412.80',
    ch: '+3.42%',
    up: true,
    biz: 'BI 软件 → BTC 财库',
    hq: 'Tysons Corner',
    listed: '1998',
    intro: '前身 MicroStrategy。',
  ),
  CoinStock(
    coin: 'ETH',
    sym: 'HOOD',
    cn: 'Robinhood Markets',
    ex: 'HOOD 美股-NASDAQ',
    mnav: '5.4622',
    mcap: '51.51 B',
    holdV: '9.44 B',
    holdQ: '140.57 K',
    hold: 'BTC',
    px: '66.55',
    ch: '+0.80%',
    up: true,
    biz: '零佣金券商 + 加密',
    hq: 'Menlo Park',
    listed: '2021',
    intro: '美国主要零佣金券商。',
  ),
  CoinStock(
    coin: 'DOGE',
    sym: 'TSLA',
    cn: 'Tesla, Inc.',
    ex: 'TSLA 美股-NASDAQ',
    mnav: '1,523.42',
    mcap: '1,174.95 B',
    holdV: '772.49 M',
    holdQ: '11.51 K',
    hold: 'BTC',
    px: '364.89',
    ch: '-0.87%',
    up: false,
    biz: '电动车 / 能源',
    hq: 'Austin',
    listed: '2010',
    intro: 'Tesla 披露 BTC 持仓。',
  ),
];

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(430, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: const Scaffold(body: CoinStockBody(stocks: _fixtures)),
    ),
  );
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  group('parseStockNum（纯函数）', () {
    test('带 B/M/K 单位与千分位', () {
      expect(parseStockNum('2,370.17 B'), closeTo(2.37017e12, 1));
      expect(parseStockNum('772.49 M'), closeTo(7.7249e8, 1));
      expect(parseStockNum('580.25 K'), closeTo(580250, 1));
    });
    test('无单位与无法解析回退', () {
      expect(parseStockNum('296.00'), 296);
      expect(parseStockNum('--'), 0);
    });
  });

  group('CoinStockSort.valueOf', () {
    test('mcap 走 parseStockNum；ch 走带符号百分比', () {
      const CoinStock a = CoinStock(
        coin: 'BTC',
        sym: 'A',
        cn: 'a',
        ex: 'e',
        mnav: '1',
        mcap: '2 B',
        holdV: '1',
        holdQ: '1',
        hold: 'BTC',
        px: '1',
        ch: '-5.00%',
        up: false,
        biz: '',
        hq: '',
        listed: '',
        intro: '',
      );
      expect(CoinStockSort.mcap.valueOf(a), 2e9);
      expect(CoinStockSort.ch.valueOf(a), -5);
    });
  });

  testWidgets('类型 tab 渲染 + 切 ETH 过滤（AC1）', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('coin-stock-tab-all')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-tab-btc')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-tab-eth')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-tab-other')), findsOneWidget);

    // 全部：3 张卡。
    expect(find.byType(CoinStockCard), findsNWidgets(3));

    // 切 ETH → 仅 HOOD。
    await tester.tap(find.byKey(const Key('coin-stock-tab-eth')));
    await tester.pump();
    expect(find.byType(CoinStockCard), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-card-HOOD')), findsOneWidget);

    // 切「其他」→ 仅 TSLA（DOGE）。
    await tester.tap(find.byKey(const Key('coin-stock-tab-other')));
    await tester.pump();
    expect(find.byKey(const Key('coin-stock-card-TSLA')), findsOneWidget);
  });

  testWidgets('点搜索按钮弹 overlay，含热门标的（AC1）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-search-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('coin-stock-search-input')), findsOneWidget);
    // 热门标的 chip（取前 8 sym，fixtures 仅 3 个）。
    expect(find.byKey(const Key('coin-stock-search-hot-MSTR')), findsOneWidget);
    // 输入 HOOD → 命中结果行。
    await tester.enterText(
      find.byKey(const Key('coin-stock-search-input')),
      'HOOD',
    );
    await tester.pump();
    expect(
      find.byKey(const Key('coin-stock-search-result-HOOD')),
      findsOneWidget,
    );
  });

  testWidgets('搜索 overlay 空查询态对齐共享 SearchOverlay（#2047）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-search-button')));
    await tester.pumpAndSettle();

    expect(find.text('热门标的'), findsOneWidget);
    final Text hotTitle = tester.widget<Text>(find.text('热门标的'));
    expect(hotTitle.style?.fontSize, 14);
    expect(hotTitle.style?.fontWeight, FontWeight.w600);
    expect(hotTitle.style?.color, qzColors(QzBg.light, QzAccent.violet).text);

    expect(find.text('搜索历史'), findsOneWidget);
    expect(
      find.byKey(const Key('coin-stock-search-clear-history')),
      findsOneWidget,
    );
    for (final String sym in <String>['MSTR', 'HOOD', 'TSLA']) {
      expect(find.byKey(Key('coin-stock-search-history-$sym')), findsOneWidget);
    }

    final Container hotChip = tester.widget<Container>(
      find.descendant(
        of: find.byKey(const Key('coin-stock-search-hot-MSTR')),
        matching: find.byType(Container),
      ),
    );
    final BoxDecoration chipDecoration = hotChip.decoration! as BoxDecoration;
    expect(hotChip.constraints?.minWidth, 62);
    expect(
      chipDecoration.color,
      qzColors(QzBg.light, QzAccent.violet).accentSoft,
    );
    final Text hotChipText = tester.widget<Text>(
      find.descendant(
        of: find.byKey(const Key('coin-stock-search-hot-MSTR')),
        matching: find.text('MSTR'),
      ),
    );
    expect(
      hotChipText.style?.color,
      qzColors(QzBg.light, QzAccent.violet).text,
    );
  });

  testWidgets('搜索结果行对齐共享 SearchResultRow（#2047）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-search-button')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('coin-stock-search-input')),
      'MSTR',
    );
    await tester.pump();

    final Finder row = find.byKey(const Key('coin-stock-search-result-MSTR'));
    expect(row, findsOneWidget);
    expect(find.text('\$412.80'), findsNothing);
    expect(find.text('412.80'), findsOneWidget);

    final Finder avatarFinder = find.descendant(
      of: row,
      matching: find.byKey(const Key('coin-stock-search-avatar-MSTR')),
    );
    final Container avatar = tester.widget<Container>(avatarFinder);
    final BoxDecoration avatarDecoration = avatar.decoration! as BoxDecoration;
    expect(tester.getSize(avatarFinder), const Size(28, 28));
    expect(avatarDecoration.shape, BoxShape.circle);
    expect(
      find.descendant(
        of: row,
        matching: find.byKey(const Key('coin-stock-search-title-sub-MSTR')),
      ),
      findsOneWidget,
      reason: 'title + sub 应合并为单行富文本',
    );
  });

  testWidgets('搜索 icon 叠放在 tab 条右缘并带渐隐遮罩（#2048）', (WidgetTester tester) async {
    await _pump(tester);
    expect(
      find.byKey(const Key('coin-stock-tabs-search-stack')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('coin-stock-tabs-fade-search')),
      findsOneWidget,
    );
  });

  testWidgets('排序 sheet：指标 pills + 三向方向，应用后重排（AC2）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-sort-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('coin-stock-sort-sheet')), findsOneWidget);
    // 指标 pills + 方向按钮存在。
    expect(find.byKey(const Key('coin-stock-sort-metric-px')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-sort-dir-asc')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-sort-dir-desc')), findsOneWidget);
    expect(find.byKey(const Key('coin-stock-sort-dir-none')), findsOneWidget);

    // 选股价升序 → 应用。
    await tester.tap(find.byKey(const Key('coin-stock-sort-metric-px')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('coin-stock-sort-dir-asc')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('coin-stock-sort-confirm')));
    await tester.pumpAndSettle();

    // 升序股价：HOOD(66.55) < TSLA(364.89) < MSTR(412.80)，首张应为 HOOD。
    final CoinStockCard first = tester.widget<CoinStockCard>(
      find.byType(CoinStockCard).first,
    );
    expect(first.stock.sym, 'HOOD');
  });

  testWidgets('公司卡展示代码/名称/股价/涨跌/stats（AC3）', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('MSTR'), findsWidgets);
    expect(find.text('Strategy'), findsOneWidget);
    expect(find.text('\$412.80'), findsOneWidget);
    expect(find.text('+3.42%'), findsOneWidget);
    // stats label。
    expect(find.text('MNAV'), findsWidgets);
    expect(find.text('市值'), findsWidgets);
  });

  testWidgets('公司卡 stats 顶部分隔线使用虚线 painter（#2048）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(
      find.byKey(const Key('coin-stock-card-stats-dash-MSTR')),
      findsOneWidget,
    );
  });

  testWidgets('点卡片弹公司详情 sheet（AC4）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-card-MSTR')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('coin-stock-detail-sheet')), findsOneWidget);
    expect(find.text('公司概况'), findsOneWidget);
    expect(find.text('核心指标'), findsOneWidget);
    expect(find.text('前身 MicroStrategy。'), findsOneWidget);
  });

  testWidgets('搜索无匹配显示空态（AC5）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('coin-stock-search-button')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('coin-stock-search-input')),
      'ZZZZ',
    );
    await tester.pump();
    expect(find.byKey(const Key('coin-stock-search-empty')), findsOneWidget);
  });
}

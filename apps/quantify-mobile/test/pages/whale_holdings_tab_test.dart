import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_holdings.dart';
import 'package:quantify_mobile/data/models/whale_holding_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_holdings_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_holdings_tab.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_holding_card.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _FakeHoldingsRepo implements WhaleHoldingsRepository {
  @override
  Future<List<WhaleHoldingPosition>> getHoldings() async => mockWhaleHoldings;
}

/// 当前渲染的持仓卡地址顺序。
List<String> _cardAddresses(WidgetTester tester) {
  return tester
      .widgetList<WhaleHoldingCard>(find.byType(WhaleHoldingCard))
      .map((WhaleHoldingCard w) => w.entry.address)
      .toList();
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 4200));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        whaleHoldingsRepositoryProvider.overrideWithValue(_FakeHoldingsRepo()),
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
}

void main() {
  group('筛选纯函数', () {
    test('空筛选返回原序副本，不改入参', () {
      final List<WhaleHoldingPosition> out =
          filterWhaleHoldings(mockWhaleHoldings, const WhaleHoldingFilter());
      expect(out.length, mockWhaleHoldings.length);
      expect(out.map((WhaleHoldingPosition e) => e.address),
          mockWhaleHoldings.map((WhaleHoldingPosition e) => e.address));
    });

    test('币种筛选：仅保留对应 symbol', () {
      final List<WhaleHoldingPosition> out = filterWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingFilter(coin: 'BTC'),
      );
      expect(out, isNotEmpty);
      expect(out.every((WhaleHoldingPosition e) => e.symbol == 'BTC'), isTrue);
    });

    test('方向筛选：做空仅保留 short', () {
      final List<WhaleHoldingPosition> out = filterWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingFilter(dir: WhaleHoldingDirFilter.short),
      );
      expect(out, isNotEmpty);
      expect(out.every((WhaleHoldingPosition e) => !e.isLong), isTrue);
    });

    test('盈亏筛选：亏损仅保留 pnl<0', () {
      final List<WhaleHoldingPosition> out = filterWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingFilter(pnl: WhaleHoldingPnlFilter.loss),
      );
      expect(out, isNotEmpty);
      expect(out.every((WhaleHoldingPosition e) => e.pnl < 0), isTrue);
    });

    test('组合筛选：BTC + 做多 + 盈利', () {
      final List<WhaleHoldingPosition> out = filterWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingFilter(
          coin: 'BTC',
          dir: WhaleHoldingDirFilter.long,
          pnl: WhaleHoldingPnlFilter.profit,
        ),
      );
      expect(
        out.every((WhaleHoldingPosition e) =>
            e.symbol == 'BTC' && e.isLong && e.isProfit),
        isTrue,
      );
    });

    test('无匹配组合返回空表', () {
      // HYPE 仅有一条 long/profit；HYPE + short 应为空。
      final List<WhaleHoldingPosition> out = filterWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingFilter(
          coin: 'HYPE',
          dir: WhaleHoldingDirFilter.short,
        ),
      );
      expect(out, isEmpty);
    });
  });

  group('排序纯函数', () {
    test('sort=null 返回原序副本，不改入参', () {
      final List<WhaleHoldingPosition> out =
          sortWhaleHoldings(mockWhaleHoldings, null);
      expect(out.map((WhaleHoldingPosition e) => e.address),
          mockWhaleHoldings.map((WhaleHoldingPosition e) => e.address));
      expect(identical(out, mockWhaleHoldings), isFalse);
    });

    test('持仓价值降序：首条为最大 value', () {
      final List<WhaleHoldingPosition> out = sortWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingSort(
          key: WhaleHoldingSortKey.value,
          dir: WhaleHoldingSortDir.desc,
        ),
      );
      final double maxVal = mockWhaleHoldings
          .map((WhaleHoldingPosition e) => e.value)
          .reduce((double a, double b) => a > b ? a : b);
      expect(out.first.value, maxVal);
    });

    test('保证金升序：首条为最小 margin', () {
      final List<WhaleHoldingPosition> out = sortWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingSort(
          key: WhaleHoldingSortKey.margin,
          dir: WhaleHoldingSortDir.asc,
        ),
      );
      final double minMargin = mockWhaleHoldings
          .map((WhaleHoldingPosition e) => e.margin)
          .reduce((double a, double b) => a < b ? a : b);
      expect(out.first.margin, minMargin);
    });

    test('创建时间降序：首条为最大 hoursAgo', () {
      final List<WhaleHoldingPosition> out = sortWhaleHoldings(
        mockWhaleHoldings,
        const WhaleHoldingSort(
          key: WhaleHoldingSortKey.time,
          dir: WhaleHoldingSortDir.desc,
        ),
      );
      final int maxHours = mockWhaleHoldings
          .map((WhaleHoldingPosition e) => e.hoursAgo)
          .reduce((int a, int b) => a > b ? a : b);
      expect(out.first.hoursAgo, maxHours);
    });

    test('whaleHoldingCoins 去重保序', () {
      final List<String> coins = whaleHoldingCoins(mockWhaleHoldings);
      expect(coins, <String>['ETH', 'BTC', 'HYPE']);
    });
  });

  group('持仓 tab 渲染与交互', () {
    testWidgets('持仓明细卡渲染含设计稿字段', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(WhaleHoldingCard), findsWidgets);
      // 列名覆盖：持仓价值 / 未实现盈亏 / 保证金 / 开盘价 / 清算价。
      expect(find.text('持仓价值'), findsWidgets);
      expect(find.text('未实现盈亏'), findsWidgets);
      expect(find.text('保证金'), findsWidgets);
      expect(find.text('开盘价'), findsWidgets);
      expect(find.text('清算价'), findsWidgets);
    });

    testWidgets('币种 chip 即时过滤列表', (WidgetTester tester) async {
      await _pump(tester);
      final int total = _cardAddresses(tester).length;
      expect(total, mockWhaleHoldings.length);

      await tester.tap(find.widgetWithText(GestureDetector, 'BTC').first);
      await tester.pump();

      final List<String> btcOnly = _cardAddresses(tester);
      final int btcCount = mockWhaleHoldings
          .where((WhaleHoldingPosition e) => e.symbol == 'BTC')
          .length;
      expect(btcOnly.length, btcCount);
      expect(btcOnly.length, lessThan(total));
    });

    testWidgets('方向筛选 chip 循环过滤为做空', (WidgetTester tester) async {
      await _pump(tester);
      final Finder dirPill = find.byKey(const Key('whaleHoldingsDirFilter'));
      // 点一次：全部 → 做多。
      await tester.tap(dirPill);
      await tester.pump();
      // 再点一次：做多 → 做空。
      await tester.tap(dirPill);
      await tester.pump();

      expect(find.text('做空'), findsWidgets);
      final List<String> shortAddrs = _cardAddresses(tester);
      final Set<String> shortSet = mockWhaleHoldings
          .where((WhaleHoldingPosition e) => !e.isLong)
          .map((WhaleHoldingPosition e) => e.address)
          .toSet();
      expect(shortAddrs.toSet(), shortSet);
    });

    testWidgets('选择「持仓价值」排序即时重排列表', (WidgetTester tester) async {
      await _pump(tester);
      final List<String> before = _cardAddresses(tester);
      expect(before, isNotEmpty);

      await tester.tap(find.text('排序'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('持仓价值').last);
      await tester.pumpAndSettle();

      final List<String> after = _cardAddresses(tester);
      // 持仓价值降序首卡应为最大 value 持仓（0xa5b0…1d41，1.55 亿）。
      expect(after.first, '0xa5b0…1d41');
    });
  });
}

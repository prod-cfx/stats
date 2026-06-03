import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/live_strategy_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/live/widgets/live_sparkline.dart';
import 'package:quantify_mobile/pages/live/widgets/live_strategy_card.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 构造一条用于卡片渲染断言的策略 fixture。
LiveStrategy _strategy({
  LiveStrategyStatus status = LiveStrategyStatus.running,
  double totalPnl = 1234.5,
  double winRate = 62,
  int trades = 48,
}) {
  return LiveStrategy(
    id: 'QF-TEST01',
    name: 'BTC 趋势 · 双均线',
    pair: 'BTC/USDT',
    timeframe: '15m',
    exchange: 'Binance',
    exchangeGlyph: 'B',
    market: '合约 5x',
    status: status,
    runFor: '14 天',
    todayPct: 1.2,
    todayPnl: 88.0,
    totalPct: totalPnl >= 0 ? 12.3 : -12.3,
    totalPnl: totalPnl,
    capital: 10000,
    trades: trades,
    winRate: winRate,
    spark: const <double>[100, 102, 101, 105, 108, 107, 112],
  );
}

Future<void> _pump(
  WidgetTester tester,
  LiveStrategy s, {
  VoidCallback? onTap,
  VoidCallback? onToggle,
  VoidCallback? onOpenMenu,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 800));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: Scaffold(
        body: ListView(
          children: <Widget>[
            LiveStrategyCard(
              strategy: s,
              onTap: onTap,
              onToggle: onToggle,
              onOpenMenu: onOpenMenu,
            ),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('perf 行渲染 sparkline', (WidgetTester tester) async {
    await _pump(tester, _strategy());
    expect(find.byType(LiveSparkline), findsOneWidget);
  });

  testWidgets('footer 展示 ID · 运行 · 笔数 · 胜率', (WidgetTester tester) async {
    await _pump(tester, _strategy(winRate: 62, trades: 48));
    // mono meta：胜率整数不带小数；footer 按设计稿拆成可换行片段。
    expect(find.text('QF-TEST01'), findsOneWidget);
    expect(find.text('运行 14 天'), findsOneWidget);
    expect(find.text('48 笔'), findsOneWidget);
    expect(find.text('胜率 62%'), findsOneWidget);
  });

  testWidgets('胜率含小数保留一位', (WidgetTester tester) async {
    await _pump(tester, _strategy(winRate: 58.5));
    expect(find.textContaining('胜率 58.5%'), findsOneWidget);
  });

  testWidgets('running 卡 footer 显示暂停按钮，点击触发 onToggle', (
    WidgetTester tester,
  ) async {
    bool toggled = false;
    await _pump(
      tester,
      _strategy(status: LiveStrategyStatus.running),
      onToggle: () => toggled = true,
    );
    await tester.tap(find.byKey(const Key('live-card-toggle')));
    await tester.pumpAndSettle();
    expect(toggled, isTrue);
  });

  testWidgets('菜单按钮点击触发 onOpenMenu', (WidgetTester tester) async {
    bool opened = false;
    await _pump(tester, _strategy(), onOpenMenu: () => opened = true);
    await tester.tap(find.byKey(const Key('live-card-menu')));
    await tester.pumpAndSettle();
    expect(opened, isTrue);
  });

  testWidgets('paused 卡 toggle 提示为开启语义', (WidgetTester tester) async {
    await _pump(tester, _strategy(status: LiveStrategyStatus.paused));
    final Tooltip tip = tester.widget<Tooltip>(
      find.descendant(
        of: find.byKey(const Key('live-card-toggle')),
        matching: find.byType(Tooltip),
      ),
    );
    expect(tip.message, '开启策略');
  });

  testWidgets('点击主体区触发 onTap', (WidgetTester tester) async {
    bool tapped = false;
    await _pump(tester, _strategy(), onTap: () => tapped = true);
    await tester.tap(find.text('BTC 趋势 · 双均线'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
  });
}

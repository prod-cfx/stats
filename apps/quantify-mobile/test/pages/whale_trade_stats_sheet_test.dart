import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_profiles.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_trade_stats_sheet.dart';
import 'package:quantify_mobile/theme/theme_context.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 交易统计弹窗守护测试（issue #1859）。
///
/// 用 trigger 按钮在 widget tree 内调用 `WhaleTradeStatsSheet.show`，让
/// `showModalBottomSheet` 在 `Navigator` 上挂载弹窗，再断言形态 / 切换 / 空态 / 色。
const String _knownAddress = '0x88e…3a01';

Future<void> _open(
  WidgetTester tester, {
  required WhaleTradeStats stats,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1200));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(
        body: Builder(
          builder: (BuildContext ctx) => Center(
            child: TextButton(
              onPressed: () => WhaleTradeStatsSheet.show(
                ctx,
                address: _knownAddress,
                stats: stats,
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

WhaleTradeStats _emptyStats() {
  return const WhaleTradeStats(
    pnlDisplay: r'$0',
    pnlTone: 'flat',
    winRatePct: 0,
    realizedDisplay: r'$0',
    unrealizedDisplay: r'$0',
    longPct: 0,
    shortPct: 0,
    assetPerf: <WhaleAssetPerf>[],
    tradesTotal: 0,
    wins: 0,
    losses: 0,
  );
}

void main() {
  testWidgets('独立唤起：渲染胜率卡 + 交易次数环图卡 + 双子 tab', (WidgetTester tester) async {
    final WhaleTradeStats s = mockWhaleProfiles[_knownAddress]!.stats;
    await _open(tester, stats: s);

    expect(find.byType(WhaleTradeStatsSheet), findsOneWidget);
    expect(find.text('胜率'), findsOneWidget);
    expect(find.text('交易次数'), findsWidgets);
    // 胜率两位小数（mono）。
    expect(find.text('${s.winRatePct.toStringAsFixed(2)}%'), findsOneWidget);
    // 环图中心总笔数 = wins + losses。
    expect(find.text('${(s.wins ?? 0) + (s.losses ?? 0)}'), findsWidgets);
    // 双子 tab。
    expect(find.text('按资产的表现'), findsOneWidget);
    expect(find.text('按仓位的表现'), findsOneWidget);
  });

  testWidgets('双子 tab 切换：默认按资产，切到按仓位后展示仓位行', (WidgetTester tester) async {
    final WhaleTradeStats s = mockWhaleProfiles[_knownAddress]!.stats;
    await _open(tester, stats: s);

    // 默认按资产：首个资产名可见。
    expect(find.text(s.assetPerf.first.symbol), findsWidgets);

    await tester.tap(find.text('按仓位的表现'));
    await tester.pumpAndSettle();

    // 切换后展示仓位名（label ?? sym）。
    final WhalePositionPerf pos = s.positionPerf.first;
    expect(find.text(pos.label ?? pos.sym), findsWidgets);
  });

  testWidgets('周期 PillSelect 可切换：默认 1周，点 1天后高亮', (WidgetTester tester) async {
    final WhaleTradeStats s = mockWhaleProfiles[_knownAddress]!.stats;
    await _open(tester, stats: s);

    expect(find.text('1天'), findsOneWidget);
    final Text before = tester.widget<Text>(find.text('1天'));
    expect(before.style?.fontWeight, FontWeight.w500);

    await tester.tap(find.text('1天'));
    await tester.pumpAndSettle();

    final Text after = tester.widget<Text>(find.text('1天'));
    expect(after.style?.fontWeight, FontWeight.w700);
  });

  testWidgets('空态：成交为 0 显示「暂无成交记录」且无 PerfRow', (WidgetTester tester) async {
    await _open(tester, stats: _emptyStats());

    expect(find.text('暂无成交记录'), findsOneWidget);
    // 0.00% 胜率仍渲染卡片。
    expect(find.text('0.00%'), findsOneWidget);
  });

  testWidgets('金额正负色：正盈亏 up 色 / 负盈亏 dn 色', (WidgetTester tester) async {
    final WhaleTradeStats s = mockWhaleProfiles[_knownAddress]!.stats;
    await _open(tester, stats: s);

    final BuildContext ctx = tester.element(find.byType(WhaleTradeStatsSheet));
    final upColor = ctx.qzScheme.marketUp;
    final dnColor = ctx.qzScheme.marketDown;

    // 取一个正盈亏资产与一个负盈亏资产，断言其头部净盈亏文本颜色。
    final WhaleAssetPerf posAsset =
        s.assetPerf.firstWhere((WhaleAssetPerf a) => a.positive == true);
    final WhaleAssetPerf negAsset =
        s.assetPerf.firstWhere((WhaleAssetPerf a) => a.positive == false);

    final Text posText = tester.widget<Text>(
      find.text('\$ +${posAsset.pnlDisplay}').first,
    );
    final Text negText = tester.widget<Text>(
      find.text('\$ −${negAsset.pnlDisplay}').first,
    );
    expect(posText.style?.color, upColor);
    expect(negText.style?.color, dnColor);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/market/data_hub_page.dart';
import 'package:quantify_mobile/pages/market/long_short_page.dart';
import 'package:quantify_mobile/pages/market/widgets/data_hub_header.dart';
import 'package:quantify_mobile/pages/market/widgets/long_short_bar.dart';
import 'package:quantify_mobile/router/app_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 多空比深链与主体测试（#1853）。
///
/// #1853 后多空比不再有独立 QzTopBar 包装层：`/market/long-short` 渲染
/// 「数据」hub 并预选多空比 tab，顶部统一为 DataHubHeader。
Future<void> _pumpBody(
  WidgetTester tester, {
  QzTheme theme = QzTheme.fallback,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1200));
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        home: const Scaffold(body: LongShortBody()),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  testWidgets('/market/long-short 深链预选多空比 tab（顶部为 hub header）', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.binding.setSurfaceSize(const Size(420, 1200));
    final GoRouter router = buildRouter();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: MaterialApp.router(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(QzTheme.fallback),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    router.go('/market/long-short');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    // 渲染 hub（含统一 header）而非旧 standalone 标题栏，多空比 tab 选中。
    expect(find.byType(DataHubPage), findsOneWidget);
    expect(find.byKey(const Key('data-hub-notification-bell')), findsOneWidget);
    expect(find.byType(LongShortBody), findsOneWidget);
    expect(find.byType(LongShortBar), findsWidgets);
    final DataHubPage page = tester.widget<DataHubPage>(
      find.byType(DataHubPage),
    );
    expect(page.initial, DataHubScreen.longShort);
  });

  testWidgets('LongShortBody 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pumpBody(
          tester,
          theme: QzTheme(bg: bg, accent: accent),
        );
        expect(find.byType(LongShortBar), findsWidgets);
        expect(tester.takeException(), isNull);
      }
    }
  });

  testWidgets('LongShortBody 对齐设计稿骨架：chip、标题、周期抽屉、无刷新和历史', (
    WidgetTester tester,
  ) async {
    await _pumpBody(tester);

    expect(find.byKey(const Key('long-short-refresh')), findsNothing);
    expect(find.text('历史多空比'), findsNothing);
    expect(find.text('交易所 多空比图表'), findsOneWidget);
    expect(find.text('持仓占比 (多 VS 空)'), findsOneWidget);
    expect(find.byKey(const Key('long-short-coin-search')), findsOneWidget);
    expect(
      find.byKey(const Key('long-short-symbol-chip-BTCUSDT')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const Key('long-short-period-button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('long-short-period-sheet')), findsOneWidget);
    expect(find.text('15分钟'), findsOneWidget);

    await tester.tap(find.text('15分钟'));
    await tester.pumpAndSettle();

    expect(find.text('15分钟'), findsOneWidget);
    expect(find.byKey(const Key('long-short-period-sheet')), findsNothing);
  });

  testWidgets('点搜索打开 overlay：热门 + 历史；输入过滤；选中回填币种', (WidgetTester tester) async {
    await _pumpBody(tester);

    // 打开全屏搜索，空查询态显示热门币种 + 搜索历史。
    await tester.tap(find.byKey(const Key('long-short-coin-search')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('long-short-search-input')), findsOneWidget);
    final TextField searchField = tester.widget<TextField>(
      find.byKey(const Key('long-short-search-input')),
    );
    expect(searchField.decoration?.filled, isFalse);
    expect(find.byKey(const Key('long-short-search-hot-BTC')), findsOneWidget);
    expect(find.byKey(const Key('long-short-search-hot-ETH')), findsOneWidget);
    expect(find.text('搜索历史'), findsOneWidget);

    // 输入过滤：仅命中 ETH 结果行，BTC 结果行消失。
    await tester.enterText(
      find.byKey(const Key('long-short-search-input')),
      'eth',
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(const Key('long-short-search-result-ETH')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('long-short-search-result-BTC')), findsNothing);

    // 选中结果 → pop overlay 并把 symbol 回填到 tab（ETH chip 选中）。
    await tester.tap(find.byKey(const Key('long-short-search-result-ETH')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('long-short-search-input')), findsNothing);
    final LongShortBody body = tester.widget<LongShortBody>(
      find.byType(LongShortBody),
    );
    expect(body, isNotNull);
    expect(
      find.byKey(const Key('long-short-symbol-chip-ETHUSDT')),
      findsOneWidget,
    );
  });

  testWidgets('搜索 overlay 热门币种直接选中回填', (WidgetTester tester) async {
    await _pumpBody(tester);

    await tester.tap(find.byKey(const Key('long-short-coin-search')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('long-short-search-hot-ETH')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('long-short-search-input')), findsNothing);
    expect(
      find.byKey(const Key('long-short-symbol-chip-ETHUSDT')),
      findsOneWidget,
    );
  });

  testWidgets('搜索空态与历史清空', (WidgetTester tester) async {
    await _pumpBody(tester);

    await tester.tap(find.byKey(const Key('long-short-coin-search')));
    await tester.pumpAndSettle();

    // 无命中查询 → 空态文案。
    await tester.enterText(
      find.byKey(const Key('long-short-search-input')),
      'zzz',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('long-short-search-empty')), findsOneWidget);

    // 清空查询回到热门态，清空历史按钮移除历史区。
    await tester.tap(find.byKey(const Key('long-short-search-clear-input')));
    await tester.pumpAndSettle();
    expect(find.text('搜索历史'), findsOneWidget);
    await tester.tap(find.byKey(const Key('long-short-search-clear-history')));
    await tester.pumpAndSettle();
    expect(find.text('搜索历史'), findsNothing);
  });
}

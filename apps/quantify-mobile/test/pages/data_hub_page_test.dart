import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/data_hub_page.dart';
import 'package:quantify_mobile/pages/market/long_short_page.dart';
import 'package:quantify_mobile/pages/market/market_home_page.dart';
import 'package:quantify_mobile/pages/market/coin_stock_body.dart';
import 'package:quantify_mobile/pages/market/widgets/data_hub_header.dart';
import 'package:quantify_mobile/pages/market/widgets/long_short_bar.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// issue #1851「数据」hub 导航架构的 widget 测试。
///
/// 覆盖验收标准：
/// - AC2 hub 顶部横滑 tab 条含 5 项，点击切换 + 选中态
/// - AC3 通知铃铛存在，未读 > 0 显示红数字 badge
/// - AC4 行情数据 / 多空比均可从 hub tab 进入（不靠 URL）
/// - AC5 聚合挂单 / 预测市场 / 币股子屏 tab 挂载、切换不崩溃
Future<void> _pumpHub(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await tester.binding.setSurfaceSize(const Size(420, 1400));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        home: const DataHubPage(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

Finder _hubTab(DataHubScreen screen) =>
    find.byKey(Key('data-hub-tab-${screen.name}'));

/// 页面内 live 卡片含 QzPulseDot 无限动画，测试推进用固定时长。
Future<void> _pumpBounded(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.pump();
}

void main() {
  testWidgets('hub 顶部渲染 5 个 tab（AC2）', (WidgetTester tester) async {
    await _pumpHub(tester);
    for (final DataHubScreen screen in DataHubScreen.values) {
      expect(_hubTab(screen), findsOneWidget,
          reason: 'tab ${screen.name} 应渲染');
    }
    // 设计稿 5 项中文 label。
    expect(find.text('行情数据'), findsWidgets);
    expect(find.text('多空比'), findsWidgets);
    expect(find.text('聚合挂单'), findsWidgets);
    expect(find.text('预测市场'), findsWidgets);
    expect(find.text('币股'), findsWidgets);
  });

  testWidgets('默认显示行情数据子屏（MarketHomeBody）', (WidgetTester tester) async {
    await _pumpHub(tester);
    expect(find.byType(MarketHomeBody), findsOneWidget);
  });

  testWidgets('点多空比 tab 进入 LongShortBody（AC4：不靠 URL）',
      (WidgetTester tester) async {
    await _pumpHub(tester);
    await tester.tap(_hubTab(DataHubScreen.longShort));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    // IndexedStack 同时构建 LongShortBody；切换后其内容（LongShortBar）可见。
    expect(find.byType(LongShortBody), findsOneWidget);
    expect(find.byType(LongShortBar), findsWidgets);
  });

  testWidgets('已落地 tab（聚合挂单/预测/币股）切换不崩溃（AC5）',
      (WidgetTester tester) async {
    await _pumpHub(tester);
    // 聚合挂单（#1854）/ 预测市场（#1855）已落地 → 不再是占位屏，验证不抛异常。
    for (final DataHubScreen screen in <DataHubScreen>[
      DataHubScreen.aggOrders,
      DataHubScreen.predict,
    ]) {
      await tester.tap(_hubTab(screen));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(tester.takeException(), isNull,
          reason: '切到 ${screen.name} 不应抛异常');
    }

    // 币股（#1856）已落地 → 渲染 CoinStockBody，不再是占位屏。
    await tester.tap(_hubTab(DataHubScreen.coinStock));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byType(CoinStockBody), findsOneWidget,
        reason: 'coinStock 应渲染 CoinStockBody');
    expect(tester.takeException(), isNull,
        reason: '切到 coinStock 不应抛异常');
  });

  testWidgets('通知铃铛存在，未读 > 0 显示红数字 badge（AC3）',
      (WidgetTester tester) async {
    await _pumpHub(tester);
    expect(find.byKey(const Key('data-hub-notification-bell')), findsOneWidget);
    // mockWhaleNotifications 含未读项 → badge 显示数字（非 0）。
    final Finder bell =
        find.byKey(const Key('data-hub-notification-bell'));
    final Finder bellStack =
        find.ancestor(of: bell, matching: find.byType(Stack)).first;
    expect(
      find.descendant(
        of: bellStack,
        matching: find.byIcon(Icons.notifications_outlined),
      ),
      findsOneWidget,
    );
    // badge 渲染未读数字（QzNotificationBell 在 unread > 0 时显示 `$unread` / `9+`）。
    expect(
      find.descendant(
        of: bellStack,
        matching: find.textContaining(RegExp(r'\d')),
      ),
      findsOneWidget,
    );
  });

  testWidgets('点击 hub header 铃铛打开通知中心 sheet（AC3）',
      (WidgetTester tester) async {
    await _pumpHub(tester);
    await tester.tap(find.byKey(const Key('data-hub-notification-bell')));
    await _pumpBounded(tester);
    // 复用 #1560 WhaleNotificationSheet → 通知中心标题可见。
    expect(find.text('通知中心'), findsOneWidget);
  });

  testWidgets('header 无静态「数据」标题文本（#2016）',
      (WidgetTester tester) async {
    await _pumpHub(tester);
    // 决策 #2016：header 收敛为单行（tab 条 + 铃铛），不再渲染静态标题。
    expect(find.byKey(const Key('data-hub-title')), findsNothing);
    // 仍不应存在标题下拉的 PopupMenuButton。
    expect(find.byType(PopupMenuButton<DataHubScreen>), findsNothing);
  });
}

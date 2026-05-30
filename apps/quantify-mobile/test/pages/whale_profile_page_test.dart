import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_profiles.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_page.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_pnl_chart.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 地址详情页守护测试（#1791 — 6 tab 重型详情）。
///
/// 覆盖：入口 push + hero（地址/标签）、默认基本信息 tab（P&L 图 + stat 卡 +
/// 永续总价值）、各明细 tab 切换渲染核心字段、统计弹窗入口保留（#1859）、
/// 复制地址、返回关闭、fallback 空态。
const String _knownAddress = '0x88e…3a01';

GoRouter _router({required String initial}) {
  return GoRouter(
    initialLocation: initial,
    routes: <RouteBase>[
      GoRoute(
        path: '/home',
        builder: (BuildContext context, GoRouterState state) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => context.push(
                '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/whale/profile/:address',
        builder: (BuildContext context, GoRouterState s) =>
            WhaleProfilePage(address: s.pathParameters['address']!),
      ),
    ],
  );
}

Future<void> _pump(WidgetTester tester, {required String initial}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1800));
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        routerConfig: _router(initial: initial),
      ),
    ),
  );
  // mock repo 有 200ms delay：先 settle loading，再 settle data。
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pumpAndSettle();
}

Future<void> _openTab(WidgetTester tester, String label) async {
  await tester.tap(find.text(label).first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('入口：点击地址行 push 详情页，渲染地址 + 标签', (WidgetTester tester) async {
    await _pump(tester, initial: '/home');
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();

    expect(find.byType(WhaleProfilePage), findsOneWidget);
    expect(find.text(_knownAddress), findsWidgets);
    expect(find.text('机构'), findsWidgets);
  });

  testWidgets('基本信息 tab：默认渲染 P&L 图 + stat 卡 + 永续总价值', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    // P&L 图 widget 存在。
    expect(find.byType(WhalePnlChart), findsOneWidget);
    // 4 stat 卡：账户总价值标签 + 交易表现标签。
    expect(find.text('账户总价值'), findsOneWidget);
    expect(find.text('交易表现'), findsOneWidget);
    // 永续总价值卡标签。
    expect(find.text('永续合约总价值'), findsOneWidget);
  });

  testWidgets('明细 tab：切换现货/永续/挂单/成交/历史渲染核心字段', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    final WhaleProfile p = mockWhaleProfiles[_knownAddress]!;

    await _openTab(tester, '现货持仓 ${p.spotHoldings.length}');
    expect(find.text(p.spotHoldings.first.sym), findsWidgets);

    await _openTab(tester, '永续合约持仓 ${p.perpHoldings.length}');
    expect(find.text(p.perpHoldings.first.pnlDisplay), findsOneWidget);

    await _openTab(tester, '挂单 ${p.openOrders.length}');
    expect(find.text(p.openOrders.first.id), findsOneWidget);

    await _openTab(tester, '最近成交 ${p.recentTrades.length}');
    expect(find.text(p.recentTrades.first.feeDisplay), findsOneWidget);

    await _openTab(tester, '历史委托 ${p.histOrders.length}');
    expect(find.text(p.histOrders.first.id), findsOneWidget);
  });

  testWidgets('统计弹窗入口保留：点击 topbar 交易统计按钮打开弹窗', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    // topbar「交易统计」按钮（#1859 弹窗唯一入口）。
    await tester.tap(find.text('交易统计').first);
    await tester.pumpAndSettle();

    final WhaleProfile p = mockWhaleProfiles[_knownAddress]!;
    expect(
      find.text('${p.stats.winRatePct.toStringAsFixed(2)}%'),
      findsWidgets,
    );
    expect(find.text('按资产的表现'), findsOneWidget);
  });

  testWidgets('复制地址：点击复制按钮写入剪贴板并提示', (WidgetTester tester) async {
    final List<MethodCall> calls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        if (call.method == 'Clipboard.setData') calls.add(call);
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });

    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    await tester.tap(find.byIcon(Icons.copy));
    await tester.pump();

    expect(calls, isNotEmpty);
    expect(
      (calls.first.arguments as Map<dynamic, dynamic>)['text'],
      _knownAddress,
    );
    expect(find.text('地址已复制'), findsOneWidget);
  });

  testWidgets('返回关闭：点击 back 后详情页销毁', (WidgetTester tester) async {
    await _pump(tester, initial: '/home');
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();
    expect(find.byType(WhaleProfilePage), findsOneWidget);

    await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
    await tester.pumpAndSettle();
    expect(find.byType(WhaleProfilePage), findsNothing);
  });

  testWidgets('fallback：未命中地址仍渲染 6 tab 骨架与地址', (WidgetTester tester) async {
    const String unknown = '0xdead…beef';
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(unknown)}',
    );
    expect(find.byType(WhaleProfilePage), findsOneWidget);
    expect(find.text(unknown), findsWidgets);
    // tab 骨架：基本信息 tab 默认渲染 P&L 图。
    expect(find.byType(WhalePnlChart), findsOneWidget);
  });
}

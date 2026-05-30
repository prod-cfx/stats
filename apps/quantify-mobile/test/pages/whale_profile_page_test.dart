import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_profiles.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_page.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 地址详情页守护测试（#1753）。
///
/// 用两段路由（home 触发按钮 → push profile）覆盖入口打开 + 返回关闭；
/// 直接落在 profile 路由覆盖字段渲染 / 统计 tab / 复制行为 / fallback 空态。
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
  await tester.binding.setSurfaceSize(const Size(420, 1600));
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

void main() {
  testWidgets('入口：点击地址行 push 详情页，渲染地址 + 标签', (WidgetTester tester) async {
    await _pump(tester, initial: '/home');
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();

    expect(find.byType(WhaleProfilePage), findsOneWidget);
    // 地址在 topbar subtitle 与 hero 同时出现
    expect(find.text(_knownAddress), findsWidgets);
    expect(find.text('机构'), findsWidgets);
  });

  testWidgets('概览 tab：渲染持仓与近期动作核心字段', (WidgetTester tester) async {
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    final WhaleProfile p = mockWhaleProfiles[_knownAddress]!;
    // 持仓 symbol
    expect(find.text(p.holdings.first.symbol), findsWidgets);
    expect(find.text(p.holdings.first.valueDisplay), findsOneWidget);
    // 近期动作 detail
    expect(find.text(p.recentActions.first.detail), findsOneWidget);
  });

  testWidgets('交易统计 tab：切换后渲染唤起入口，点击打开统计弹窗', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(_knownAddress)}',
    );
    // 切到统计 tab（segmented 标签文本即「交易统计」）。
    await tester.tap(find.text('交易统计'));
    await tester.pumpAndSettle();

    // tab 内仅渲染唤起入口（含 chevron），不再内嵌统计明细。
    expect(find.byIcon(Icons.chevron_right), findsOneWidget);

    // 点击入口卡片 → 打开底部统计弹窗（设计稿 WhaleTradeStats）。
    await tester.tap(find.byIcon(Icons.chevron_right));
    await tester.pumpAndSettle();

    final WhaleProfile p = mockWhaleProfiles[_knownAddress]!;
    // 弹窗内胜率卡数值（mono，两位小数）。
    expect(
      find.text('${p.stats.winRatePct.toStringAsFixed(2)}%'),
      findsOneWidget,
    );
    // 弹窗内双子 tab 标签。
    expect(find.text('按资产的表现'), findsOneWidget);
    expect(find.text('按仓位的表现'), findsOneWidget);
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

  testWidgets('空态：未命中地址走 fallback，仍渲染核心字段', (WidgetTester tester) async {
    const String unknown = '0xdead…beef';
    await _pump(
      tester,
      initial: '/whale/profile/${Uri.encodeComponent(unknown)}',
    );
    expect(find.byType(WhaleProfilePage), findsOneWidget);
    expect(find.text(unknown), findsWidgets);
    expect(find.text('持仓'), findsOneWidget);
    expect(find.text('近期动作'), findsOneWidget);
  });
}

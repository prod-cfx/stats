import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_search_sheet.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

String? _lastPushed;

Future<void> _pump(WidgetTester tester) async {
  _lastPushed = null;
  await tester.binding.setSurfaceSize(const Size(420, 900));
  final GoRouter router = GoRouter(
    initialLocation: '/host',
    routes: <RouteBase>[
      GoRoute(
        path: '/host',
        builder: (BuildContext context, GoRouterState state) => Scaffold(
          body: Center(
            child: Builder(
              builder: (BuildContext ctx) => ElevatedButton(
                onPressed: () => WhaleSearchSheet.show(ctx),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/whale/profile/:addr',
        builder: (BuildContext context, GoRouterState state) {
          _lastPushed = state.pathParameters['addr'];
          return const Scaffold(body: Text('profile'));
        },
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: router,
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('打开搜索 sheet：空 query 显示提示', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('搜索地址、标签、资产、交易所或事件类型'), findsOneWidget);
  });

  testWidgets('输入命中：按 kind 分组渲染结果', (WidgetTester tester) async {
    await _pump(tester);
    await tester.enterText(find.byType(TextField), 'BTC');
    await tester.pumpAndSettle();
    // 资产分组标题
    expect(find.text('资产'), findsOneWidget);
    expect(find.text('BTC'), findsWidgets);
  });

  testWidgets('无命中：显示空态', (WidgetTester tester) async {
    await _pump(tester);
    await tester.enterText(find.byType(TextField), 'zzz-none-xyz');
    await tester.pumpAndSettle();
    expect(find.text('未找到匹配结果'), findsOneWidget);
  });

  testWidgets('点击地址结果：关闭 sheet 并跳转地址详情',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.enterText(find.byType(TextField), '0xa83');
    await tester.pumpAndSettle();
    // 命中地址行（地址分组标题存在）
    expect(find.text('地址'), findsOneWidget);
    await tester.tap(find.text('0xa83…b8f2').first);
    await tester.pumpAndSettle();
    expect(_lastPushed, '0xa83…b8f2');
  });
}

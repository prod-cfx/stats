import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 覆盖 #1650：
/// - 默认手续费 = 2 bps
/// - 默认成交价来源 = 收盘价 (close)，选项含中间价 (mid)，对齐设计稿 (#1795)
/// - 历史区间含 3Y (#1795)
/// - sheet 视觉：顶部圆角 24、固定 top:120 scrim
/// - footer 贴底（不在滚动内）：滚动后「确认并开始回测」依然可见
/// - scrim 点击关闭
Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(400, 800));
  final GoRouter router = GoRouter(
    initialLocation: '/host',
    routes: <RouteBase>[
      GoRoute(
        path: '/host',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: SizedBox.shrink()),
        routes: <RouteBase>[
          GoRoute(
            path: 'sheet',
            builder: (BuildContext context, GoRouterState state) =>
                const BacktestConfigSheet(),
          ),
        ],
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
  router.push('/host/sheet');
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('默认手续费 = 2', (WidgetTester tester) async {
    await _pump(tester);
    final TextField fee = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('backtest-fee')),
        matching: find.byType(TextField),
      ),
    );
    expect(fee.controller!.text, '2');
  });

  testWidgets('默认成交价来源 = 收盘价 (close)，选项含中间价 (mid)',
      (WidgetTester tester) async {
    await _pump(tester);
    final DropdownButton<String> dd =
        tester.widget<DropdownButton<String>>(find.descendant(
      of: find.byKey(const Key('backtest-fill-source')),
      matching: find.byType(DropdownButton<String>),
    ));
    expect(dd.value, 'close');
    // items[mid] 的 label 必须 = 中间价，对齐设计稿
    final DropdownMenuItem<String> mid = dd.items!
        .firstWhere((DropdownMenuItem<String> i) => i.value == 'mid');
    final Text label = mid.child as Text;
    expect(label.data, '中间价');
    // 不应再存在旧 avg 选项
    expect(
      dd.items!.where((DropdownMenuItem<String> i) => i.value == 'avg'),
      isEmpty,
    );
  });

  testWidgets('历史区间含 3Y chip', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('backtest-range-3Y')), findsOneWidget);
    expect(find.text('3Y'), findsOneWidget);
  });

  testWidgets('sheet 顶部约 120px 是 scrim；点击 scrim 关闭', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('回测参数'), findsOneWidget);

    final Finder scrim = find.byKey(const Key('backtest-sheet-scrim'));
    expect(scrim, findsOneWidget);
    // scrim 顶部 y=0，高度 120
    final Rect r = tester.getRect(scrim);
    expect(r.top, 0);
    expect(r.height, 120);

    await tester.tap(scrim);
    await tester.pumpAndSettle();
    expect(find.text('回测参数'), findsNothing);
  });

  testWidgets('footer 贴底：滚动后「确认并开始回测」按钮位置不变（不在滚动内容里）',
      (WidgetTester tester) async {
    await _pump(tester);
    final Finder submit = find.byKey(const Key('backtest-submit'));
    final Offset before = tester.getTopLeft(submit);

    // 在滚动区内向上拖；如果按钮在滚动内会跟着移动
    await tester.drag(
      find.byKey(const Key('backtest-capital')),
      const Offset(0, -200),
    );
    await tester.pumpAndSettle();

    final Offset after = tester.getTopLeft(submit);
    expect(after.dy, before.dy);
  });

  testWidgets('sheet 顶部圆角 = 24', (WidgetTester tester) async {
    await _pump(tester);
    // 找到 sheet 容器：圆角 24 + 装饰 color，是 sheet 主体
    final Iterable<Container> containers =
        tester.widgetList<Container>(find.byType(Container));
    final Container sheet = containers.firstWhere((Container co) {
      final Decoration? d = co.decoration;
      if (d is! BoxDecoration) return false;
      final BorderRadiusGeometry? br = d.borderRadius;
      if (br is! BorderRadius) return false;
      return br.topLeft.x == 24 && br.topRight.x == 24;
    });
    final BoxDecoration deco = sheet.decoration! as BoxDecoration;
    final BorderRadius br = deco.borderRadius! as BorderRadius;
    expect(br.topLeft, const Radius.circular(24));
    expect(br.topRight, const Radius.circular(24));
  });
}

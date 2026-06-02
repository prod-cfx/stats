import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 覆盖 #1650 / #1795 / #1893：
/// - 默认手续费 = 2 bps
/// - 成交价来源改 segmented（含 开盘价/收盘价/中间价），默认 收盘价 (#1893)
/// - 历史区间含 3Y (#1795)；非自定义显示「数据范围」回显，自定义显示「共 N 天」(#1893)
/// - 顶部策略 recap 条 (#1893)
/// - 初始资金快捷预设 1k/5k/10k/50k/100k + 模拟资金提示 (#1893)
/// - 交易市场 现货/合约 segmented + 杠杆 chips，20x/50x 高杠杆告警 (#1893)
/// - 「本次回测设定」summary 卡 5 行回显 (#1893)
/// - sheet 视觉：顶部圆角 24、固定 top:120 scrim
/// - footer 贴底（不在滚动内）：滚动后「开始回测」依然可见
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

  testWidgets('成交价来源 segmented：含 开盘价/收盘价/中间价 三档 (#1893)', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    // 改用 segmented：三个选项各有一个 backtest-seg-<key>
    expect(find.byKey(const Key('backtest-seg-open')), findsOneWidget);
    expect(find.byKey(const Key('backtest-seg-close')), findsOneWidget);
    expect(find.byKey(const Key('backtest-seg-mid')), findsOneWidget);
    // 标签对齐设计稿
    expect(find.text('开盘价'), findsOneWidget);
    expect(find.text('中间价'), findsOneWidget);
    // 不应再有旧的 DropdownButton fill-source
    expect(
      find.descendant(
        of: find.byKey(const Key('backtest-fill-source')),
        matching: find.byType(DropdownButton<String>),
      ),
      findsNothing,
    );
  });

  testWidgets('历史区间含 3Y chip', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('backtest-range-3Y')), findsOneWidget);
    expect(find.text('3Y'), findsOneWidget);
  });

  testWidgets('顶部策略 recap 条显示 (#1893)', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.textContaining('配置回测参数'), findsOneWidget);
    expect(find.textContaining('BTC 趋势 · 双均线'), findsOneWidget);
  });

  testWidgets('区间回显：默认 30D 显示「数据范围」(#1893)', (WidgetTester tester) async {
    await _pump(tester);
    final Text echo = tester.widget<Text>(
      find.byKey(const Key('backtest-range-echo')),
    );
    expect(echo.data, contains('数据范围'));
  });

  testWidgets('自定义区间显示「共 N 天 · N 根 15m K 线」(#1893)', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('backtest-range-custom')));
    await tester.pumpAndSettle();
    final Text echo = tester.widget<Text>(
      find.byKey(const Key('backtest-range-echo')),
    );
    expect(echo.data, contains('天'));
    expect(echo.data, contains('15m K 线'));
  });

  testWidgets('初始资金快捷预设：点 10k 写入 10000 (#1893)', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('backtest-capital-50k')));
    await tester.pumpAndSettle();
    final TextField cap = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('backtest-capital')),
        matching: find.byType(TextField),
      ),
    );
    expect(cap.controller!.text, '50000');
  });

  testWidgets('交易市场默认合约：显示杠杆 chips；切现货后隐藏 (#1893)', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    // 默认合约 → 杠杆 chips 可见
    expect(find.byKey(const Key('backtest-leverage-5x')), findsOneWidget);
    expect(find.byKey(const Key('backtest-leverage-50x')), findsOneWidget);
    // 切到现货 → 杠杆隐藏
    await tester.tap(find.byKey(const Key('backtest-seg-spot')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-leverage-5x')), findsNothing);
  });

  testWidgets('高杠杆告警：选 20x/50x 出现告警，回到 5x 消失 (#1893)', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    // 默认 5x 无告警
    expect(find.byKey(const Key('backtest-leverage-warn')), findsNothing);
    // 杠杆 chips 在滚动区下方，tap 前需滚入可视区
    await tester.ensureVisible(find.byKey(const Key('backtest-leverage-20x')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-leverage-20x')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-leverage-warn')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('backtest-leverage-5x')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-leverage-5x')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-leverage-warn')), findsNothing);
  });

  testWidgets('本次回测设定 summary 卡显示 5 行 (#1893)', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('backtest-summary')), findsOneWidget);
    expect(find.text('本次回测设定'), findsOneWidget);
    // 5 行 key 标签齐全
    for (final String k in <String>['区间', '资金', '市场', '撮合', '数据']) {
      expect(
        find.descendant(
          of: find.byKey(const Key('backtest-summary')),
          matching: find.text(k),
        ),
        findsOneWidget,
        reason: 'summary 缺少 $k 行',
      );
    }
  });

  testWidgets('sheet 顶部约 120px 是 scrim；点击 scrim 关闭', (
    WidgetTester tester,
  ) async {
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

  testWidgets('footer 贴底：滚动后「开始回测」按钮位置不变（不在滚动内容里）', (
    WidgetTester tester,
  ) async {
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

  testWidgets('footer 文案对齐设计稿：上一步 + 开始回测（#2067）', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('上一步'), findsOneWidget);
    expect(find.text('开始回测'), findsOneWidget);
    expect(find.text('收起'), findsNothing);
    expect(find.text('确认并开始回测'), findsNothing);
  });

  testWidgets('sheet 顶部圆角 = 24', (WidgetTester tester) async {
    await _pump(tester);
    // 找到 sheet 容器：圆角 24 + 装饰 color，是 sheet 主体
    final Iterable<Container> containers = tester.widgetList<Container>(
      find.byType(Container),
    );
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

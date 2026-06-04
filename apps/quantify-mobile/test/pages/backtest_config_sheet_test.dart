import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 覆盖 #1650 / #1795 / #1893 和截图版回测设置：
/// - 默认手续费 = 2 bps
/// - 成交价来源改 segmented（含 开盘价/收盘价/中间价），默认 收盘价 (#1893)
/// - 顶部 recap / 历史区间 / 初始资金 / 交易市场按设计稿顺序渲染
/// - 交易市场 现货/合约 segmented + 杠杆数字输入，20x+ 高杠杆告警 (#1893)
/// - 「本次回测设定」summary 卡 5 行回显 (#1893)
/// - 整屏向导页视觉：顶部 QzTopBar + 统一 5 步 StepBar
/// - footer 贴底（不在滚动内）：滚动后「开始回测」依然可见
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

  testWidgets('设计稿结构：recap + 历史区间 + 初始资金', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.textContaining('配置回测参数'), findsOneWidget);
    expect(find.textContaining('BTC 趋势 · 双均线'), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-7D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-30D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-90D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-1Y')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-custom')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-3Y')), findsNothing);
    expect(find.byKey(const Key('backtest-range-echo')), findsOneWidget);
    expect(find.byKey(const Key('backtest-capital')), findsOneWidget);
    expect(find.byKey(const Key('backtest-capital-1k')), findsOneWidget);
    expect(find.byKey(const Key('backtest-capital-100k')), findsOneWidget);
  });

  testWidgets('区间回显：默认 30D 显示设计稿固定数据范围', (WidgetTester tester) async {
    await _pump(tester);
    final Text echo = tester.widget<Text>(
      find.byKey(const Key('backtest-range-echo')),
    );
    expect(echo.data, '数据范围:2026-04-26 → 2026-05-26');
  });

  testWidgets('自定义区间：点击起始日期打开日期选择器', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('backtest-range-custom')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-start')), findsOneWidget);
    expect(find.byKey(const Key('backtest-end')), findsOneWidget);

    await tester.tap(find.byKey(const Key('backtest-start')));
    await tester.pumpAndSettle();
    expect(find.byType(DatePickerDialog), findsOneWidget);
  });

  testWidgets('初始资金快捷预设：点 50k 写入 50000 (#1893)', (WidgetTester tester) async {
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

  testWidgets('交易市场默认合约：显示杠杆输入；切现货后隐藏 (#1893)', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('backtest-leverage-input')), findsOneWidget);
    final TextField lev = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('backtest-leverage-input')),
        matching: find.byType(TextField),
      ),
    );
    expect(lev.controller!.text, '5');
    await tester.tap(find.byKey(const Key('backtest-seg-spot')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-leverage-input')), findsNothing);
  });

  testWidgets('高杠杆告警：输入 20 出现告警，回到 5 消失 (#1893)', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('backtest-leverage-warn')), findsNothing);
    await tester.ensureVisible(
      find.byKey(const Key('backtest-leverage-input')),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byKey(const Key('backtest-leverage-input')),
        matching: find.byType(TextField),
      ),
      '20',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backtest-leverage-warn')), findsOneWidget);
    await tester.enterText(
      find.descendant(
        of: find.byKey(const Key('backtest-leverage-input')),
        matching: find.byType(TextField),
      ),
      '5',
    );
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

  testWidgets('整屏向导页顶部：回测设置 + 统一 5 步条', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('回测设置'), findsWidgets);
    expect(find.text('设置如何回测这条策略'), findsOneWidget);
    expect(find.byKey(const Key('qz-step-bar')), findsOneWidget);
    for (final String step in <String>['确认策略', '策略脚本', '回测设置', '回测', '部署']) {
      expect(
        find.descendant(
          of: find.byKey(const Key('qz-step-bar')),
          matching: find.text(step),
        ),
        findsOneWidget,
      );
    }
    expect(find.text('03'), findsOneWidget);
    expect(find.byKey(const Key('backtest-sheet-scrim')), findsNothing);
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
      find.byKey(const Key('backtest-scroll')),
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

  testWidgets('整屏页不再渲染旧 sheet 圆角主体', (WidgetTester tester) async {
    await _pump(tester);
    final Iterable<Container> containers = tester.widgetList<Container>(
      find.byType(Container),
    );
    final bool hasOldSheetRadius = containers.any((Container co) {
      final Decoration? d = co.decoration;
      if (d is! BoxDecoration) return false;
      final BorderRadiusGeometry? br = d.borderRadius;
      if (br is! BorderRadius) return false;
      return br.topLeft.x == 24 &&
          br.topRight.x == 24 &&
          br.bottomLeft.x == 0 &&
          br.bottomRight.x == 0;
    });
    expect(hasOldSheetRadius, isFalse);
  });
}

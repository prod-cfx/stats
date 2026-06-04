import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/ai/widgets/qz_backtest_progress_card.dart';

import '../helpers/golden_harness.dart';

/// 卡片信息密度高、整屏高度超过单屏视口；生产环境内嵌在对话流 ListView 中，
/// 因此测试用 [SingleChildScrollView] 复现可滚动父级，避免 RenderFlex 溢出。
Widget _scrollable(double progress, {VoidCallback? onCancel}) =>
    SingleChildScrollView(
      child: QzBacktestProgressCard(progress: progress, onCancel: onCancel),
    );

void main() {
  testWidgets('renders ring, percent, eta and progress across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => _scrollable(0.42),
      (WidgetTester t) async {
        expect(find.text('回测进行中'), findsOneWidget);
        expect(find.byKey(const Key('backtest-progress-ring')), findsOneWidget);
        expect(
          find.byKey(const Key('backtest-progress-percent')),
          findsOneWidget,
        );
        // RichText 拼出 "42%"
        expect(find.text('42%', findRichText: true), findsOneWidget);
        // 预计剩余 round((100-42)*0.4) = 23s
        expect(find.text('预计剩余 23s'), findsOneWidget);
      },
      surfaceSize: const Size(360, 920),
    );
  });

  testWidgets('clamps out-of-range progress to 0..100',
      (WidgetTester tester) async {
    await pumpQz(
      tester,
      _scrollable(1.6),
      surfaceSize: const Size(360, 920),
    );
    expect(find.text('100%', findRichText: true), findsOneWidget);
    // 100% 时剩余至少 1s（max(1, ...)）
    expect(find.text('预计剩余 1s'), findsOneWidget);
  });

  testWidgets('renders 2x2 live counters, equity curve and engine log',
      (WidgetTester tester) async {
    await pumpQz(
      tester,
      _scrollable(0.5),
      surfaceSize: const Size(360, 920),
    );
    expect(find.text('已处理 K 线'), findsOneWidget);
    expect(find.text('已生成交易'), findsOneWidget);
    expect(find.text('当前最大回撤'), findsOneWidget);
    expect(find.text('当前累计收益'), findsOneWidget);
    expect(find.text('实时净值'), findsOneWidget);
    expect(find.text('引擎日志'), findsOneWidget);
    expect(
      find.byKey(const Key('backtest-progress-equity')),
      findsOneWidget,
    );
    // 引擎日志至少揭示首条
    expect(find.text('09:41:03'), findsOneWidget);
  });

  testWidgets('engine log reveals all entries at completion',
      (WidgetTester tester) async {
    await pumpQz(
      tester,
      _scrollable(1.0),
      surfaceSize: const Size(360, 920),
    );
    // 100% 时全部 7 条日志渲染，含最后的止损（danger）条目
    expect(find.text('09:41:13'), findsOneWidget);
  });

  testWidgets('hides cancel button when onCancel is null',
      (WidgetTester tester) async {
    await pumpQz(
      tester,
      _scrollable(0.1),
      surfaceSize: const Size(360, 920),
    );
    expect(find.byKey(const Key('backtest-progress-cancel')), findsNothing);
  });

  testWidgets('tapping cancel invokes onCancel', (WidgetTester tester) async {
    int taps = 0;
    await pumpQz(
      tester,
      _scrollable(0.5, onCancel: () => taps++),
      surfaceSize: const Size(360, 920),
    );
    await tester.ensureVisible(
      find.byKey(const Key('backtest-progress-cancel')),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('backtest-progress-cancel')));
    await tester.pump();
    expect(taps, 1);
  });
}

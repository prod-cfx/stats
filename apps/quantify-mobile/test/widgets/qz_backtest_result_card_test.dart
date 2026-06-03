import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/backtest.dart';
import 'package:quantify_mobile/widgets/qz_backtest_result_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  // 富结果卡较高，包一层滚动容器并放大画布，避免 9 主题渲染触发 overflow。
  Widget harness() => SingleChildScrollView(
    child: QzBacktestResultCard(result: mockBacktestResult),
  );

  testWidgets('result card renders Hero + 8 metrics across 9 themes', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(tester, harness, (WidgetTester t) async {
      // 状态行 + 区间
      expect(find.text('回测完成'), findsOneWidget);
      expect(find.text('可部署'), findsOneWidget);
      expect(find.text('2021-01 → 2026-05'), findsOneWidget);
      // Hero：累计净值 +312.4%
      expect(find.text('+312.4%'), findsOneWidget);
      // 关键指标 8 格关键值（验收 #3）
      expect(find.text('+31.6%'), findsOneWidget); // CAGR
      expect(find.text('1.78'), findsOneWidget); // Sharpe
      expect(find.text('-12.4%'), findsOneWidget); // 最大回撤
      expect(find.text('2.55'), findsOneWidget); // Calmar
      expect(find.text('55.4%'), findsOneWidget); // 胜率
      expect(find.text('2.04'), findsOneWidget); // 盈亏比
      expect(find.text('184 笔'), findsOneWidget); // 总交易
      expect(find.text('14h 23m'), findsOneWidget); // 平均持仓
    }, surfaceSize: const Size(360, 1200));
  });

  testWidgets('tabs switch between monthly / trades / risk', (
    WidgetTester tester,
  ) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpQz(tester, harness(), surfaceSize: const Size(360, 1200));

    // 默认 月度回报 Tab：图例可见
    expect(find.text('月度 % 收益'), findsOneWidget);
    expect(find.byKey(const Key('backtest-result-tabs')), findsOneWidget);
    final double monthlyY = tester.getTopLeft(find.text('月度回报')).dy;
    expect(tester.getTopLeft(find.text('交易记录')).dy, monthlyY);
    expect(tester.getTopLeft(find.text('风险分析')).dy, monthlyY);

    // 切到 交易记录
    await tester.tap(find.text('交易记录'));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.textContaining('持仓 4h 12m'), findsOneWidget);

    // 切到 风险分析
    await tester.tap(find.text('风险分析'));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.text('回撤恢复'), findsOneWidget);
    expect(find.text('波动率 (年化)'), findsOneWidget);
  });

  testWidgets('AI assessment bar renders', (WidgetTester tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpQz(tester, harness(), surfaceSize: const Size(360, 1200));
    // AI 评估文案走 RichText（粗体前缀 + 正文），用 plainText 匹配。
    final Finder bar = find.byWidgetPredicate(
      (Widget w) =>
          w is RichText &&
          w.text.toPlainText().contains('AI 评估') &&
          w.text.toPlainText().contains('优于阈值'),
    );
    expect(bar, findsOneWidget);
  });
}

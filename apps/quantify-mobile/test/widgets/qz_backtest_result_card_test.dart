import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';
import '../fixtures/mock/fixtures/backtest.dart';
import 'package:quantify_mobile/pages/ai/widgets/qz_backtest_result_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  // 富结果卡较高，包一层滚动容器并放大画布，避免 9 主题渲染触发 overflow。
  Widget harness() => SingleChildScrollView(
    child: QzBacktestResultCard(result: mockBacktestResult),
  );

  testWidgets(
    'result card renders Hero + front-aligned 6 metrics across themes',
    (WidgetTester tester) async {
      await verifyAllThemes(tester, harness, (WidgetTester t) async {
        // 状态行 + 区间
        expect(find.text('回测完成'), findsOneWidget);
        expect(find.text('可部署'), findsOneWidget);
        expect(find.text('2021-01 → 2026-05'), findsOneWidget);
        // Hero：累计净值 +312.4%
        expect(find.text('+312.4%'), findsWidgets);
        // 关键指标 6 格对齐 front：已平仓收益 / 回撤 / 已平仓胜率 / 已平仓笔数 / 未平仓笔数 / 浮动盈亏。
        expect(find.text('已平仓收益'), findsOneWidget);
        expect(find.text('+312.4%'), findsWidgets);
        expect(find.text('-12.4%'), findsOneWidget); // 最大回撤
        expect(find.text('已平仓胜率'), findsOneWidget);
        expect(find.text('55.4%'), findsOneWidget);
        expect(find.text('已平仓笔数'), findsOneWidget);
        expect(find.text('184'), findsOneWidget);
        expect(find.text('未平仓笔数'), findsOneWidget);
        expect(find.text('1'), findsWidgets);
        expect(find.text('浮动盈亏'), findsOneWidget);
        expect(find.text('+91.86'), findsOneWidget);
        expect(
          find.textContaining('CAGR'),
          findsOneWidget,
        ); // Hero inline only.
        expect(find.text('Sharpe'), findsNothing);
        expect(find.text('Calmar'), findsNothing);
        expect(find.text('盈亏比'), findsNothing);
      }, surfaceSize: const Size(360, 1200));
    },
  );

  testWidgets('tabs switch between monthly / trades / open positions / risk', (
    WidgetTester tester,
  ) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpQz(tester, harness(), surfaceSize: const Size(360, 1200));

    // 默认 月度回报 Tab：图例可见
    expect(find.text('月度 % 收益'), findsOneWidget);
    expect(find.byKey(const Key('backtest-result-tabs')), findsOneWidget);
    final double monthlyY = tester.getTopLeft(find.text('月度回报')).dy;
    expect(tester.getTopLeft(find.text('交易记录')).dy, monthlyY);
    expect(tester.getTopLeft(find.text('未平仓')).dy, monthlyY);
    expect(tester.getTopLeft(find.text('风险分析')).dy, monthlyY);

    // 切到 交易记录
    await tester.tap(find.text('交易记录'));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.textContaining('持仓 4h 12m'), findsOneWidget);

    // 切到 未平仓
    await tester.tap(find.text('未平仓'));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.text('BTCUSDT'), findsOneWidget);
    expect(find.textContaining('数量 0.0012'), findsOneWidget);
    expect(find.textContaining('均价 78,538.46'), findsOneWidget);
    expect(find.text('+91.86'), findsWidgets);

    // 切到 风险分析
    await tester.tap(find.text('风险分析'));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.text('最大回撤幅度'), findsOneWidget);
    expect(find.text('回撤恢复天数'), findsOneWidget);
    expect(find.text('年化波动率'), findsOneWidget);
    expect(find.text('夏普比率'), findsOneWidget);
    expect(find.text('下行偏度'), findsNothing);
    expect(find.text('连续亏损'), findsNothing);
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

  testWidgets('monthly heatmap keeps small return decimals', (
    WidgetTester tester,
  ) async {
    final BacktestResult result = BacktestResult(
      id: 'bt-monthly-small',
      totalReturnPercent: -0.3,
      cagrPercent: -0.3,
      maxDrawdownPercent: 0.4,
      sharpe: 0,
      calmar: 0,
      winRatePercent: 0,
      profitLossRatio: 0,
      avgHoldDuration: '--',
      totalTrades: 0,
      rangeStart: DateTime.utc(2026, 5, 16),
      rangeEnd: DateTime.utc(2026, 6, 15),
      equityCurve: const <double>[10000, 9970],
      drawdownMarkers: const <int>[],
      monthlyRows: const <BacktestMonthlyRow>[
        BacktestMonthlyRow(
          year: 2026,
          values: <double?>[
            null,
            null,
            null,
            null,
            -0.03,
            -0.27,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        ),
      ],
      trades: const <BacktestTrade>[],
      riskRows: const <BacktestRiskRow>[],
      aiAssessment: '',
    );

    await pumpQz(
      tester,
      SingleChildScrollView(child: QzBacktestResultCard(result: result)),
      surfaceSize: const Size(360, 900),
    );

    expect(find.text('0.0'), findsOneWidget);
    expect(find.text('-0.3'), findsOneWidget);
    expect(find.text('-0'), findsNothing);
  });

  testWidgets('missing timestamps render neutral range instead of epoch', (
    WidgetTester tester,
  ) async {
    final BacktestResult result = BacktestResult(
      id: 'bt-epoch',
      totalReturnPercent: 0,
      cagrPercent: 0,
      maxDrawdownPercent: 0,
      sharpe: 0,
      calmar: 0,
      winRatePercent: 0,
      profitLossRatio: 0,
      avgHoldDuration: '--',
      totalTrades: 0,
      rangeStart: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      rangeEnd: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      equityCurve: const <double>[0, 0],
      drawdownMarkers: const <int>[],
      monthlyRows: const <BacktestMonthlyRow>[],
      trades: const <BacktestTrade>[],
      riskRows: const <BacktestRiskRow>[],
      aiAssessment: '',
    );
    await pumpQz(
      tester,
      SingleChildScrollView(child: QzBacktestResultCard(result: result)),
      surfaceSize: const Size(360, 900),
    );

    expect(find.text('--'), findsWidgets);
    expect(find.textContaining('1970-01'), findsNothing);
  });
}

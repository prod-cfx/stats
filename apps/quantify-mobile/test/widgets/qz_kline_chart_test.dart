import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:k_chart_plus/k_chart_plus.dart';
import 'package:quantify_mobile/data/mock/fixtures/candles.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_kline_chart.dart';
import 'package:quantify_mobile/widgets/qz_segmented_tabs.dart';
import 'package:quantify_mobile/widgets/qz_spinner.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzKlineChart 渲染 6 个周期 tab，候选数据为空时显示 spinner', (
    WidgetTester tester,
  ) async {
    KlineInterval current = KlineInterval.m1;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: current,
        onIntervalChanged: (KlineInterval next) => current = next,
      ),
      surfaceSize: const Size(420, 700),
    );

    expect(find.byType(QzSegmentedTabs), findsOneWidget);
    for (final option in QzKlineChart.intervalOptions) {
      expect(find.text(option.label), findsOneWidget);
    }
    expect(find.byType(QzSpinner), findsOneWidget);
    expect(find.byType(KChartWidget), findsNothing);
  });

  testWidgets('QzKlineChart 候选非空时渲染 KChartWidget', (WidgetTester tester) async {
    final List<Candle> candles = generateSeededCandles(
      interval: KlineInterval.h1,
      count: 30,
    );
    await pumpQz(
      tester,
      QzKlineChart(
        candles: candles,
        interval: KlineInterval.h1,
        onIntervalChanged: (_) {},
      ),
      surfaceSize: const Size(420, 700),
    );

    expect(find.byType(KChartWidget), findsOneWidget);
    expect(find.byType(QzSpinner), findsNothing);
  });

  testWidgets('QzKlineChart 点击不同周期 tab 触发回调', (WidgetTester tester) async {
    KlineInterval received = KlineInterval.h1;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.h1,
        onIntervalChanged: (KlineInterval next) => received = next,
      ),
      surfaceSize: const Size(420, 700),
    );

    await tester.tap(find.text('5m'));
    await tester.pump();
    expect(received, KlineInterval.m5);
  });

  testWidgets('QzKlineChart 点击当前选中 tab 不触发回调', (WidgetTester tester) async {
    int callbackCount = 0;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.m5,
        onIntervalChanged: (_) => callbackCount++,
      ),
      surfaceSize: const Size(420, 700),
    );

    await tester.tap(find.text('5m'));
    await tester.pump();
    expect(callbackCount, 0);
  });

  testWidgets('QzKlineChart hasError=true 时渲染错误态 + 重试按钮回调', (
    WidgetTester tester,
  ) async {
    int retryCount = 0;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.h1,
        hasError: true,
        onRetry: () => retryCount++,
        onIntervalChanged: (_) {},
      ),
      surfaceSize: const Size(420, 700),
    );

    expect(find.text('K 线加载失败'), findsOneWidget);
    expect(find.byType(KChartWidget), findsNothing);
    expect(find.byType(QzSpinner), findsNothing);

    await tester.tap(find.text('重试'));
    await tester.pump();
    expect(retryCount, 1);
  });

  testWidgets('QzKlineChart 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    final List<Candle> candles = generateSeededCandles(
      interval: KlineInterval.h1,
      count: 10,
    );
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await tester.binding.setSurfaceSize(const Size(420, 700));
        await tester.pumpWidget(
          MaterialApp(
            theme: buildQzThemeData(QzTheme(bg: bg, accent: accent)),
            home: Scaffold(
              body: QzKlineChart(
                candles: candles,
                interval: KlineInterval.h1,
                onIntervalChanged: (_) {},
              ),
            ),
          ),
        );
        await tester.pump();
        expect(find.byType(QzKlineChart), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    }
  });
}

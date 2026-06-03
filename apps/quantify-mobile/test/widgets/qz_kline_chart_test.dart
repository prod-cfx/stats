import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:k_chart_plus/k_chart_plus.dart';
import 'package:quantify_mobile/data/mock/fixtures/candles.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_kline_chart.dart';
import 'package:quantify_mobile/widgets/qz_spinner.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzKlineChart 渲染 5 个周期 tab + 更多入口，候选为空时显示 spinner', (
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

    // 文案严格对齐设计稿：1m / 15m / 1H / 4H / 1D。
    // 这里不再断言 QzSegmentedTabs：设计稿是平铺 underline tab，非胶囊分段控件。
    expect(QzKlineChart.intervalOptions.map((o) => o.label).toList(), <String>[
      '1m',
      '15m',
      '1H',
      '4H',
      '1D',
    ]);
    for (final option in QzKlineChart.intervalOptions) {
      expect(find.text(option.label), findsOneWidget);
    }
    // 去掉了 5m / 1h 旧文案
    expect(find.text('5m'), findsNothing);
    expect(find.text('1h'), findsNothing);
    // 更多入口存在
    expect(find.text(QzKlineChart.moreLabel), findsOneWidget);
    expect(find.byType(QzSpinner), findsOneWidget);
    expect(find.byType(KChartWidget), findsNothing);
  });

  testWidgets('QzKlineChart 候选为空时 OHLC 行显示占位符', (WidgetTester tester) async {
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.m1,
        onIntervalChanged: (_) {},
      ),
      surfaceSize: const Size(420, 700),
    );

    expect(find.text('O'), findsOneWidget);
    expect(find.text('H'), findsOneWidget);
    expect(find.text('L'), findsOneWidget);
    expect(find.text('C'), findsOneWidget);
    expect(find.text('--'), findsNWidgets(4));
  });

  testWidgets('QzKlineChart 候选非空时 OHLC 行展示最新蜡烛数值', (WidgetTester tester) async {
    final List<Candle> candles = <Candle>[
      Candle(
        openTime: DateTime.utc(2024, 1, 1),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1,
      ),
      Candle(
        openTime: DateTime.utc(2024, 1, 1, 1),
        open: 105,
        high: 120,
        low: 101.5,
        close: 102.25,
        volume: 1,
      ),
    ];
    await pumpQz(
      tester,
      QzKlineChart(
        candles: candles,
        interval: KlineInterval.h1,
        onIntervalChanged: (_) {},
      ),
      surfaceSize: const Size(420, 700),
    );

    // 取最新一根（close < open，C 着跌色），保留两位小数
    expect(find.text('105.00'), findsOneWidget); // open
    expect(find.text('120.00'), findsOneWidget); // high
    expect(find.text('101.50'), findsOneWidget); // low
    expect(find.text('102.25'), findsOneWidget); // close
  });

  testWidgets('QzKlineChart 点击更多弹出占位 sheet 不报错', (WidgetTester tester) async {
    int intervalChanges = 0;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.m1,
        onIntervalChanged: (_) => intervalChanges++,
      ),
      surfaceSize: const Size(420, 700),
    );

    await tester.tap(find.text(QzKlineChart.moreLabel));
    // 用固定时长 pump 跨过 sheet 滑入动画；避免 pumpAndSettle 在自定义
    // AnimationStyle 下超时。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('暂无更多周期'), findsOneWidget);
    expect(intervalChanges, 0);
    expect(tester.takeException(), isNull);
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

    await tester.tap(find.text('15m'));
    await tester.pump();
    expect(received, KlineInterval.m15);
  });

  testWidgets('QzKlineChart 点击当前选中 tab 不触发回调', (WidgetTester tester) async {
    int callbackCount = 0;
    await pumpQz(
      tester,
      QzKlineChart(
        candles: const <Candle>[],
        interval: KlineInterval.m15,
        onIntervalChanged: (_) => callbackCount++,
      ),
      surfaceSize: const Size(420, 700),
    );

    await tester.tap(find.text('15m'));
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
            locale: const Locale('zh'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
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

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/me/widgets/qz_exchange_logo.dart';

import '../../../helpers/golden_harness.dart';

void main() {
  Finder logoContainer = find.byWidgetPredicate(
    (Widget w) => w is Container && w.decoration is BoxDecoration,
  );

  testWidgets('已知交易所渲染品牌底色 + CustomPaint 矢量图形，无首字母文本', (
    tester,
  ) async {
    for (final ({String ex, Color bg}) e in <({String ex, Color bg})>[
      (ex: 'Binance', bg: const Color(0xFF181A20)),
      (ex: 'OKX', bg: const Color(0xFF000000)),
      (ex: 'Hyperliquid', bg: const Color(0xFF0B3D33)),
    ]) {
      await pumpQz(
        tester,
        QzExchangeLogo(exchange: e.ex, size: 36),
        surfaceSize: const Size(80, 80),
      );

      // 品牌矢量图形以 CustomPaint 渲染（与 #1815 统一 CustomPainter 方案）。
      expect(find.byType(CustomPaint), findsWidgets);
      // 品牌底色注入容器。
      final BoxDecoration deco =
          tester.widget<Container>(logoContainer.first).decoration!
              as BoxDecoration;
      expect(deco.color, e.bg);
      // 已知交易所不退化为首字母占位。
      expect(find.text(e.ex.substring(0, 1)), findsNothing);
    }
  });

  testWidgets('未知交易所回退首字母占位，不报错', (tester) async {
    await pumpQz(
      tester,
      const QzExchangeLogo(exchange: 'Kraken', size: 36),
      surfaceSize: const Size(80, 80),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('K'), findsOneWidget);
  });

  testWidgets('空名称回退占位渲染 ? 且不抛 RangeError', (tester) async {
    await pumpQz(
      tester,
      const QzExchangeLogo(exchange: '', size: 36),
      surfaceSize: const Size(80, 80),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('?'), findsOneWidget);
  });
}

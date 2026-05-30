import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/me/widgets/qz_account_header.dart';

import '../../../helpers/golden_harness.dart';

void main() {
  Future<void> pumpHeader(WidgetTester tester) async {
    await pumpQz(
      tester,
      const QzAccountHeader(
        maskedEmail: 'a***@example.com',
        uid: '123456',
        telegramBound: true,
        binanceConnected: true,
      ),
      surfaceSize: const Size(390, 240),
    );
  }

  testWidgets('header logo 为 3×3 彩格 CustomPaint，不再用 person 占位图标', (
    tester,
  ) async {
    await pumpHeader(tester);

    // 设计稿 logo = 3×3 彩色方块，渲染为 CustomPaint；person 图标必须移除。
    expect(find.byType(CustomPaint), findsWidgets);
    expect(find.byIcon(Icons.person_outline), findsNothing);
  });

  testWidgets('logo 容器为圆角裁剪，保证彩格不溢出品牌区', (tester) async {
    await pumpHeader(tester);
    expect(find.byType(ClipRRect), findsWidgets);
  });

  testWidgets('header 背景含右上、左下两处径向紫色高光', (tester) async {
    await pumpHeader(tester);

    // 设计稿背景叠加 2 层 radial-gradient（m-screens-4.jsx:2454-2457）。
    final Finder radialLayers = find.byWidgetPredicate((Widget w) {
      if (w is! DecoratedBox) return false;
      final Decoration d = w.decoration;
      return d is BoxDecoration && d.gradient is RadialGradient;
    });
    expect(radialLayers, findsNWidgets(2));
  });

  testWidgets('Telegram「已绑定」chip 含绿色状态点', (tester) async {
    await pumpHeader(tester);

    // 设计稿 Telegram chip 内含 6px 绿点 #16C783（m-screens-4.jsx:2497）。
    final Finder greenDot = find.byWidgetPredicate((Widget w) {
      if (w is! Container) return false;
      final Decoration? d = w.decoration;
      return d is BoxDecoration && d.color == const Color(0xFF16C783);
    });
    expect(greenDot, findsOneWidget);
  });

  testWidgets('header 在 9 主题下渲染不抛异常', (tester) async {
    await verifyAllThemes(
      tester,
      () =>
          const QzAccountHeader(maskedEmail: 'a***@example.com', uid: '123456'),
      (tester) async {
        expect(find.byType(QzAccountHeader), findsOneWidget);
      },
      surfaceSize: const Size(390, 240),
    );
  });
}

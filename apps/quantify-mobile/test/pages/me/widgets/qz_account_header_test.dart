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

  testWidgets('header logo 为棋盘 CustomPaint，不再用 person 占位图标',
      (tester) async {
    await pumpHeader(tester);

    // 设计稿 logo = checkerboard，渲染为 CustomPaint；person 图标必须移除。
    expect(find.byType(CustomPaint), findsWidgets);
    expect(find.byIcon(Icons.person_outline), findsNothing);
  });

  testWidgets('logo 容器为圆角裁剪，保证棋盘格不溢出品牌区',
      (tester) async {
    await pumpHeader(tester);
    expect(find.byType(ClipRRect), findsWidgets);
  });

  testWidgets('header 在 9 主题下渲染不抛异常', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzAccountHeader(
        maskedEmail: 'a***@example.com',
        uid: '123456',
      ),
      (tester) async {
        expect(find.byType(QzAccountHeader), findsOneWidget);
      },
      surfaceSize: const Size(390, 240),
    );
  });
}

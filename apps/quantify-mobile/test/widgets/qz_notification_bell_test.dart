import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/theme/tokens.dart';
import 'package:quantify_mobile/widgets/qz_notification_bell.dart';

import '../helpers/golden_harness.dart';

/// 取 circular 变体内铃铛容器的 BoxDecoration（DecoratedBox，区别于 badge 的 Container）。
BoxDecoration _circleDecoration(WidgetTester tester) {
  final DecoratedBox box = tester.widget<DecoratedBox>(
    find.descendant(
      of: find.byType(QzNotificationBell),
      matching: find.byType(DecoratedBox),
    ),
  );
  return box.decoration as BoxDecoration;
}

void main() {
  testWidgets('无边框变体：circular+bordered=false 渲染透明圆且无 border', (tester) async {
    await pumpQz(
      tester,
      QzNotificationBell(
        unread: 0,
        onTap: () {},
        tooltip: '通知',
        iconKey: const Key('bell-icon'),
        circular: true,
        bordered: false,
      ),
    );

    expect(find.byType(QzNotificationBell), findsOneWidget);
    final BoxDecoration deco = _circleDecoration(tester);
    expect(deco.border, isNull, reason: '无边框变体不应有 border');
    expect(deco.color, Colors.transparent, reason: '无边框变体背景应透明');
    expect(deco.shape, BoxShape.circle);
  });

  testWidgets('默认 circular（bordered=true）保留描边与填充，market 样式不回归', (tester) async {
    await pumpQz(
      tester,
      QzNotificationBell(
        unread: 0,
        onTap: () {},
        tooltip: '通知',
        circular: true,
      ),
    );

    final BoxDecoration deco = _circleDecoration(tester);
    expect(deco.border, isNotNull, reason: 'market 带边框变体必须保留 border');
    expect(deco.color, isNot(Colors.transparent));
  });

  testWidgets('未读>0 显示 badge，颜色取统一 token badgeNotification', (tester) async {
    await pumpQz(
      tester,
      QzNotificationBell(
        unread: 3,
        onTap: () {},
        tooltip: '通知',
        circular: true,
        bordered: false,
      ),
    );

    expect(find.text('3'), findsOneWidget);
    // badge 是 IgnorePointer 内的 Container。
    final Container badge = tester.widget<Container>(
      find.descendant(
        of: find.byType(IgnorePointer),
        matching: find.byType(Container),
      ),
    );
    final BoxDecoration deco = badge.decoration! as BoxDecoration;
    expect(deco.color, QzStatus.badgeNotification);
    expect(deco.color, const Color(0xFFE5484D));
  });

  testWidgets('未读=0 不渲染 badge', (tester) async {
    await pumpQz(
      tester,
      QzNotificationBell(
        unread: 0,
        onTap: () {},
        tooltip: '通知',
        circular: true,
        bordered: false,
      ),
    );

    // badge 仅在 unread>0 渲染数字文本；unread=0 时铃铛只剩 Icon，无任何数字 Text。
    expect(find.text('0'), findsNothing);
  });

  testWidgets('未读>9 显示 9+', (tester) async {
    await pumpQz(
      tester,
      QzNotificationBell(
        unread: 42,
        onTap: () {},
        tooltip: '通知',
        circular: true,
        bordered: false,
      ),
    );

    expect(find.text('9+'), findsOneWidget);
    expect(find.text('42'), findsNothing);
  });
}

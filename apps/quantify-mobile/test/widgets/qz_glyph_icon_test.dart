import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_glyph_icon.dart';

void main() {
  group('QzGlyphIcon', () {
    testWidgets('renders at the requested size via CustomPaint', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: QzGlyphIcon(
                path: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
                color: Color(0xFF000000),
                size: 16,
                strokeWidth: 2,
              ),
            ),
          ),
        ),
      );

      final Size size = tester.getSize(find.byType(QzGlyphIcon));
      expect(size, const Size(16, 16));
      expect(
        find.descendant(
          of: find.byType(QzGlyphIcon),
          matching: find.byType(CustomPaint),
        ),
        findsOneWidget,
      );
    });

    testWidgets('accepts multi-subpath design glyphs without throwing', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: QzGlyphIcon(
              // 新建会话 glyph：方框转角箭头 + 加号，多段 M 子路径。
              path: 'M21 12a9 9 0 1 1-9-9M16 3h6v6M12 8v8M8 12h8',
              color: Color(0xFF000000),
              size: 16,
              strokeWidth: 2.2,
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(QzGlyphIcon), findsOneWidget);
    });
  });
}

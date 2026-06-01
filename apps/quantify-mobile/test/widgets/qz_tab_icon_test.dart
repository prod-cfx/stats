import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_tab_icon.dart';

void main() {
  group('parseSvgPath (tab glyph subset)', () {
    test('parses absolute M/L/Z into a closed triangle', () {
      final Path p = parseSvgPath('M0 0L10 0L10 10Z');
      final Rect b = p.getBounds();
      expect(b.left, 0);
      expect(b.top, 0);
      expect(b.right, 10);
      expect(b.bottom, 10);
    });

    test('handles relative h/v commands (strat rect subset)', () {
      // M4 4 h7 v7 H4 z -> a 7x7 box anchored at (4,4).
      final Path p = parseSvgPath('M4 4h7v7H4z');
      final Rect b = p.getBounds();
      expect(b.left, 4);
      expect(b.top, 4);
      expect(b.right, 11);
      expect(b.bottom, 11);
    });

    test('handles relative line "l" command', () {
      final Path p = parseSvgPath('M0 0l5 5');
      final Rect b = p.getBounds();
      expect(b.right, 5);
      expect(b.bottom, 5);
    });

    test('parses arc "a" command (me head circle subset)', () {
      // Full circle r=4 around (12,8): two semicircle arcs.
      final Path p = parseSvgPath('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
      final Rect b = p.getBounds();
      // Circle spans x in [8,16], y in [4,12]; allow float tolerance.
      expect(b.left, closeTo(8, 0.01));
      expect(b.right, closeTo(16, 0.01));
      expect(b.top, closeTo(4, 0.01));
      expect(b.bottom, closeTo(12, 0.01));
    });

    test('rejects unsupported command', () {
      expect(() => parseSvgPath('M0 0Q1 1 2 2'), throwsFormatException);
    });
  });

  group('all five design glyphs', () {
    const Map<QzTabGlyph, String> paths = <QzTabGlyph, String>{
      QzTabGlyph.strat: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
      QzTabGlyph.ai:
          'M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z',
      QzTabGlyph.market: 'M4 19h16M6 16V9M10 16V5M14 16v-6M18 16v-9',
      QzTabGlyph.whale:
          'M3 12c4 0 4-4 8-4s4 4 8 4M3 17c4 0 4-4 8-4s4 4 8 4M16 7a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
      QzTabGlyph.me: 'M5 20a7 7 0 0 1 14 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    };

    for (final QzTabGlyph g in QzTabGlyph.values) {
      test('$g parses to a non-empty path within the 24x24 viewBox', () {
        final Path p = parseSvgPath(paths[g]!);
        final Rect b = p.getBounds();
        expect(b.isEmpty, isFalse, reason: '$g produced empty bounds');
        // Stay inside the authored viewBox (with a small tolerance for the
        // whale cubic control overshoot).
        expect(b.left, greaterThanOrEqualTo(-1));
        expect(b.top, greaterThanOrEqualTo(-1));
        expect(b.right, lessThanOrEqualTo(25));
        expect(b.bottom, lessThanOrEqualTo(25));
      });
    }
  });
}

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'qz_tab_icon.dart' show parseSvgPath;

/// Renders an arbitrary design SVG glyph by stroking its raw path data.
///
/// Mirrors the project convention used by [QzTabIcon]: ports the design's
/// inline `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
/// strokeLinecap="round" strokeLinejoin="round">` glyphs verbatim and strokes
/// them with a [CustomPainter] (no `flutter_svg`). One or more `M…`-rooted
/// subpaths are supported because the underlying [parseSvgPath] handles every
/// `M` as a new subpath.
class QzGlyphIcon extends StatelessWidget {
  const QzGlyphIcon({
    super.key,
    required this.path,
    required this.color,
    this.size = 16,
    this.strokeWidth = 2,
  });

  /// Raw SVG path data on a 24x24 viewBox. Multiple `M` subpaths are allowed.
  final String path;
  final Color color;
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _GlyphPainter(
          path: path,
          color: color,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter({
    required this.path,
    required this.color,
    required this.strokeWidth,
  });

  final String path;
  final Color color;
  final double strokeWidth;

  // Path data is immutable; parse once and reuse across repaints instead of
  // re-tokenizing the SVG string on every paint() call.
  late final Path _parsed = parseSvgPath(path);

  @override
  void paint(Canvas canvas, Size size) {
    // Glyphs are authored on a 24-unit viewBox; scale to the render box.
    // The stroke scales proportionally with the viewBox transform.
    // Use the shorter side so a non-square box never overflows the viewBox.
    final double scale = math.min(size.width, size.height) / 24.0;
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.save();
    canvas.scale(scale, scale);
    canvas.drawPath(_parsed, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlyphPainter old) =>
      old.path != path ||
      old.color != color ||
      old.strokeWidth != strokeWidth;
}

import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Renders one of the bottom-tab glyphs from the design spec
/// (`design/project/mobile/m-shell.jsx` `ICONS.strat/ai/market/whale/me`).
///
/// The design draws each tab via an inline SVG `<Ico>` on a `0 0 24 24`
/// viewBox: `fill="none"`, `stroke="currentColor"`, `strokeLinecap="round"`,
/// `strokeLinejoin="round"`, rendered at `w=20` with `strokeWidth` 2 when the
/// tab is active and 1.7 when inactive. We port the raw SVG path data verbatim
/// and stroke it with a [CustomPainter] (project convention: no `flutter_svg`,
/// matching `qz_exchange_logo.dart`).
class QzTabIcon extends StatelessWidget {
  const QzTabIcon({
    super.key,
    required this.glyph,
    required this.color,
    required this.active,
    this.size = 20,
  });

  /// One of [QzTabGlyph]; maps 1:1 to the design `ICONS.*` keys.
  final QzTabGlyph glyph;
  final Color color;

  /// Active tabs stroke at 2.0, inactive at 1.7 (mirrors `sw={on ? 2 : 1.7}`).
  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _TabIconPainter(
          path: _glyphPaths[glyph]!,
          color: color,
          strokeWidth: active ? 2.0 : 1.7,
        ),
      ),
    );
  }
}

/// Stable identifiers for the five bottom-tab glyphs.
enum QzTabGlyph { strat, ai, market, whale, me }

/// Raw SVG path data copied verbatim from `m-shell.jsx` `ICONS`. Keep these in
/// sync with the design source; they are authored on a 24x24 viewBox.
const Map<QzTabGlyph, String> _glyphPaths = <QzTabGlyph, String>{
  QzTabGlyph.strat: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  QzTabGlyph.ai:
      'M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z',
  QzTabGlyph.market: 'M4 19h16M6 16V9M10 16V5M14 16v-6M18 16v-9',
  QzTabGlyph.whale:
      'M3 12c4 0 4-4 8-4s4 4 8 4M3 17c4 0 4-4 8-4s4 4 8 4M16 7a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  QzTabGlyph.me: 'M5 20a7 7 0 0 1 14 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
};

class _TabIconPainter extends CustomPainter {
  const _TabIconPainter({
    required this.path,
    required this.color,
    required this.strokeWidth,
  });

  final String path;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    // Glyphs are authored on a 24-unit viewBox; scale to the render box and
    // keep stroke width in design units so active/inactive weights match spec.
    final double scale = size.width / 24.0;
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.save();
    canvas.scale(scale, scale);
    canvas.drawPath(parseSvgPath(path), paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_TabIconPainter old) =>
      old.path != path ||
      old.color != color ||
      old.strokeWidth != strokeWidth;
}

/// Minimal SVG path-data parser covering the command subset used by the tab
/// glyphs: `M/m L/l H/h V/v C/c S/s A/a Z/z`. Sufficient for `ICONS.strat/ai/
/// market/whale/me`; intentionally not a general-purpose parser.
@visibleForTesting
Path parseSvgPath(String d) {
  final Path path = Path();
  final List<_Token> tokens = _tokenize(d);
  int i = 0;

  double curX = 0;
  double curY = 0;
  double startX = 0;
  double startY = 0;
  // Last cubic control point reflection target (for smooth `S`/`s`).
  double prevCtrlX = 0;
  double prevCtrlY = 0;
  bool prevWasCubic = false;

  double num() => (tokens[i++] as _NumberToken).value;

  while (i < tokens.length) {
    final _Token token = tokens[i];
    if (token is! _CommandToken) {
      throw FormatException('Expected command in SVG path, got $token');
    }
    i++;
    final String cmd = token.command;
    final bool rel = cmd == cmd.toLowerCase();
    final String op = cmd.toUpperCase();

    // Each command may be followed by repeated coordinate sets; consume until
    // the next command token.
    do {
      final bool isCubic = op == 'C' || op == 'S';
      switch (op) {
        case 'M':
          double x = num();
          double y = num();
          if (rel) {
            x += curX;
            y += curY;
          }
          path.moveTo(x, y);
          curX = startX = x;
          curY = startY = y;
          break;
        case 'L':
          double x = num();
          double y = num();
          if (rel) {
            x += curX;
            y += curY;
          }
          path.lineTo(x, y);
          curX = x;
          curY = y;
          break;
        case 'H':
          double x = num();
          if (rel) x += curX;
          path.lineTo(x, curY);
          curX = x;
          break;
        case 'V':
          double y = num();
          if (rel) y += curY;
          path.lineTo(curX, y);
          curY = y;
          break;
        case 'C':
          double c1x = num();
          double c1y = num();
          double c2x = num();
          double c2y = num();
          double ex = num();
          double ey = num();
          if (rel) {
            c1x += curX;
            c1y += curY;
            c2x += curX;
            c2y += curY;
            ex += curX;
            ey += curY;
          }
          path.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
          prevCtrlX = c2x;
          prevCtrlY = c2y;
          curX = ex;
          curY = ey;
          break;
        case 'S':
          // Smooth cubic: first control point is the reflection of the
          // previous segment's second control point (or the current point if
          // the previous command was not a cubic).
          final double rc1x = prevWasCubic ? 2 * curX - prevCtrlX : curX;
          final double rc1y = prevWasCubic ? 2 * curY - prevCtrlY : curY;
          double sc2x = num();
          double sc2y = num();
          double sex = num();
          double sey = num();
          if (rel) {
            sc2x += curX;
            sc2y += curY;
            sex += curX;
            sey += curY;
          }
          path.cubicTo(rc1x, rc1y, sc2x, sc2y, sex, sey);
          prevCtrlX = sc2x;
          prevCtrlY = sc2y;
          curX = sex;
          curY = sey;
          break;
        case 'A':
          final double rx = num();
          final double ry = num();
          final double xAxisRot = num();
          final bool largeArc = num() != 0;
          final bool sweep = num() != 0;
          double x = num();
          double y = num();
          if (rel) {
            x += curX;
            y += curY;
          }
          _arcTo(path, curX, curY, rx, ry, xAxisRot, largeArc, sweep, x, y);
          curX = x;
          curY = y;
          break;
        case 'Z':
          path.close();
          curX = startX;
          curY = startY;
          break;
        default:
          throw FormatException('Unsupported SVG command "$cmd"');
      }
      prevWasCubic = isCubic;
      // Z takes no args; never repeats.
      if (op == 'Z') break;
    } while (i < tokens.length && tokens[i] is _NumberToken);
  }
  return path;
}

/// Endpoint-parameterized arc → center form, then append as a Flutter arc.
/// Implements the SVG `A` conversion (W3C SVG impl notes F.6).
void _arcTo(
  Path path,
  double x0,
  double y0,
  double rx,
  double ry,
  double xAxisRotDeg,
  bool largeArc,
  bool sweep,
  double x,
  double y,
) {
  if (rx == 0 || ry == 0) {
    path.lineTo(x, y);
    return;
  }
  rx = rx.abs();
  ry = ry.abs();
  final double phi = xAxisRotDeg * math.pi / 180.0;
  final double cosPhi = math.cos(phi);
  final double sinPhi = math.sin(phi);

  final double dx2 = (x0 - x) / 2.0;
  final double dy2 = (y0 - y) / 2.0;
  final double x1p = cosPhi * dx2 + sinPhi * dy2;
  final double y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Correct out-of-range radii.
  double lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    final double s = math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  final double rxSq = rx * rx;
  final double rySq = ry * ry;
  final double x1pSq = x1p * x1p;
  final double y1pSq = y1p * y1p;

  double num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  if (num < 0) num = 0;
  final double den = rxSq * y1pSq + rySq * x1pSq;
  double coef = den == 0 ? 0 : math.sqrt(num / den);
  if (largeArc == sweep) coef = -coef;

  final double cxp = coef * (rx * y1p / ry);
  final double cyp = coef * -(ry * x1p / rx);

  final double cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2.0;
  final double cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2.0;

  double angle(double ux, double uy, double vx, double vy) {
    final double dot = ux * vx + uy * vy;
    final double len = math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    double a = math.acos((dot / len).clamp(-1.0, 1.0));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  }

  final double startAngle =
      angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  double sweepAngle = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && sweepAngle > 0) {
    sweepAngle -= 2 * math.pi;
  } else if (sweep && sweepAngle < 0) {
    sweepAngle += 2 * math.pi;
  }

  // arcToPoint via addArc on the unrotated ellipse bounds is exact only for
  // axis-aligned ellipses; the tab glyphs use phi=0, so a direct
  // [Path.arcTo] on the ellipse rect is correct here.
  final Rect oval = Rect.fromCenter(
    center: Offset(cx, cy),
    width: 2 * rx,
    height: 2 * ry,
  );
  path.arcTo(oval, startAngle, sweepAngle, false);
}

abstract class _Token {
  const _Token();
}

class _CommandToken extends _Token {
  const _CommandToken(this.command);
  final String command;
}

class _NumberToken extends _Token {
  const _NumberToken(this.value);
  final double value;
}

List<_Token> _tokenize(String d) {
  final List<_Token> tokens = <_Token>[];
  final RegExp numberRe =
      RegExp(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?');
  int i = 0;
  while (i < d.length) {
    final String ch = d[i];
    if (ch == ' ' || ch == ',' || ch == '\t' || ch == '\n' || ch == '\r') {
      i++;
      continue;
    }
    if (RegExp(r'[A-Za-z]').hasMatch(ch)) {
      tokens.add(_CommandToken(ch));
      i++;
      continue;
    }
    final Match? m = numberRe.matchAsPrefix(d, i);
    if (m == null) {
      throw FormatException('Unexpected char "$ch" in SVG path at $i');
    }
    tokens.add(_NumberToken(double.parse(m.group(0)!)));
    i = m.end;
  }
  return tokens;
}

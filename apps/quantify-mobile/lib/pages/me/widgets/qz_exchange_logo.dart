import 'package:flutter/material.dart';

import '../../../theme/theme_context.dart';

/// 交易所品牌 logo（含品牌底色），对齐设计稿 `m-screens-4.jsx:2720`
/// `ExchangeLogo`。
///
/// 矢量图形用 [CustomPainter] 自绘（与 #1815 header 棋盘 logo 统一方案，
/// 不引入 `flutter_svg`）。未在映射表内的交易所回退到首字母占位（读
/// `context.qzScheme` 取主题色），不报错。
class QzExchangeLogo extends StatelessWidget {
  const QzExchangeLogo({super.key, required this.exchange, this.size = 36});

  final String exchange;
  final double size;

  static const Map<String, _ExchangeBrand> _brands = <String, _ExchangeBrand>{
    'binance': _ExchangeBrand(
      bg: Color(0xFF181A20),
      fg: Color(0xFFF3BA2F),
      glyph: _ExchangeGlyph.binance,
      scale: 0.72,
    ),
    'okx': _ExchangeBrand(
      bg: Color(0xFF000000),
      fg: Color(0xFFFFFFFF),
      glyph: _ExchangeGlyph.okx,
      scale: 0.66,
    ),
    'hyperliquid': _ExchangeBrand(
      bg: Color(0xFF0B3D33),
      fg: Color(0xFF7CFFCB),
      glyph: _ExchangeGlyph.hyperliquid,
      scale: 0.62,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final _ExchangeBrand? brand = _brands[exchange.toLowerCase()];
    final BorderRadius radius = BorderRadius.circular(size / 3.5);

    if (brand == null) {
      // 缺省占位：灰底 + 首字母，与原灰底首字母行为一致。
      final c = context.qzScheme;
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: c.bgSoft, borderRadius: radius),
        alignment: Alignment.center,
        child: Text(
          exchange.isEmpty ? '?' : exchange.substring(0, 1).toUpperCase(),
          style: TextStyle(
            color: c.text,
            fontSize: size * 0.4,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: brand.bg, borderRadius: radius),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: CustomPaint(
        size: Size.square(size * brand.scale),
        painter: _ExchangeGlyphPainter(glyph: brand.glyph, color: brand.fg),
      ),
    );
  }
}

enum _ExchangeGlyph { binance, okx, hyperliquid }

class _ExchangeBrand {
  const _ExchangeBrand({
    required this.bg,
    required this.fg,
    required this.glyph,
    required this.scale,
  });

  final Color bg;
  final Color fg;
  final _ExchangeGlyph glyph;
  final double scale;
}

/// 在 32x32 设计稿坐标系内绘制各家品牌矢量图形，按画布尺寸等比缩放。
class _ExchangeGlyphPainter extends CustomPainter {
  const _ExchangeGlyphPainter({required this.glyph, required this.color});

  final _ExchangeGlyph glyph;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;
    final double k = size.width / 32; // 设计稿 viewBox 32x32 → 实际像素比例

    switch (glyph) {
      case _ExchangeGlyph.binance:
        _binance(canvas, paint, k);
        break;
      case _ExchangeGlyph.okx:
        _okx(canvas, paint, k);
        break;
      case _ExchangeGlyph.hyperliquid:
        _hyperliquid(canvas, paint, k);
        break;
    }
  }

  // 五菱风车：中心大菱形 + 上下左右四个小菱形。
  void _binance(Canvas canvas, Paint paint, double k) {
    void diamond(double cx, double cy, double r) {
      final Path p = Path()
        ..moveTo(cx * k, (cy - r) * k)
        ..lineTo((cx + r) * k, cy * k)
        ..lineTo(cx * k, (cy + r) * k)
        ..lineTo((cx - r) * k, cy * k)
        ..close();
      canvas.drawPath(p, paint);
    }

    diamond(16, 16, 10); // 中心
    diamond(16, 4.5, 2.5); // 上
    diamond(16, 27.5, 2.5); // 下
    diamond(4.5, 16, 2.5); // 左
    diamond(27.5, 16, 2.5); // 右
  }

  // 九宫格五格：对角分布的 5 个方块。
  void _okx(Canvas canvas, Paint paint, double k) {
    void square(double x, double y, double s) {
      canvas.drawRect(Rect.fromLTWH(x * k, y * k, s * k, s * k), paint);
    }

    square(3, 3, 8);
    square(12, 12, 8);
    square(3, 21, 8);
    square(21, 3, 8);
    square(21, 21, 8);
  }

  // 风格化 H：两根竖柱 + 粗横梁。
  void _hyperliquid(Canvas canvas, Paint paint, double k) {
    final RRect left = RRect.fromRectAndRadius(
      Rect.fromLTWH(5 * k, 5 * k, 5 * k, 22 * k),
      Radius.circular(1 * k),
    );
    final RRect right = RRect.fromRectAndRadius(
      Rect.fromLTWH(22 * k, 5 * k, 5 * k, 22 * k),
      Radius.circular(1 * k),
    );
    canvas.drawRRect(left, paint);
    canvas.drawRRect(right, paint);
    canvas.drawRect(Rect.fromLTWH(5 * k, 13.5 * k, 22 * k, 5 * k), paint);
  }

  @override
  bool shouldRepaint(_ExchangeGlyphPainter old) =>
      old.glyph != glyph || old.color != color;
}

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../data/models/exchange_long_short_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 单家交易所多空分布行。
class ExchangeLongShortTile extends StatelessWidget {
  const ExchangeLongShortTile({
    super.key,
    required this.rank,
    required this.item,
    this.showDivider = true,
  });

  final int rank;
  final ExchangeLongShort item;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final double l = item.longPct.clamp(0.0, 100.0);
    final double s = item.shortPct.clamp(0.0, 100.0);
    final double total = l + s;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(bottom: BorderSide(color: c.borderSoft))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              _ExchangeIcon(item: item),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Text(
                  item.exchange,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _AmountColumn(
                label: '做多',
                amount: item.longAmount,
                color: c.marketUp,
              ),
              const SizedBox(width: QzSpacing.md),
              SizedBox(
                width: 62,
                child: _AmountColumn(
                  label: '做空',
                  amount: item.shortAmount,
                  color: c.marketDown,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          if (total <= 0)
            _EmptyRatioBar(exchange: item.exchange)
          else
            _RatioBar(exchange: item.exchange, longPct: l, shortPct: s),
        ],
      ),
    );
  }
}

class _ExchangeIcon extends StatelessWidget {
  const _ExchangeIcon({required this.item});

  final ExchangeLongShort item;

  @override
  Widget build(BuildContext context) {
    final Color glyphFg =
        ThemeData.estimateBrightnessForColor(item.color) == Brightness.dark
        ? Colors.white
        : Colors.black;
    return Container(
      key: Key('exchange-long-short-icon-${item.exchange}'),
      width: 20,
      height: 20,
      decoration: BoxDecoration(color: item.color, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        item.glyph,
        style: TextStyle(
          color: glyphFg,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

class _AmountColumn extends StatelessWidget {
  const _AmountColumn({
    required this.label,
    required this.amount,
    required this.color,
  });

  final String label;
  final String amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 9.5)),
        const SizedBox(height: 2),
        Text(
          amount,
          style: TextStyle(
            color: color,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _RatioBar extends StatelessWidget {
  const _RatioBar({
    required this.exchange,
    required this.longPct,
    required this.shortPct,
  });

  final String exchange;
  final double longPct;
  final double shortPct;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final double total = longPct + shortPct;
    final double longShare = total > 0 ? longPct / total : 0.5;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final double longWidth = math.max(18, width * longShare);
        final double shortWidth = math.max(18, width - longWidth);
        final double fittedLongWidth = width - shortWidth;
        return ClipRRect(
          key: Key('exchange-long-short-ratio-bar-$exchange'),
          borderRadius: BorderRadius.circular(4),
          child: SizedBox(
            height: 18,
            child: Row(
              children: <Widget>[
                SizedBox(
                  width: fittedLongWidth,
                  child: _RatioSegment(
                    color: c.marketUp,
                    text: '${longPct.toStringAsFixed(1)}%',
                    showText: longPct >= 8,
                  ),
                ),
                SizedBox(
                  width: shortWidth,
                  child: _RatioSegment(
                    color: c.marketDown,
                    text: '${shortPct.toStringAsFixed(1)}%',
                    showText: shortPct >= 8,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RatioSegment extends StatelessWidget {
  const _RatioSegment({
    required this.color,
    required this.text,
    required this.showText,
  });

  final Color color;
  final String text;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: showText
          ? Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.clip,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
                height: 1,
              ),
            )
          : null,
    );
  }
}

class _EmptyRatioBar extends StatelessWidget {
  const _EmptyRatioBar({required this.exchange});

  final String exchange;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return CustomPaint(
      key: Key('exchange-long-short-empty-bar-$exchange'),
      painter: _DashedBorderPainter(color: c.borderSoft),
      child: Container(
        height: 18,
        decoration: BoxDecoration(
          color: c.bgSoft,
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    final RRect rect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(4),
    );
    final Path path = Path()..addRRect(rect);
    for (final ui.PathMetric metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 4), paint);
        distance += 8;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color;
}

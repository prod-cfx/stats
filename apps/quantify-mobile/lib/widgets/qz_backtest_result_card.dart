import 'package:flutter/material.dart';

import '../data/models/backtest_models.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_card.dart';

/// Backtest summary card embedded inline in the AI chat stream.
///
/// Renders a small equity-curve sparkline at the top, then a 2×2 stat grid
/// (total return / max drawdown / sharpe / trades). Return / drawdown values
/// are color-tinted via `marketUp` / `marketDown`.
///
/// Note: `BacktestResult` has no `winRate` field today, so the bottom-right
/// cell reports trade count (`成交 N 笔`). When/if winRate is added we can
/// swap this single Stat without touching the layout.
class QzBacktestResultCard extends StatelessWidget {
  const QzBacktestResultCard({super.key, required this.result});

  final BacktestResult result;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '回测结果',
            style: TextStyle(
              color: c.text,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          SizedBox(
            height: 56,
            width: double.infinity,
            child: CustomPaint(
              painter: _SparklinePainter(
                points: result.equityCurve,
                color: result.totalReturnPercent >= 0
                    ? c.marketUp
                    : c.marketDown,
              ),
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _Stat(
                  label: '总收益',
                  value:
                      '${result.totalReturnPercent >= 0 ? '+' : ''}${result.totalReturnPercent.toStringAsFixed(2)}%',
                  valueColor: result.totalReturnPercent >= 0
                      ? c.marketUp
                      : c.marketDown,
                ),
              ),
              Expanded(
                child: _Stat(
                  label: '最大回撤',
                  value:
                      '${result.maxDrawdownPercent.toStringAsFixed(2)}%',
                  valueColor: c.marketDown,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _Stat(
                  label: '夏普',
                  value: result.sharpe.toStringAsFixed(2),
                  valueColor: c.text,
                ),
              ),
              Expanded(
                child: _Stat(
                  label: '成交',
                  value: '${result.trades} 笔',
                  valueColor: c.text,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textDim, fontSize: 11),
        ),
        const SizedBox(height: QzSpacing.xxs),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/// Minimal polyline sparkline. Normalizes [points] to the canvas, draws one
/// stroke. Empty / single-point inputs render a flat baseline so callers
/// don't need to guard against degenerate curves.
class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.points, required this.color});

  final List<double> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeJoin = StrokeJoin.round;

    double minV = points.first;
    double maxV = points.first;
    for (final double v in points) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    final double span = (maxV - minV).abs();
    final double dx = points.length > 1
        ? size.width / (points.length - 1)
        : size.width;
    final Path path = Path();
    for (int i = 0; i < points.length; i++) {
      final double x = dx * i;
      final double normY = span == 0 ? 0.5 : (points[i] - minV) / span;
      final double y = size.height - normY * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) {
    // Reference equality on [points] is intentional: callers pass either a
    // shared const fixture (no change → no repaint) or a freshly built
    // `BacktestResult`, in which case a new list instance signals real new
    // data. Deep-list compare would be wasted work for the common path.
    return old.points != points || old.color != color;
  }
}

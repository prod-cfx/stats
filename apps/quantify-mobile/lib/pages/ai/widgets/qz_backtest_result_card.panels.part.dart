part of 'qz_backtest_result_card.dart';
// ignore_for_file: unused_element

/// 月度回报热力图：年×12 网格，正绿负红按幅度调透明度。
class _MonthlyHeatmap extends StatelessWidget {
  const _MonthlyHeatmap({required this.rows});

  final List<BacktestMonthlyRow> rows;

  Color _cellColor(double? v, QzColorScheme c) {
    if (v == null) return c.bgSoft;
    if (v > 0) {
      final double a = (v / 16).clamp(0.0, 1.0) * 0.75 + 0.12;
      return c.marketUp.withValues(alpha: a);
    }
    final double a = (v.abs() / 12).clamp(0.0, 1.0) * 0.75 + 0.12;
    return c.marketDown.withValues(alpha: a);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 月份表头
          Row(
            children: <Widget>[
              const SizedBox(width: 26),
              for (int m = 1; m <= 12; m++)
                Expanded(
                  child: Center(
                    child: Text(
                      '$m',
                      style: TextStyle(color: c.textDim, fontSize: 9),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 3),
          for (final BacktestMonthlyRow row in rows) ...<Widget>[
            Row(
              children: <Widget>[
                SizedBox(
                  width: 26,
                  child: Text(
                    '${row.year}',
                    style: TextStyle(color: c.textMid, fontSize: 9),
                  ),
                ),
                for (final double? v in row.values)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(1.5),
                      child: Container(
                        height: 20,
                        decoration: BoxDecoration(
                          color: _cellColor(v, c),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          v == null
                              ? ''
                              : '${v > 0 ? '+' : ''}${v.toStringAsFixed(0)}',
                          style: TextStyle(
                            color: v == null
                                ? c.textFaint
                                : (v > 0 ? c.marketUp : c.marketDown),
                            fontSize: 8,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
          ],
          const SizedBox(height: QzSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                l10n.backtestResultMonthlyLegendLabel,
                style: TextStyle(color: c.textDim, fontSize: 10),
              ),
              Row(
                children: <Widget>[
                  Text(
                    '-15%',
                    style: TextStyle(color: c.marketDown, fontSize: 10),
                  ),
                  const SizedBox(width: QzSpacing.xs),
                  Container(
                    width: 64,
                    height: 8,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      gradient: LinearGradient(
                        colors: <Color>[
                          c.marketDown,
                          c.marketDown.withValues(alpha: 0.2),
                          c.marketUp.withValues(alpha: 0.2),
                          c.marketUp,
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: QzSpacing.xs),
                  Text(
                    '+20%',
                    style: TextStyle(color: c.marketUp, fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 交易记录列表。
class _TradeList extends StatelessWidget {
  const _TradeList({required this.trades});

  final List<BacktestTrade> trades;

  String _fmtPrice(double v) {
    final String s = v.toStringAsFixed(2);
    final List<String> parts = s.split('.');
    final String intPart = parts[0].replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (Match m) => '${m[1]},',
    );
    return '$intPart.${parts[1]}';
  }

  String _fmtTime(DateTime t) =>
      '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')} '
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: <Widget>[
          for (int i = 0; i < trades.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.md,
                vertical: QzSpacing.md,
              ),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : Border(top: BorderSide(color: c.borderSoft)),
              ),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: (trades[i].win ? c.marketUp : c.marketDown)
                          .withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      trades[i].side == 'long'
                          ? l10n.backtestResultTradeSideLong
                          : l10n.backtestResultTradeSideShort,
                      style: TextStyle(
                        color: trades[i].win ? c.marketUp : c.marketDown,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Text(
                              _fmtPrice(trades[i].entry),
                              style: TextStyle(color: c.text, fontSize: 12),
                            ),
                            Text(
                              ' → ',
                              style: TextStyle(color: c.textDim, fontSize: 12),
                            ),
                            Text(
                              _fmtPrice(trades[i].exit),
                              style: TextStyle(color: c.text, fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_fmtTime(trades[i].time)} · ${l10n.backtestResultTradeHoldPrefix} ${trades[i].duration}',
                          style: TextStyle(color: c.textDim, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm),
                  Text(
                    '${trades[i].pnlPercent > 0 ? '+' : ''}${trades[i].pnlPercent.toStringAsFixed(2)}%',
                    style: TextStyle(
                      color: trades[i].win ? c.marketUp : c.marketDown,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// 风险分析：每行 label/value + 进度条 + 说明。
class _RiskAnalysis extends StatelessWidget {
  const _RiskAnalysis({required this.rows});

  final List<BacktestRiskRow> rows;

  Color _toneColor(BacktestRiskTone tone, QzColorScheme c) {
    switch (tone) {
      case BacktestRiskTone.danger:
        return c.statusDanger;
      case BacktestRiskTone.warn:
        return c.statusWarn;
      case BacktestRiskTone.neutral:
        return c.textMid;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (int i = 0; i < rows.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : QzSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Text(
                        rows[i].label,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        rows[i].value,
                        style: TextStyle(
                          color: _toneColor(rows[i].tone, c),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: QzSpacing.xxs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: rows[i].barFraction.clamp(0.0, 1.0),
                      minHeight: 4,
                      backgroundColor: c.bgSoft,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _toneColor(rows[i].tone, c),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    rows[i].note,
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _AiAssessmentBar extends StatelessWidget {
  const _AiAssessmentBar({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.smart_toy_outlined, size: 14, color: c.accent),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(color: c.accent, fontSize: 12, height: 1.5),
                children: <InlineSpan>[
                  TextSpan(
                    text: l10n.backtestResultAiPrefix,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  TextSpan(text: text),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 净值曲线：归一化描边 + 渐变填充 + 回撤红点 markers。空/单点画平基线。
class _EquityCurvePainter extends CustomPainter {
  _EquityCurvePainter({
    required this.points,
    required this.markers,
    required this.lineColor,
    required this.fillColor,
    required this.markerColor,
    required this.markerBorder,
  });

  final List<double> points;
  final List<int> markers;
  final Color lineColor;
  final Color fillColor;
  final Color markerColor;
  final Color markerBorder;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

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

    double xAt(int i) => dx * i;
    double yAt(double v) {
      final double normY = span == 0 ? 0.5 : (v - minV) / span;
      return size.height - normY * size.height;
    }

    // baseline grid
    final Paint grid = Paint()
      ..color = lineColor.withValues(alpha: 0.12)
      ..strokeWidth = 1;
    for (final double f in <double>[0.25, 0.5, 0.75]) {
      canvas.drawLine(
        Offset(0, size.height * f),
        Offset(size.width, size.height * f),
        grid,
      );
    }

    final Path line = Path();
    for (int i = 0; i < points.length; i++) {
      final double x = xAt(i);
      final double y = yAt(points[i]);
      if (i == 0) {
        line.moveTo(x, y);
      } else {
        line.lineTo(x, y);
      }
    }

    // fill under the curve
    final Path fill = Path.from(line)
      ..lineTo(xAt(points.length - 1), size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()..color = fillColor);

    canvas.drawPath(
      line,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeJoin = StrokeJoin.round,
    );

    // drawdown markers
    for (final int i in markers) {
      if (i < 0 || i >= points.length) continue;
      final Offset o = Offset(xAt(i), yAt(points[i]));
      canvas.drawCircle(o, 3.5, Paint()..color = markerBorder);
      canvas.drawCircle(o, 2.5, Paint()..color = markerColor);
    }
  }

  @override
  bool shouldRepaint(covariant _EquityCurvePainter old) {
    return old.points != points ||
        old.markers != markers ||
        old.lineColor != lineColor ||
        old.fillColor != fillColor ||
        old.markerColor != markerColor;
  }
}

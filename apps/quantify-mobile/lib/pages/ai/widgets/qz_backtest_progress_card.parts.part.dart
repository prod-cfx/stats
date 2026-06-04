part of 'qz_backtest_progress_card.dart';
// ignore_for_file: unused_element

/// 圆形进度环 + 中心百分比 + 预计剩余秒数。
class _ProgressRing extends StatelessWidget {
  const _ProgressRing({required this.progress, required this.pct});

  final double progress;
  final int pct;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 对齐设计稿：剩余秒数 = max(1, round((100-pct) * 0.4))。
    final int etaSeconds = math.max(1, ((100 - pct) * 0.4).round());

    return Center(
      child: SizedBox(
        width: 168,
        height: 168,
        child: Stack(
          alignment: Alignment.center,
          children: <Widget>[
            CustomPaint(
              key: const Key('backtest-progress-ring'),
              size: const Size(168, 168),
              painter: _RingPainter(
                progress: progress,
                track: c.bgInput,
                start: c.accent2,
                end: c.accent,
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                RichText(
                  key: const Key('backtest-progress-percent'),
                  text: TextSpan(
                    children: <InlineSpan>[
                      TextSpan(
                        text: '$pct',
                        style: TextStyle(
                          color: c.text,
                          fontSize: 36,
                          fontWeight: FontWeight.w700,
                          height: 1,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                      TextSpan(
                        text: '%',
                        style: TextStyle(
                          color: c.textMid,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: QzSpacing.xs),
                Text(
                  l10n.backtestRunEta(etaSeconds),
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    letterSpacing: 0.4,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.track,
    required this.start,
    required this.end,
  });

  final double progress;
  final Color track;
  final Color start;
  final Color end;
  static const double _stroke = 12;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double radius = (size.width - _stroke) / 2;
    final Rect rect = Rect.fromCircle(center: center, radius: radius);

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = _stroke,
    );

    if (progress <= 0) return;
    const double startAngle = -math.pi / 2;
    final double sweep = 2 * math.pi * progress;
    final Paint arc = Paint()
      ..shader = SweepGradient(
        startAngle: startAngle,
        endAngle: startAngle + 2 * math.pi,
        colors: <Color>[start, end],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, startAngle, sweep, false, arc);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.progress != progress ||
      old.track != track ||
      old.start != start ||
      old.end != end;
}

/// 2×2 实时计数。
class _CountersGrid extends StatelessWidget {
  const _CountersGrid({
    required this.processedBars,
    required this.totalBars,
    required this.trades,
    required this.wins,
    required this.losses,
    required this.drawdownPct,
    required this.cumReturnPct,
    required this.fmt,
  });

  final int processedBars;
  final int totalBars;
  final int trades;
  final int wins;
  final int losses;
  final double drawdownPct;
  final double cumReturnPct;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;

    return Column(
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: _Counter(
                label: l10n.backtestRunCounterProcessedBars,
                value: fmt.format(processedBars),
                sub: l10n.backtestRunCounterProcessedBarsSub(
                  fmt.format(totalBars),
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _Counter(
                label: l10n.backtestRunCounterTrades,
                value: '$trades',
                sub: l10n.backtestRunCounterTradesSub(wins, losses),
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.sm),
        Row(
          children: <Widget>[
            Expanded(
              child: _Counter(
                label: l10n.backtestRunCounterMaxDrawdown,
                value: '-${drawdownPct.toStringAsFixed(2)}%',
                tone: c.statusDanger,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _Counter(
                label: l10n.backtestRunCounterCumReturn,
                value: '+${cumReturnPct.toStringAsFixed(2)}%',
                tone: c.statusOk,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({
    required this.label,
    required this.value,
    this.sub,
    this.tone,
  });

  final String label;
  final String value;
  final String? sub;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: QzSpacing.xs),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tone ?? c.text,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
          if (sub != null) ...<Widget>[
            const SizedBox(height: 2),
            Text(
              sub!,
              style: TextStyle(
                color: c.textDim,
                fontSize: 11,
                fontFeatures: const <FontFeature>[
                  FontFeature.tabularFigures(),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 实时净值曲线卡（带时间轴）。
class _EquityCard extends StatelessWidget {
  const _EquityCard({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        children: <Widget>[
          SizedBox(
            height: 120,
            width: double.infinity,
            child: CustomPaint(
              key: const Key('backtest-progress-equity'),
              painter: _LiveCurvePainter(
                progress: progress,
                line: c.accent,
                grid: c.borderSoft,
                dotBorder: c.bgElev,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 0, 2, 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text('2021-01',
                    style: TextStyle(color: c.textDim, fontSize: 10)),
                Text('2026-05',
                    style: TextStyle(color: c.textDim, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveCurvePainter extends CustomPainter {
  _LiveCurvePainter({
    required this.progress,
    required this.line,
    required this.grid,
    required this.dotBorder,
  });

  final double progress;
  final Color line;
  final Color grid;
  final Color dotBorder;

  // 对齐设计稿 seed（36 点）。
  static const List<double> _seed = <double>[
    100, 99, 103, 107, 104, 108, 113, 109, 115, 118, 116, 121,
    119, 125, 130, 127, 133, 131, 128, 134, 138, 135, 141, 139,
    135, 140, 144, 142, 138, 131, 135, 140, 146, 142, 148, 152,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final double minV = _seed.reduce(math.min);
    final double maxV = _seed.reduce(math.max);
    final double span = (maxV - minV) == 0 ? 1 : (maxV - minV);

    // 网格基线。
    final Paint gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (final double f in <double>[0.25, 0.5, 0.75]) {
      canvas.drawLine(
        Offset(0, size.height * f),
        Offset(size.width, size.height * f),
        gridPaint,
      );
    }

    final int n = math.max(2, (_seed.length * progress).round());
    final List<Offset> pts = <Offset>[];
    for (int i = 0; i < n; i++) {
      final double x = (i / (_seed.length - 1)) * (size.width - 12) + 6;
      final double y = (1 - (_seed[i] - minV) / span) * (size.height - 20) + 10;
      pts.add(Offset(x, y));
    }

    final Path linePath = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (int i = 1; i < pts.length; i++) {
      linePath.lineTo(pts[i].dx, pts[i].dy);
    }

    // 渐变填充。
    final Path fill = Path.from(linePath)
      ..lineTo(pts.last.dx, size.height - 6)
      ..lineTo(6, size.height - 6)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            line.withValues(alpha: 0.25),
            line.withValues(alpha: 0),
          ],
        ).createShader(Offset.zero & size),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeJoin = StrokeJoin.round,
    );

    // 前导点：柔光晕 + 实心点 + 描边（静态，无无限动画）。
    final Offset last = pts.last;
    canvas.drawCircle(
        last, 9, Paint()..color = line.withValues(alpha: 0.18));
    canvas.drawCircle(last, 4, Paint()..color = line);
    canvas.drawCircle(
      last,
      4,
      Paint()
        ..color = dotBorder
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(covariant _LiveCurvePainter old) =>
      old.progress != progress ||
      old.line != line ||
      old.grid != grid ||
      old.dotBorder != dotBorder;
}

/// 引擎日志列表，按 [progress] 揭示条数，按 ok/up/danger 着色。
class _EngineLog extends StatelessWidget {
  const _EngineLog({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({String t, String m, Color tone})> logs =
        <({String t, String m, Color tone})>[
      (t: '09:41:03', m: l10n.backtestRunLogLoad, tone: c.textMid),
      (t: '09:41:04', m: l10n.backtestRunLogIndex, tone: c.textMid),
      (t: '09:41:05', m: l10n.backtestRunLogReplay, tone: c.textMid),
      (t: '09:41:07', m: l10n.backtestRunLogOpenLong1, tone: c.statusOk),
      (t: '09:41:09', m: l10n.backtestRunLogCloseLong1, tone: c.statusOk),
      (t: '09:41:11', m: l10n.backtestRunLogOpenLong2, tone: c.statusOk),
      (t: '09:41:13', m: l10n.backtestRunLogStopLoss, tone: c.statusDanger),
    ];
    final int visible =
        (logs.length * progress).ceil().clamp(1, logs.length);

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          for (int i = 0; i < visible; i++)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                border: i > 0
                    ? Border(top: BorderSide(color: c.borderSoft))
                    : null,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    logs[i].t,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 11,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: Text(
                      logs[i].m,
                      style: TextStyle(color: logs[i].tone, fontSize: 11),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(
        color: c.textMid,
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 14, color: c.accent),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: c.accent, fontSize: 12, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}

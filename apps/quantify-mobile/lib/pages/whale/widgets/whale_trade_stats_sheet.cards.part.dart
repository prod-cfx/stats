part of 'whale_trade_stats_sheet.dart';
// ignore_for_file: unused_element

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.onClose});
  final String title;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    // 设计稿 jsx:2216 header padding 14px 16px 12px（上 14 / 左右 16 / 下 12）。
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Row(
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: c.text,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          SizedBox(
            width: 30,
            height: 30,
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: const Icon(Icons.close, size: 18),
              color: c.textMid,
              onPressed: onClose,
            ),
          ),
        ],
      ),
    );
  }
}

class _AddressChip extends StatelessWidget {
  const _AddressChip({required this.address, this.glyph, this.colorHex});
  final String address;
  final String? glyph;
  final int? colorHex;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color avatarColor = colorHex != null ? Color(colorHex!) : c.accent;
    final String letter = (glyph != null && glyph!.isNotEmpty)
        ? glyph!
        : _firstChar(address);
    return Container(
      padding: const EdgeInsets.fromLTRB(5, 5, 10, 5),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: avatarColor,
              shape: BoxShape.circle,
            ),
            child: Text(
              letter,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                fontFamily: QzFont.mono,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              address,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.text,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _firstChar(String s) {
    final String trimmed = s.replaceFirst(RegExp(r'^0x'), '');
    return trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
  }
}

/// 周期选择器（issue #1966 决策方案 A）：对齐设计真源 jsx:2242 的 `PillSelect`
/// 下拉形态——单药丸显示当前周期 + chevron，点击展开列表选择，而非分段平铺。
class _PeriodSelect extends StatelessWidget {
  const _PeriodSelect({required this.value, required this.onChanged});
  final _Period value;
  final ValueChanged<_Period> onChanged;

  String _label(AppLocalizations l10n, _Period p) {
    switch (p) {
      case _Period.day:
        return l10n.whaleTradeStatsPeriodDay;
      case _Period.week:
        return l10n.whaleTradeStatsPeriodWeek;
      case _Period.month:
        return l10n.whaleTradeStatsPeriodMonth;
      case _Period.all:
        return l10n.whaleTradeStatsPeriodAll;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return PopupMenuButton<_Period>(
      tooltip: '',
      initialValue: value,
      onSelected: onChanged,
      offset: const Offset(0, 32),
      itemBuilder: (BuildContext context) => <PopupMenuEntry<_Period>>[
        for (final _Period p in _Period.values)
          PopupMenuItem<_Period>(
            value: p,
            height: 36,
            child: Text(
              _label(l10n, p),
              style: TextStyle(
                color: p == value ? c.accent : c.text,
                fontSize: 12,
                fontWeight: p == value ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
      ],
      // 设计 jsx:1122 药丸：elev 底 + border，当前周期文字 + chevron。
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              _label(l10n, value),
              style: TextStyle(
                color: c.text,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 5),
            Icon(Icons.keyboard_arrow_down, size: 14, color: c.textMid),
          ],
        ),
      ),
    );
  }
}

class _StatCardShell extends StatelessWidget {
  const _StatCardShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

class _WinRateCard extends StatelessWidget {
  const _WinRateCard({required this.stats});
  final WhaleTradeStats stats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return _StatCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(
                l10n.whaleProfileStatWinRate,
                style: TextStyle(color: c.textMid, fontSize: 11),
              ),
              const SizedBox(width: 4),
              Icon(Icons.info_outline, size: 11, color: c.textFaint),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${stats.winRatePct.toStringAsFixed(2)}%',
            style: TextStyle(
              color: c.text,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              height: 1,
              fontFamily: QzFont.mono,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.borderSoft)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _MiniMetric(
                  label: l10n.whaleTradeStatsClosedPnl,
                  value: stats.closedPnlDisplay ?? stats.pnlDisplay,
                  color: c.marketUp,
                ),
                const SizedBox(height: 9),
                _MiniMetric(
                  label: l10n.whaleTradeStatsFeeAdjusted,
                  value:
                      stats.feeAdjustedPnlDisplay ??
                      stats.closedPnlDisplay ??
                      stats.pnlDisplay,
                  color: c.text,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textDim, fontSize: 9.5, letterSpacing: 0.2),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
          ),
        ),
      ],
    );
  }
}

class _TradeCountCard extends StatelessWidget {
  const _TradeCountCard({required this.stats});
  final WhaleTradeStats stats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final int total = stats.tradesTotal ?? 0;
    final int wins = stats.wins ?? 0;
    final int losses = stats.losses ?? 0;
    return _StatCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.whaleTradeStatsTradeCount,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            '$total',
            style: TextStyle(
              color: c.text,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              height: 1,
              fontFamily: QzFont.mono,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    children: <Widget>[
                      _LegendRow(
                        color: c.marketUp,
                        label: l10n.whaleTradeStatsWins,
                        value: wins,
                      ),
                      const SizedBox(height: 6),
                      _LegendRow(
                        color: c.marketDown,
                        label: l10n.whaleTradeStatsLosses,
                        value: losses,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                _DonutTwo(wins: wins, losses: losses),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.color,
    required this.label,
    required this.value,
  });
  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: c.textMid, fontSize: 11)),
        const Spacer(),
        Text(
          '$value',
          style: TextStyle(
            color: c.text,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
          ),
        ),
      ],
    );
  }
}

class _DonutTwo extends StatelessWidget {
  const _DonutTwo({required this.wins, required this.losses});
  final int wins;
  final int losses;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: 60,
      height: 60,
      child: CustomPaint(
        painter: _DonutTwoPainter(
          wins: wins,
          losses: losses,
          upColor: c.marketUp,
          dnColor: c.marketDown,
        ),
        child: Center(
          child: Text(
            '${wins + losses}',
            style: TextStyle(
              color: c.text,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
            ),
          ),
        ),
      ),
    );
  }
}

class _DonutTwoPainter extends CustomPainter {
  _DonutTwoPainter({
    required this.wins,
    required this.losses,
    required this.upColor,
    required this.dnColor,
  });
  final int wins;
  final int losses;
  final Color upColor;
  final Color dnColor;

  @override
  void paint(Canvas canvas, Size size) {
    const double r = 22;
    const double stroke = 7;
    final Offset center = Offset(size.width / 2, size.height / 2);
    final int sum = wins + losses == 0 ? 1 : wins + losses;
    final double winFrac = wins / sum;
    final double lossFrac = losses / sum;
    const double start = -math.pi / 2; // 12 点方向起笔
    final Rect rect = Rect.fromCircle(center: center, radius: r);

    final Paint p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;

    // 亏损段在前（与设计 DonutTwo 顺序一致），盈利段续接。
    p.color = dnColor;
    canvas.drawArc(rect, start, 2 * math.pi * lossFrac, false, p);
    p.color = upColor;
    canvas.drawArc(
      rect,
      start + 2 * math.pi * lossFrac,
      2 * math.pi * winFrac,
      false,
      p,
    );
  }

  @override
  bool shouldRepaint(_DonutTwoPainter old) =>
      old.wins != wins ||
      old.losses != losses ||
      old.upColor != upColor ||
      old.dnColor != dnColor;
}

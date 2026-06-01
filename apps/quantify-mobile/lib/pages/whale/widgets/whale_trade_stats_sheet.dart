import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 交易统计弹窗（issue #1859）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx` 的
/// `WhaleTradeStats`（`:2183`）。底部上滑 modal：地址 chip + 周期 PillSelect →
/// 胜率卡 + 交易次数环图卡 → 「按资产 / 按仓位」双子 tab + PerfRow 列表。
///
/// 入参与 [WhaleProfile] 解耦（只收 address + stats + 可选头像），便于发现 tab
/// 卡片入口（#1860）独立唤起，不必持有完整 profile。
class WhaleTradeStatsSheet extends StatefulWidget {
  const WhaleTradeStatsSheet({
    super.key,
    required this.address,
    required this.stats,
    this.avatarGlyph,
    this.avatarColorHex,
  });

  final String address;
  final WhaleTradeStats stats;
  final String? avatarGlyph;
  final int? avatarColorHex;

  static Future<void> show(
    BuildContext context, {
    required String address,
    required WhaleTradeStats stats,
    String? avatarGlyph,
    int? avatarColorHex,
  }) {
    return QzSheet.show<void>(
      context: context,
      builder: (BuildContext ctx) => WhaleTradeStatsSheet(
        address: address,
        stats: stats,
        avatarGlyph: avatarGlyph,
        avatarColorHex: avatarColorHex,
      ),
    );
  }

  @override
  State<WhaleTradeStatsSheet> createState() => _WhaleTradeStatsSheetState();
}

enum _Period { day, week, month, all }

enum _PerfTab { asset, position }

class _WhaleTradeStatsSheetState extends State<WhaleTradeStatsSheet> {
  _Period _period = _Period.week;
  _PerfTab _tab = _PerfTab.asset;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleTradeStats s = widget.stats;
    final double maxH = MediaQuery.sizeOf(context).height * 0.88;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxH),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _Header(title: l10n.whaleTradeStatsTitle, onClose: () {
            Navigator.of(context).pop();
          }),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              0,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: Row(
              children: <Widget>[
                _AddressChip(
                  address: widget.address,
                  glyph: widget.avatarGlyph,
                  colorHex: widget.avatarColorHex,
                ),
                const Spacer(),
                _PeriodSelect(
                  value: _period,
                  onChanged: (_Period p) => setState(() => _period = p),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Expanded(child: _WinRateCard(stats: s)),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(child: _TradeCountCard(stats: s)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.lg,
              QzSpacing.lg,
              0,
            ),
            child: Text(
              l10n.whaleTradeStatsPerfTitle,
              style: TextStyle(
                color: c.text,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _PerfTabs(
            value: _tab,
            onChanged: (_PerfTab t) => setState(() => _tab = t),
          ),
          _PerfList(stats: s, tab: _tab),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            color: c.textMid,
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _AddressChip extends StatelessWidget {
  const _AddressChip({
    required this.address,
    this.glyph,
    this.colorHex,
  });
  final String address;
  final String? glyph;
  final int? colorHex;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color avatarColor = colorHex != null ? Color(colorHex!) : c.accent;
    final String letter =
        (glyph != null && glyph!.isNotEmpty) ? glyph! : _firstChar(address);
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
          Text(
            address,
            style: TextStyle(
              color: c.text,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              fontFamily: QzFont.mono,
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

class _PeriodSelect extends StatelessWidget {
  const _PeriodSelect({required this.value, required this.onChanged});
  final _Period value;
  final ValueChanged<_Period> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<(_Period, String)> opts = <(_Period, String)>[
      (_Period.day, l10n.whaleTradeStatsPeriodDay),
      (_Period.week, l10n.whaleTradeStatsPeriodWeek),
      (_Period.month, l10n.whaleTradeStatsPeriodMonth),
      (_Period.all, l10n.whaleTradeStatsPeriodAll),
    ];
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final (_Period, String) o in opts)
            GestureDetector(
              onTap: () => onChanged(o.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: o.$1 == value ? c.bgElev : Colors.transparent,
                  borderRadius: BorderRadius.circular(QzRadii.pill),
                ),
                child: Text(
                  o.$2,
                  style: TextStyle(
                    color: o.$1 == value ? c.text : c.textDim,
                    fontSize: 11,
                    fontWeight:
                        o.$1 == value ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
        ],
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
                  value: stats.feeAdjustedPnlDisplay ??
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
          style: TextStyle(
            color: c.textDim,
            fontSize: 9.5,
            letterSpacing: 0.2,
          ),
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

class _PerfTabs extends StatelessWidget {
  const _PerfTabs({required this.value, required this.onChanged});
  final _PerfTab value;
  final ValueChanged<_PerfTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<(_PerfTab, String)> tabs = <(_PerfTab, String)>[
      (_PerfTab.asset, l10n.whaleTradeStatsByAsset),
      (_PerfTab.position, l10n.whaleTradeStatsByPosition),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(QzSpacing.lg, 10, QzSpacing.lg, 0),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          for (final (_PerfTab, String) t in tabs)
            GestureDetector(
              onTap: () => onChanged(t.$1),
              child: Padding(
                padding: const EdgeInsets.only(right: 18),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: t.$1 == value ? c.accent : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    t.$2,
                    style: TextStyle(
                      color: t.$1 == value ? c.accent : c.textMid,
                      fontSize: 12,
                      fontWeight:
                          t.$1 == value ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PerfList extends StatelessWidget {
  const _PerfList({required this.stats, required this.tab});
  final WhaleTradeStats stats;
  final _PerfTab tab;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 设计稿 jsx:2334：tradesTotal==0 || winRate<0.01（winRate 为分数 0..1，
    // 对应此处 winRatePct 为整数百分比 0..100，winRate<0.01 即 winRatePct<1）
    // → 视为无有效成交，展示空态。
    final bool empty =
        (stats.tradesTotal ?? 0) == 0 || stats.winRatePct < 1;
    if (empty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Text(
            l10n.whaleTradeStatsEmpty,
            style: TextStyle(color: c.textFaint, fontSize: 12),
          ),
        ),
      );
    }

    final List<_PerfRowData> rows = tab == _PerfTab.asset
        ? stats.assetPerf.map(_PerfRowData.fromAsset).toList()
        : stats.positionPerf.map(_PerfRowData.fromPosition).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        4,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: <Widget>[
            for (int i = 0; i < rows.length; i++)
              _PerfRow(data: rows[i], isLast: i == rows.length - 1),
          ],
        ),
      ),
    );
  }
}

/// PerfRow 归一化数据：资产行与仓位行共用同一渲染，差异收敛到 [isPosition] /
/// 可选字段，避免两套 widget。
class _PerfRowData {
  const _PerfRowData({
    required this.name,
    required this.glyph,
    required this.colorHex,
    required this.positive,
    required this.pnlDisplay,
    required this.feeDisplay,
    required this.isPosition,
    this.side,
    this.tradeCount,
    this.timeDisplay,
    this.sizeDisplay,
  });

  factory _PerfRowData.fromAsset(WhaleAssetPerf a) {
    return _PerfRowData(
      name: a.symbol,
      glyph: (a.glyph != null && a.glyph!.isNotEmpty)
          ? a.glyph!
          : (a.symbol.isEmpty ? '?' : a.symbol[0]),
      colorHex: a.colorHex,
      positive: a.positive ?? (a.tone == 'up'),
      pnlDisplay: a.pnlDisplay ?? '',
      feeDisplay: a.feeDisplay ?? '',
      isPosition: false,
      tradeCount: a.tradeCount,
    );
  }

  factory _PerfRowData.fromPosition(WhalePositionPerf p) {
    return _PerfRowData(
      name: p.label ?? p.sym,
      glyph: p.glyph.isEmpty ? (p.sym.isEmpty ? '?' : p.sym[0]) : p.glyph,
      colorHex: p.colorHex,
      positive: p.positive,
      pnlDisplay: p.pnlDisplay,
      feeDisplay: p.feeDisplay,
      isPosition: true,
      side: p.side,
      timeDisplay: p.timeDisplay,
      sizeDisplay: p.sizeDisplay,
    );
  }

  final String name;
  final String glyph;
  final int? colorHex;
  final bool positive;
  final String pnlDisplay;
  final String feeDisplay;
  final bool isPosition;
  final String? side;
  final int? tradeCount;
  final String? timeDisplay;
  final String? sizeDisplay;
}

class _PerfRow extends StatelessWidget {
  const _PerfRow({required this.data, required this.isLast});
  final _PerfRowData data;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Color pnlColor = data.positive ? c.marketUp : c.marketDown;
    final String subtitle = data.isPosition
        ? (data.timeDisplay ?? '')
        : l10n.whaleTradeStatsTradeUnit(data.tradeCount ?? 0);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : c.borderSoft,
          ),
        ),
      ),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: data.colorHex != null
                      ? Color(data.colorHex!)
                      : c.accent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  data.glyph,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            data.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (data.side != null) ...<Widget>[
                          const SizedBox(width: 7),
                          _SidePill(side: data.side!),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(color: c.textDim, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _fmtMoney(data.positive, data.pnlDisplay),
                style: TextStyle(
                  color: pnlColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: QzFont.mono,
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Row(
            children: <Widget>[
              Expanded(
                child: _PerfMetric(
                  label: data.isPosition
                      ? l10n.whaleTradeStatsSize
                      : l10n.whaleTradeStatsNetPnl,
                  value: data.isPosition
                      ? (data.sizeDisplay ?? '')
                      : _fmtMoney(data.positive, data.pnlDisplay),
                  color: data.isPosition ? c.text : pnlColor,
                  alignEnd: false,
                ),
              ),
              Expanded(
                child: _PerfMetric(
                  label: l10n.whaleTradeStatsFee,
                  value: _fmtMoney(true, data.feeDisplay),
                  color: c.marketUp,
                  alignEnd: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SidePill extends StatelessWidget {
  const _SidePill({required this.side});
  final String side;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool isLong = side == l10n.whaleProfileLong;
    final Color fg = isLong ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        side,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PerfMetric extends StatelessWidget {
  const _PerfMetric({
    required this.label,
    required this.value,
    required this.color,
    required this.alignEnd,
  });
  final String label;
  final String value;
  final Color color;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 11.5)),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
          ),
        ),
      ],
    );
  }
}

/// "$ +181,101.72" / "$ −496.25" —— 美元符 + 空格 + 正负号 + 数字（设计稿
/// `fmtMoney`，负号用 U+2212 与设计一致）。
String _fmtMoney(bool positive, String num) {
  return '\$ ${positive ? '+' : '−'}$num';
}

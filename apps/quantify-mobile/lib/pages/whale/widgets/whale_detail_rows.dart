import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 6 tab 详情明细行（设计稿 `WhaleProfileDetail` 各 tab body）。
///
/// 统一结构：coin 头（圆形字形 + symbol + side/状态 chip）+ 标签化数据网格。
/// mock fixtures 每 tab 固定 3 行，不实现排序/筛选（KISS/YAGNI）。

Color _toneColor(QzColorScheme c, double n) =>
    n >= 0 ? c.marketUp : c.marketDown;

/// coin 字形头像。
class _CoinHead extends StatelessWidget {
  const _CoinHead({required this.sym, required this.colorHex, this.size = 34});
  final String sym;
  final int colorHex;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: Color(colorHex), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        sym.isEmpty ? '?' : sym.substring(0, 1),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
      ),
    );
  }
}

/// side / 状态 chip（up 绿底 / dn 红底）。
class _SideChip extends StatelessWidget {
  const _SideChip({required this.up, required this.children});
  final bool up;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color tone = up ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          color: tone,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: children),
      ),
    );
  }
}

/// 标签化数据 cell。
class _Cell extends StatelessWidget {
  const _Cell({
    required this.label,
    required this.value,
    required this.align,
    this.color,
  });
  final String label;
  final String value;
  final CrossAxisAlignment align;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextAlign ta = align == CrossAxisAlignment.end
        ? TextAlign.right
        : align == CrossAxisAlignment.center
        ? TextAlign.center
        : TextAlign.left;
    return Column(
      crossAxisAlignment: align,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        const SizedBox(height: 6),
        Text(
          value,
          textAlign: ta,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color ?? c.text,
            letterSpacing: -0.3,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _AmountCell extends StatelessWidget {
  const _AmountCell({
    required this.label,
    required this.amount,
    required this.unit,
  });

  final String label;
  final String amount;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        const SizedBox(height: 6),
        RichText(
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          text: TextSpan(
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.text,
              letterSpacing: -0.3,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
            children: <InlineSpan>[
              TextSpan(text: amount),
              TextSpan(
                text: ' $unit',
                style: TextStyle(color: c.textDim, fontFamily: null),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 3 列网格（左中右），不足补空。
class _Grid extends StatelessWidget {
  const _Grid({required this.cells});
  final List<Widget> cells;

  @override
  Widget build(BuildContext context) {
    final List<Widget> rows = <Widget>[];
    for (int i = 0; i < cells.length; i += 3) {
      if (i > 0) rows.add(const SizedBox(height: QzSpacing.md));
      rows.add(
        Row(
          children: <Widget>[
            Expanded(child: cells[i]),
            Expanded(
              child: i + 1 < cells.length ? cells[i + 1] : const SizedBox(),
            ),
            Expanded(
              child: i + 2 < cells.length ? cells[i + 2] : const SizedBox(),
            ),
          ],
        ),
      );
    }
    return Column(children: rows);
  }
}

class _RowShell extends StatelessWidget {
  const _RowShell({required this.head, required this.grid});
  final Widget head;
  final Widget grid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 18),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          head,
          const SizedBox(height: QzSpacing.lg),
          grid,
        ],
      ),
    );
  }
}

/// tab 空态。
class WhaleDetailEmpty extends StatelessWidget {
  const WhaleDetailEmpty({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Center(
        child: Text(text, style: TextStyle(fontSize: 12, color: c.textFaint)),
      ),
    );
  }
}

/// 现货持仓行（资产份额进度条 + 金额/价格/价值）。
class WhaleSpotRow extends StatelessWidget {
  const WhaleSpotRow({super.key, required this.h});
  final WhaleSpotHolding h;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              _CoinHead(sym: h.sym, colorHex: h.colorHex, size: 38),
              const SizedBox(width: 11),
              Text(
                h.sym,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: c.text,
                ),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            l10n.whaleProfileSpotAssetShare,
            style: TextStyle(fontSize: 11, color: c.textDim),
          ),
          const SizedBox(height: 6),
          Row(
            children: <Widget>[
              SizedBox(
                width: 64,
                child: Text(
                  '${h.sharePct.toStringAsFixed(2)}%',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: c.text,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: (h.sharePct / 100).clamp(0, 1),
                    minHeight: 7,
                    backgroundColor: c.bgSoft,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      Color(0xFF7C5CFF),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                flex: 5,
                child: _AmountCell(
                  label: l10n.whaleProfileSortAmount,
                  amount: h.qtyDisplay,
                  unit: h.sym,
                ),
              ),
              Expanded(
                flex: 3,
                child: _Cell(
                  label: l10n.whaleProfileColPrice,
                  value: '\$ ${h.priceDisplay}',
                  align: CrossAxisAlignment.center,
                ),
              ),
              Expanded(
                flex: 4,
                child: _Cell(
                  label: l10n.whaleProfileColValue,
                  value: '\$ ${h.valueDisplay}',
                  align: CrossAxisAlignment.end,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 永续合约持仓行。
class WhalePerpRow extends StatelessWidget {
  const WhalePerpRow({super.key, required this.h});
  final WhalePerpHolding h;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool sideUp = h.side != '做空';
    return _RowShell(
      head: Row(
        children: <Widget>[
          _CoinHead(sym: h.sym, colorHex: h.colorHex),
          const SizedBox(width: 11),
          Text(
            h.sym,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _SideChip(
            up: sideUp,
            children: <Widget>[
              Text(h.mode, style: TextStyle(color: c.textMid)),
              const SizedBox(width: 6),
              Text(h.side),
              const SizedBox(width: 6),
              Text(h.lev),
            ],
          ),
        ],
      ),
      grid: _Grid(
        cells: <Widget>[
          _Cell(
            label: l10n.whaleProfileColPosValue,
            value: h.valueDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColUnrealized,
            value: h.pnlDisplay,
            align: CrossAxisAlignment.center,
            color: _toneColor(c, h.pnlN),
          ),
          _Cell(
            label: l10n.whaleProfileColEntry,
            value: h.entryDisplay,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColMark,
            value: h.markDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColLiq,
            value: h.liqDisplay,
            align: CrossAxisAlignment.center,
          ),
          _Cell(
            label: l10n.whaleProfileColMargin,
            value: h.marginDisplay,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColFunding,
            value: h.fundingDisplay,
            align: CrossAxisAlignment.start,
            color: _toneColor(c, h.fundingN),
          ),
          const SizedBox(),
          _Cell(
            label: l10n.whaleProfileColTpSl,
            value: h.tpsl,
            align: CrossAxisAlignment.end,
          ),
        ],
      ),
    );
  }
}

/// 挂单行。
class WhaleOrderRow extends StatelessWidget {
  const WhaleOrderRow({super.key, required this.o});
  final WhaleOpenOrder o;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool buy = o.side == '买入';
    return _RowShell(
      head: Row(
        children: <Widget>[
          _CoinHead(sym: o.sym, colorHex: o.colorHex),
          const SizedBox(width: 11),
          Text(
            o.sym,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _SideChip(
            up: buy,
            children: <Widget>[
              Text(o.side),
              const SizedBox(width: 6),
              Text(o.type, style: TextStyle(color: c.textMid)),
            ],
          ),
        ],
      ),
      grid: _Grid(
        cells: <Widget>[
          _Cell(
            label: l10n.whaleProfileColTime,
            value: o.timeDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColValue,
            value: o.valueDisplay,
            align: CrossAxisAlignment.center,
          ),
          _Cell(
            label: l10n.whaleProfileColQty,
            value: o.qtyDisplay,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColTrigger,
            value: o.trig,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColStatus,
            value: o.status,
            align: CrossAxisAlignment.center,
          ),
          _Cell(
            label: l10n.whaleProfileColOrderId,
            value: o.id,
            align: CrossAxisAlignment.end,
          ),
        ],
      ),
    );
  }
}

/// 最近成交行。
class WhaleTradeRow extends StatelessWidget {
  const WhaleTradeRow({super.key, required this.t});
  final WhaleRecentTrade t;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool longSide = t.action == '平空' || t.action == '开多';
    return _RowShell(
      head: Row(
        children: <Widget>[
          _CoinHead(sym: t.sym, colorHex: t.colorHex),
          const SizedBox(width: 11),
          Text(
            t.sym,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _SideChip(
            up: longSide,
            children: <Widget>[
              Text(t.action),
              const SizedBox(width: 6),
              Text(t.kind, style: TextStyle(color: c.textMid)),
            ],
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.ios_share, size: 17),
            color: c.textDim,
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
            tooltip: l10n.whaleProfileShareTooltip,
            onPressed: () {},
          ),
        ],
      ),
      grid: _Grid(
        cells: <Widget>[
          _Cell(
            label: l10n.whaleProfileColTime,
            value: t.timeDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColQty,
            value: t.qtyDisplay,
            align: CrossAxisAlignment.center,
          ),
          _Cell(
            label: l10n.whaleProfileColStart,
            value: t.startDisplay,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColPrice,
            value: t.priceDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColClosedPnl,
            value: t.pnlDisplay,
            align: CrossAxisAlignment.center,
            color: _toneColor(c, t.pnlN),
          ),
          _Cell(
            label: l10n.whaleProfileColFee,
            value: t.feeDisplay,
            align: CrossAxisAlignment.end,
          ),
        ],
      ),
    );
  }
}

/// 历史委托行。
class WhaleHistRow extends StatelessWidget {
  const WhaleHistRow({super.key, required this.o});
  final WhaleHistOrder o;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool buy = o.side == '买入';
    final Color statusColor = o.status == '已成交'
        ? c.marketUp
        : o.status == '撤单'
        ? c.textDim
        : c.text;
    return _RowShell(
      head: Row(
        children: <Widget>[
          _CoinHead(sym: o.sym, colorHex: o.colorHex),
          const SizedBox(width: 11),
          Text(
            o.sym,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _SideChip(up: buy, children: <Widget>[Text(o.side)]),
        ],
      ),
      grid: _Grid(
        cells: <Widget>[
          _Cell(
            label: l10n.whaleProfileColTime,
            value: o.timeDisplay,
            align: CrossAxisAlignment.start,
          ),
          _Cell(
            label: l10n.whaleProfileColType,
            value: o.type,
            align: CrossAxisAlignment.center,
          ),
          _Cell(
            label: l10n.whaleProfileColQty,
            value: o.qtyDisplay,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColPrice,
            value: o.priceDisplay,
            align: CrossAxisAlignment.start,
          ),
          const SizedBox(),
          _Cell(
            label: l10n.whaleProfileColTrigger,
            value: o.trig,
            align: CrossAxisAlignment.end,
          ),
          _Cell(
            label: l10n.whaleProfileColExecStatus,
            value: o.status,
            align: CrossAxisAlignment.start,
            color: statusColor,
          ),
          const SizedBox(),
          _Cell(
            label: l10n.whaleProfileColOrderId,
            value: o.id,
            align: CrossAxisAlignment.end,
          ),
        ],
      ),
    );
  }
}

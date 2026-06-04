import 'package:flutter/material.dart';

import '../../../domain/models/whale_holding_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'whale_card_controls.dart';

/// 巨鲸持仓明细卡（issue #1790）。对齐设计稿 `WhaleHoldingCard`：
/// 地址 + 币种/全仓/多空/杠杆 + 持仓价值/未实现盈亏 + 保证金/开盘价/清算价。
class WhaleHoldingCard extends StatelessWidget {
  const WhaleHoldingCard({
    required this.entry,
    required this.onOpen,
    required this.onCopy,
    required this.onStats,
    super.key,
  });

  final WhaleHoldingPosition entry;
  final VoidCallback onOpen;
  final VoidCallback onCopy;
  final VoidCallback onStats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Color sideColor = entry.isLong ? c.marketUp : c.marketDown;
    final Color pnlColor = entry.isProfit ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: BorderRadius.circular(QzRadii.card),
        border: Border.all(color: c.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // Row 1 — 地址 + 复制 + 「巨鲸」徽标 + 时间 + 趋势按钮（对齐设计稿）。
          Row(
            children: <Widget>[
              Flexible(
                child: WhaleAddressLink(
                  address: entry.address,
                  onOpen: onOpen,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              WhaleCopyButton(onCopy: onCopy),
              const SizedBox(width: QzSpacing.xs),
              _WhaleBadge(label: l10n.whaleHoldingsBadge),
              const Spacer(),
              Text(
                entry.timeDisplay,
                style: TextStyle(color: c.textDim, fontSize: 11),
              ),
              const SizedBox(width: QzSpacing.sm),
              WhaleTrendButton(onStats: onStats),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          // Row 2 — 币种 · 全仓 · 多/空 · 杠杆。
          Row(
            children: <Widget>[
              _SymbolChip(symbol: entry.symbol, colorHex: entry.symbolColorHex),
              const SizedBox(width: QzSpacing.sm),
              Text(
                entry.mode,
                style: TextStyle(
                  color: c.textMid,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Container(
                height: 22,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: sideColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(QzRadii.pill),
                  border:
                      Border.all(color: sideColor.withValues(alpha: 0.2)),
                ),
                child: Text(
                  entry.isLong
                      ? l10n.whaleHoldingsDirLong
                      : l10n.whaleHoldingsDirShort,
                  style: TextStyle(
                    color: sideColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                '${entry.leverage}x',
                style: TextStyle(
                  color: c.text,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Divider(height: 1, color: c.borderSoft),
          const SizedBox(height: QzSpacing.md),
          // Row 3 — 持仓价值 + 未实现盈亏。
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                flex: 6,
                child: _Headline(
                  label: l10n.whaleHoldingsColValue,
                  value: entry.valueDisplay,
                  valueColor: c.text,
                  sub: entry.qtyDisplay,
                  subColor: c.textDim,
                  alignEnd: false,
                ),
              ),
              Expanded(
                flex: 5,
                child: _Headline(
                  label: l10n.whaleHoldingsColPnl,
                  value: entry.pnlDisplay,
                  valueColor: pnlColor,
                  sub: entry.pnlPctDisplay,
                  subColor: pnlColor,
                  alignEnd: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Divider(height: 1, color: c.borderSoft),
          const SizedBox(height: QzSpacing.sm),
          // Row 4 — 保证金 / 开盘价 / 清算价。
          Row(
            children: <Widget>[
              Expanded(
                child: _Micro(
                  label: l10n.whaleHoldingsColMargin,
                  value: entry.marginDisplay,
                  valueColor: c.text,
                  align: TextAlign.left,
                ),
              ),
              Expanded(
                child: _Micro(
                  label: l10n.whaleHoldingsColOpen,
                  value: entry.openDisplay,
                  valueColor: c.text,
                  align: TextAlign.center,
                ),
              ),
              Expanded(
                child: _Micro(
                  label: l10n.whaleHoldingsColLiq,
                  value: entry.liqDisplay,
                  valueColor: entry.liqBreached ? c.marketDown : c.text,
                  align: TextAlign.right,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 「巨鲸」徽标：紫色背景 + 紫色文字（对齐设计稿 violet / violetSoft）。
class _WhaleBadge extends StatelessWidget {
  const _WhaleBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: c.accent,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _SymbolChip extends StatelessWidget {
  const _SymbolChip({required this.symbol, required this.colorHex});

  final String symbol;
  final int colorHex;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: Color(colorHex),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            symbol,
            style: TextStyle(
              color: c.text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.sub,
    required this.subColor,
    required this.alignEnd,
  });

  final String label;
  final String value;
  final Color valueColor;
  final String sub;
  final Color subColor;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final CrossAxisAlignment cross =
        alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final TextAlign align = alignEnd ? TextAlign.right : TextAlign.left;
    return Column(
      crossAxisAlignment: cross,
      children: <Widget>[
        Text(
          label,
          textAlign: align,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          textAlign: align,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: valueColor,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 1),
        Text(
          sub,
          textAlign: align,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: subColor,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _Micro extends StatelessWidget {
  const _Micro({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.align,
  });

  final String label;
  final String value;
  final Color valueColor;
  final TextAlign align;

  CrossAxisAlignment get _cross {
    switch (align) {
      case TextAlign.right:
        return CrossAxisAlignment.end;
      case TextAlign.center:
        return CrossAxisAlignment.center;
      default:
        return CrossAxisAlignment.start;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: _cross,
      children: <Widget>[
        Text(
          label,
          textAlign: align,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          textAlign: align,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: valueColor,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

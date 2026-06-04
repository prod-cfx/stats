import 'package:flutter/material.dart';

import '../../../domain/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 暂停持仓处理模式（#1773）。
enum LivePauseMode { market, natural, keep }

/// 暂停含持仓策略的对话框（#1773）。
///
/// 对齐设计稿 `m-screens-livestrats.jsx:1170-1393`：三模式单选（市价平仓后暂停
/// [推荐] / 等待止损止盈 / 保留持仓[warn]）+ 持仓卡 + 恢复说明。确认回选中模式；
/// 取消返回 null。三种模式在 mock 下均落到「暂停」状态转换，模式差异仅用于
/// 文案语义（真实平仓依赖 #1682/#1683，本迭代不接通）。
class LiveCloseWithPositionSheet extends StatefulWidget {
  const LiveCloseWithPositionSheet({
    super.key,
    required this.strategy,
    required this.position,
  });

  final LiveStrategy strategy;
  final LiveStrategyPosition position;

  static Future<LivePauseMode?> show(
    BuildContext context, {
    required LiveStrategy strategy,
    required LiveStrategyPosition position,
  }) {
    return showModalBottomSheet<LivePauseMode>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) =>
          LiveCloseWithPositionSheet(strategy: strategy, position: position),
    );
  }

  @override
  State<LiveCloseWithPositionSheet> createState() =>
      _LiveCloseWithPositionSheetState();
}

class _LiveCloseWithPositionSheetState
    extends State<LiveCloseWithPositionSheet> {
  LivePauseMode _mode = LivePauseMode.market;

  String _primaryLabel(AppLocalizations l10n) {
    switch (_mode) {
      case LivePauseMode.market:
        return l10n.livePausePrimaryMarket;
      case LivePauseMode.natural:
        return l10n.livePausePrimaryNatural;
      case LivePauseMode.keep:
        return l10n.livePausePrimaryKeep;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EdgeInsets safe = MediaQuery.viewPaddingOf(context);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.92,
      ),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: QzSpacing.xl + safe.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 4),
                decoration: BoxDecoration(
                  color: c.borderStrong,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: c.statusWarn.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          Icons.shield_outlined,
                          size: 14,
                          color: c.statusWarn,
                        ),
                      ),
                      const SizedBox(width: QzSpacing.sm),
                      Text(
                        l10n.livePauseSheetTitle,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: QzSpacing.xs),
                  RichText(
                    text: TextSpan(
                      style: TextStyle(
                        color: c.textMid,
                        fontSize: 12,
                        height: 1.6,
                      ),
                      children: <InlineSpan>[
                        const TextSpan(text: '「'),
                        TextSpan(
                          text: widget.strategy.name,
                          style: TextStyle(
                            color: c.text,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const TextSpan(text: '」当前有 '),
                        TextSpan(
                          text: l10n.livePausePositionHolding,
                          style: TextStyle(
                            color: c.statusWarn,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const TextSpan(text: '，请选择如何处理后再暂停。'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
              child: _PositionCard(
                strategy: widget.strategy,
                position: widget.position,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                children: <Widget>[
                  _ModeOption(
                    mode: LivePauseMode.market,
                    selected: _mode == LivePauseMode.market,
                    label: l10n.livePauseModeMarketLabel,
                    tag: l10n.livePauseModeMarketTag,
                    desc: l10n.livePauseModeMarketDesc,
                    effect: _MarketEffect(pnl: widget.position.pnl),
                    onTap: () => setState(() => _mode = LivePauseMode.market),
                  ),
                  _ModeOption(
                    mode: LivePauseMode.natural,
                    selected: _mode == LivePauseMode.natural,
                    label: l10n.livePauseModeNaturalLabel,
                    desc: l10n.livePauseModeNaturalDesc,
                    effect: _NaturalEffect(position: widget.position),
                    onTap: () => setState(() => _mode = LivePauseMode.natural),
                  ),
                  _ModeOption(
                    mode: LivePauseMode.keep,
                    selected: _mode == LivePauseMode.keep,
                    label: l10n.livePauseModeKeepLabel,
                    desc: l10n.livePauseModeKeepDesc,
                    effect: _KeepEffect(text: l10n.livePauseModeKeepEffect),
                    warn: true,
                    onTap: () => setState(() => _mode = LivePauseMode.keep),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: QzSpacing.md,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: c.bgSoft,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.borderSoft),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(Icons.info_outline, size: 13, color: c.textMid),
                    const SizedBox(width: QzSpacing.sm),
                    Expanded(
                      child: Text(
                        l10n.livePauseResumeNote,
                        style: TextStyle(
                          color: c.textMid,
                          fontSize: 11,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Row(
                children: <Widget>[
                  Expanded(child: _CancelButton(label: l10n.liveActionCancel)),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _PrimaryButton(
                      label: _primaryLabel(l10n),
                      onTap: () => Navigator.of(context).pop(_mode),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PositionCard extends StatelessWidget {
  const _PositionCard({required this.strategy, required this.position});
  final LiveStrategy strategy;
  final LiveStrategyPosition position;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool long = position.side == PositionSide.long;
    final bool pnlUp = position.pnl >= 0;
    final String leverage = _leverageOf(strategy.market);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: (long ? c.marketUp : c.marketDown).withValues(
                    alpha: 0.14,
                  ),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  long ? l10n.livePositionSideLong : l10n.livePositionSideShort,
                  style: TextStyle(
                    color: long ? c.marketUp : c.marketDown,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                position.pair,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                '×${position.qty}',
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 11,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              Text(
                ' · $leverage',
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 11,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const Spacer(),
              Text(
                '${pnlUp ? '+' : ''}${position.pct.toStringAsFixed(2)}%',
                style: TextStyle(
                  color: pnlUp ? c.marketUp : c.marketDown,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _Cell(
                  label: l10n.livePausePositionEntry,
                  value: _money(position.entryPrice),
                  color: c.text,
                ),
              ),
              Expanded(
                child: _Cell(
                  label: l10n.livePausePositionCurrent,
                  value: _money(position.currentPrice),
                  color: c.text,
                ),
              ),
              Expanded(
                child: _Cell(
                  label: l10n.livePausePositionFloatingPnl,
                  value:
                      '${pnlUp ? '+' : '-'}\$'
                      '${position.pnl.abs().toStringAsFixed(2)}',
                  color: pnlUp ? c.marketUp : c.marketDown,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _leverageOf(String market) {
    final RegExpMatch? match = RegExp(r'\d+x').firstMatch(market);
    return match?.group(0) ?? market;
  }

  static String _money(double value) {
    final String fixed = value.toStringAsFixed(1);
    final List<String> parts = fixed.split('.');
    final String whole = parts.first.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => ',',
    );
    return '\$$whole.${parts.last}';
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 10)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _ModeOption extends StatelessWidget {
  const _ModeOption({
    required this.mode,
    required this.selected,
    required this.label,
    required this.desc,
    required this.effect,
    required this.onTap,
    this.tag,
    this.warn = false,
  });
  final LivePauseMode mode;
  final bool selected;
  final String label;
  final String desc;
  final Widget effect;
  final VoidCallback onTap;
  final String? tag;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final BorderRadius radius = BorderRadius.circular(12);
    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.sm),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: Key('live-pause-mode-${mode.name}'),
          onTap: onTap,
          borderRadius: radius,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: selected ? c.accentSoft : c.bgElev,
              border: Border.all(
                color: selected ? c.accent : c.border,
                width: 1.5,
              ),
              borderRadius: radius,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    color: selected ? c.accent : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? c.accent : c.borderStrong,
                      width: 1.5,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: selected
                      ? const Icon(Icons.circle, size: 6, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              label,
                              style: TextStyle(
                                color: c.text,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (tag != null) ...<Widget>[
                            const SizedBox(width: QzSpacing.xs),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 1,
                              ),
                              decoration: BoxDecoration(
                                color: c.statusOk.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                tag!,
                                style: TextStyle(
                                  color: c.statusOk,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        desc,
                        style: TextStyle(
                          color: c.textMid,
                          fontSize: 11,
                          height: 1.55,
                        ),
                      ),
                      const SizedBox(height: 5),
                      effect,
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MarketEffect extends StatelessWidget {
  const _MarketEffect({required this.pnl});
  final double pnl;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool up = pnl >= 0;
    return RichText(
      text: TextSpan(
        style: TextStyle(color: c.textDim, fontSize: 11, height: 1.55),
        children: <InlineSpan>[
          const TextSpan(text: '预计实现盈亏 '),
          TextSpan(
            text: '${up ? '+' : '-'}\$${pnl.abs().toStringAsFixed(2)}',
            style: TextStyle(
              color: up ? c.marketUp : c.marketDown,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

class _NaturalEffect extends StatelessWidget {
  const _NaturalEffect({required this.position});
  final LiveStrategyPosition position;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return RichText(
      text: TextSpan(
        style: TextStyle(
          color: c.textDim,
          fontSize: 11,
          height: 1.55,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
        children: <InlineSpan>[
          const TextSpan(text: '距止损 '),
          TextSpan(
            text: '${position.stopPct.toStringAsFixed(1)}%',
            style: TextStyle(
              color: c.statusDanger,
              fontWeight: FontWeight.w700,
            ),
          ),
          const TextSpan(text: '   距止盈 '),
          TextSpan(
            text: '+${position.tpPct.toStringAsFixed(1)}%',
            style: TextStyle(color: c.marketUp, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _KeepEffect extends StatelessWidget {
  const _KeepEffect({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(color: c.statusDanger, fontSize: 11, height: 1.55),
    );
  }
}

class _CancelButton extends StatelessWidget {
  const _CancelButton({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      height: 50,
      child: OutlinedButton(
        onPressed: () => Navigator.of(context).pop(),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: c.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          backgroundColor: c.bgElev,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: c.text,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        key: const Key('live-pause-confirm'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 50,
          decoration: BoxDecoration(
            gradient: c.accentGrad,
            borderRadius: BorderRadius.circular(14),
            boxShadow: <BoxShadow>[c.accentShadow],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

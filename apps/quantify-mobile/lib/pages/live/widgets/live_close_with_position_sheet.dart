import 'package:flutter/material.dart';

import '../../../domain/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
part 'live_close_with_position_sheet.parts.part.dart';

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


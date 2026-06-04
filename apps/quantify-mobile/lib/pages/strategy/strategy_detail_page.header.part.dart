part of 'strategy_detail_page.dart';
// ignore_for_file: unused_element

/// Bottom-sheet 视觉骨架：bgElev 头部（含 handle + [header]）+ 可滚动
/// [child] body + 置底 [bottomBar]。对齐设计稿 StratDetail 三段式结构。
class _SheetContent extends StatelessWidget {
  const _SheetContent({
    required this.dragHandle,
    required this.header,
    required this.body,
    required this.bottomBar,
  });

  final Widget dragHandle;
  final Widget header;
  final Widget body;
  final Widget bottomBar;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      children: <Widget>[
        ColoredBox(
          color: c.bgElev,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.sm,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: Column(
              children: <Widget>[
                dragHandle,
                const SizedBox(height: QzSpacing.md),
                header,
              ],
            ),
          ),
        ),
        Expanded(child: body),
        DecoratedBox(
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border(top: BorderSide(color: c.borderSoft)),
          ),
          child: bottomBar,
        ),
      ],
    );
  }
}

/// 顶部 42×4 拖拽 handle（对齐设计稿 StratDetail）。
class _SheetDragHandle extends StatelessWidget {
  const _SheetDragHandle();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: 42,
      height: 4,
      decoration: BoxDecoration(
        color: c.border,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
    );
  }
}

/// 详情头部（对齐设计稿 StratDetail head）：
/// 头像 + 名 + (类型 Chip + `pair · period`) + 收藏 star + 关闭。
///
/// [card] 在 detail 加载中为 null，此时名称/Chip 占位、star/close 仍可用
/// （star 状态由外部 favorites 提供，与列表同源，不依赖 detail 数据）。
class _Header extends StatelessWidget {
  const _Header({
    required this.card,
    required this.starred,
    required this.onToggleStar,
    required this.onClose,
  });

  final StrategyCard? card;
  final bool starred;
  final VoidCallback onToggleStar;
  final VoidCallback onClose;

  String? _categoryLabel(BuildContext context, StrategyCategory category) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (category) {
      StrategyCategory.all => null,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  QzChipTone _categoryTone(StrategyCategory category) {
    return switch (category) {
      StrategyCategory.trend => QzChipTone.accent,
      StrategyCategory.grid => QzChipTone.info,
      StrategyCategory.arbitrage => QzChipTone.ok,
      StrategyCategory.reversal => QzChipTone.warn,
      StrategyCategory.hedge => QzChipTone.info,
      StrategyCategory.highFreq => QzChipTone.danger,
      StrategyCategory.all => QzChipTone.neutral,
    };
  }

  String _pairPeriod(StrategyCard card) {
    final List<String> parts = <String>[
      if (card.pair.isNotEmpty) card.pair,
      if (card.period.isNotEmpty) card.period,
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard? card = this.card;
    final String symbol = card?.symbol ?? '?';
    final String? catLabel =
        card == null ? null : _categoryLabel(context, card.category);
    final String pairPeriod = card == null ? '' : _pairPeriod(card);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        QzAvatar(label: symbol, size: 48, monospace: true),
        const SizedBox(width: QzSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                card?.name ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: QzSpacing.xs,
                runSpacing: QzSpacing.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  if (catLabel != null && catLabel.isNotEmpty)
                    QzChip(
                      label: catLabel,
                      tone: _categoryTone(card!.category),
                    ),
                  if (pairPeriod.isNotEmpty)
                    Text(
                      pairPeriod,
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
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
        const SizedBox(width: QzSpacing.sm),
        _HeaderButton(
          key: const Key('strategy-detail-star-btn'),
          tooltip: l10n.strategyDetailFavoriteTooltip,
          onPressed: onToggleStar,
          borderRadius: 10,
          background: starred
              ? const Color(0x1FF59E0B) // rgba(245,158,11,0.12)
              : c.bgSoft,
          icon: Icon(
            starred ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 18,
            color: starred ? const Color(0xFFF59E0B) : c.textMid,
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        _HeaderButton(
          key: const Key('strategy-detail-close-btn'),
          tooltip: l10n.strategyDetailCloseTooltip,
          onPressed: onClose,
          borderRadius: 17,
          background: c.bgSoft,
          icon: Icon(Icons.close_rounded, size: 16, color: c.textMid),
        ),
      ],
    );
  }
}

/// 34×34 头部填充按钮（对齐设计稿 star/close 容器）。
/// [borderRadius] 10 = star 圆角方钮，17 = close 圆形钮。
class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    super.key,
    required this.tooltip,
    required this.onPressed,
    required this.background,
    required this.icon,
    required this.borderRadius,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Color background;
  final Widget icon;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    // 视觉容器固定 34×34（对齐设计稿），触控热区放大到 48×48（Material 48dp 最小可点击尺寸）。
    return Tooltip(
      message: tooltip,
      excludeFromSemantics: true, // 语义名仅由下方 Semantics 提供，避免旁白重复朗读
      child: Semantics(
        button: true,
        label: tooltip,
        // 48×48 触控热区（Material 48dp），内含 34×34 视觉块；
        // InkWell 包住视觉块本身，ripple 形状/范围与圆角块严格一致（star r10 圆角方、close r17 圆）。
        child: SizedBox(
          width: 48,
          height: 48,
          child: Center(
            child: Material(
              color: background,
              borderRadius: BorderRadius.circular(borderRadius),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onPressed,
                child: SizedBox(
                  width: 34,
                  height: 34,
                  child: Center(child: icon),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.cards});
  final List<Widget> cards;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('strategy-detail-metric-grid'),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: GridView.count(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: cards,
      ),
    );
  }
}

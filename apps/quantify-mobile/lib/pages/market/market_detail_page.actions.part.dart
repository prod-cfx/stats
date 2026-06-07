part of 'market_detail_page.dart';

/// 交易详情底部固定双按钮 bar。
///
/// 用 `bottomNavigationBar` 而非 `Positioned`：自动处理键盘 inset、SafeArea
/// 与 Scaffold body 内容剪裁，比手工 stack 更稳。
class _OrderActionBar extends StatelessWidget {
  const _OrderActionBar({required this.onBuy, required this.onSell});

  final VoidCallback onBuy;
  final VoidCallback onSell;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg,
          QzSpacing.sm,
          QzSpacing.lg,
          QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border(top: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: _ActionButton(
                key: const Key('market-detail-buy'),
                label: l10n.marketDetailBuyButton,
                subLabel: l10n.marketDetailBuySubLabel,
                color: c.marketUp,
                onPressed: onBuy,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _ActionButton(
                key: const Key('market-detail-sell'),
                label: l10n.marketDetailSellButton,
                subLabel: l10n.marketDetailSellSubLabel,
                color: c.marketDown,
                onPressed: onSell,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    super.key,
    required this.label,
    required this.subLabel,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final String subLabel;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    // 两行布局对齐设计稿 m-screens-3 sticky buy/sell：主文案 + 副文案
    // （「开多 · 10x」/「开空 · 10x」）。高度从 44 提到 46 对齐设计稿
    // height:46，避免 14+10 双行字号挤压。
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(QzRadii.input),
        child: Container(
          height: 46,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subLabel,
                style: const TextStyle(
                  color: Color(0xD9FFFFFF),
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 行情详情「更多」底部菜单（#1755）。
///
/// 「复制交易对」「切换交易所」为可用项（后者跳转数据来源抽屉，#2099）；
/// 分享 / 提醒标注「即将上线」并禁用点击，避免空回调造成已实现错觉。
class _MoreActionsSheet extends StatelessWidget {
  const _MoreActionsSheet({
    required this.symbol,
    required this.onCopySymbol,
    required this.onSwitchSource,
  });

  final String symbol;
  final Future<void> Function() onCopySymbol;
  final Future<void> Function() onSwitchSource;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            QzSpacing.sm,
          ),
          child: Text(
            l10n.marketDetailMoreSheetTitle,
            style: TextStyle(
              color: c.textMid,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        _MoreActionTile(
          key: const Key('market-more-copy-symbol'),
          icon: Icons.copy_rounded,
          label: l10n.marketDetailMoreCopySymbol,
          onTap: () {
            Navigator.of(context).pop();
            unawaited(onCopySymbol());
          },
        ),
        _MoreActionTile(
          key: const Key('market-more-share'),
          icon: Icons.ios_share_rounded,
          label: l10n.marketDetailMoreShare,
          disabledNote: l10n.marketDetailMoreComingSoon,
        ),
        _MoreActionTile(
          key: const Key('market-more-alert'),
          icon: Icons.notifications_none_rounded,
          label: l10n.marketDetailMoreAlert,
          disabledNote: l10n.marketDetailMoreComingSoon,
        ),
        _MoreActionTile(
          key: const Key('market-more-switch-exchange'),
          icon: Icons.swap_horiz_rounded,
          label: l10n.marketDetailMoreSwitchExchange,
          onTap: () {
            Navigator.of(context).pop();
            unawaited(onSwitchSource());
          },
        ),
      ],
    );
  }
}

class _MoreActionTile extends StatelessWidget {
  const _MoreActionTile({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.disabledNote,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  /// 非 null 时该项禁用，并在右侧展示该提示文案。
  final String? disabledNote;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool enabled = disabledNote == null;
    final Color fg = enabled ? c.text : c.textDim;
    return ListTile(
      enabled: enabled,
      leading: Icon(icon, size: 20, color: fg),
      title: Text(
        label,
        style: TextStyle(color: fg, fontSize: 14, fontWeight: FontWeight.w500),
      ),
      trailing: disabledNote == null
          ? null
          : Text(
              disabledNote!,
              style: TextStyle(color: c.textDim, fontSize: 12),
            ),
      onTap: onTap,
    );
  }
}

/// K 线下方 flat 4 格累计统计行（#2101）：累计成交额 / 累计净流入 / 最高 / 最低。
///
/// 缺少后端字段时显示 `--`，不根据成交额、涨跌幅或最新价派生业务真值。
class _CumulativeStatsRow extends StatelessWidget {
  const _CumulativeStatsRow({required this.ticker});

  final Ticker ticker;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);

    final double? netInflow = ticker.netInflow24h;
    final bool inflowDown = (netInflow ?? 0) < 0;

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(
          top: BorderSide(color: c.bg, width: 6),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _CumStatCell(
            label: l10n.marketDetailCumTurnover,
            value: _fmtNullableCompact(ticker.turnover24h),
          ),
          _CumStatCell(
            label: l10n.marketDetailCumNetInflow,
            value: _fmtNullableSignedCompact(netInflow),
            valueColor: netInflow == null
                ? null
                : inflowDown
                ? c.marketDown
                : c.marketUp,
          ),
          _CumStatCell(
            label: l10n.marketDetailCumHigh,
            value: _fmtNullablePrice(ticker.high24h),
          ),
          _CumStatCell(
            label: l10n.marketDetailCumLow,
            value: _fmtNullablePrice(ticker.low24h),
          ),
        ],
      ),
    );
  }

  static String _fmtCompact(double v) {
    final double abs = v.abs();
    if (abs >= 1e9) return '${(v / 1e9).toStringAsFixed(2)}B';
    if (abs >= 1e6) return '${(v / 1e6).toStringAsFixed(2)}M';
    if (abs >= 1e3) return '${(v / 1e3).toStringAsFixed(2)}K';
    return v.toStringAsFixed(2);
  }

  static String _fmtSignedCompact(double v) {
    final String sign = v < 0 ? '-' : '+';
    return '$sign${_fmtCompact(v.abs())}';
  }

  static String _fmtNullableCompact(double? v) {
    return v == null ? '--' : _fmtCompact(v);
  }

  static String _fmtNullableSignedCompact(double? v) {
    return v == null ? '--' : _fmtSignedCompact(v);
  }

  static String _fmtNullablePrice(double? v) {
    return v == null ? '--' : v.toStringAsFixed(2);
  }
}

class _CumStatCell extends StatelessWidget {
  const _CumStatCell({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: c.textDim, fontSize: 10.5),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: valueColor ?? c.text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

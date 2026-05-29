import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/whale_profile_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_segmented_tabs.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';

/// 巨鲸地址详情页（#1753，`/whale/profile/:address`）。
///
/// 对齐设计稿 `WhaleProfileDetail` / `WhaleTradeStats`：hero（地址 + 标签 +
/// 资产摘要 + 总持仓估值）→ 概览/交易统计 segmented tab。
/// 概览=持仓列表 + 近期动作；统计=总盈亏/胜率/方向偏好/资产表现。
/// 复制地址走 Clipboard + snackbar；加载态 QzSpinner，错误态错误文案。
/// 数据由 mock 驱动，真实读路径依赖 #1682。
class WhaleProfilePage extends ConsumerStatefulWidget {
  const WhaleProfilePage({super.key, required this.address});

  final String address;

  @override
  ConsumerState<WhaleProfilePage> createState() => _WhaleProfilePageState();
}

class _WhaleProfilePageState extends ConsumerState<WhaleProfilePage> {
  late String _tab;

  @override
  void initState() {
    super.initState();
    _tab = 'overview';
  }

  Future<void> _copyAddress(AppLocalizations l10n) async {
    await Clipboard.setData(ClipboardData(text: widget.address));
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleProfileCopied),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<WhaleProfile> profile = ref.watch(
      whaleProfileProvider(widget.address),
    );

    return Scaffold(
      backgroundColor: c.bg,
      body: profile.when(
        loading: () => Column(
          children: <Widget>[
            QzTopBar(
              title: l10n.whaleProfileTitle,
              subtitle: widget.address,
              onBack: () => context.pop(),
            ),
            const Expanded(child: Center(child: QzSpinner())),
          ],
        ),
        error: (Object e, StackTrace _) => Column(
          children: <Widget>[
            QzTopBar(
              title: l10n.whaleProfileTitle,
              subtitle: widget.address,
              onBack: () => context.pop(),
            ),
            Expanded(
              child: Center(
                child: Text(
                  l10n.whaleProfileLoadError,
                  style: TextStyle(color: c.statusDanger),
                ),
              ),
            ),
          ],
        ),
        data: (WhaleProfile p) => _build(context, l10n, c, p),
      ),
    );
  }

  Widget _build(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
    WhaleProfile p,
  ) {
    return Column(
      children: <Widget>[
        QzTopBar(
          title: l10n.whaleProfileTitle,
          subtitle: p.address,
          onBack: () => context.pop(),
          actions: <Widget>[
            IconButton(
              icon: const Icon(Icons.copy, size: 18),
              color: c.textMid,
              tooltip: l10n.whaleProfileCopyTooltip,
              onPressed: () => _copyAddress(l10n),
            ),
          ],
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.lg,
              QzSpacing.lg,
            ),
            children: <Widget>[
              _Hero(profile: p),
              const SizedBox(height: QzSpacing.md),
              QzSegmentedTabs(
                options: <String>[
                  l10n.whaleProfileTabOverview,
                  l10n.whaleProfileTabStats,
                ],
                value: _tab == 'overview'
                    ? l10n.whaleProfileTabOverview
                    : l10n.whaleProfileTabStats,
                onChanged: (String v) => setState(() {
                  _tab = v == l10n.whaleProfileTabOverview
                      ? 'overview'
                      : 'stats';
                }),
              ),
              const SizedBox(height: QzSpacing.md),
              if (_tab == 'overview')
                _Overview(profile: p)
              else
                _Stats(stats: p.stats),
            ],
          ),
        ),
      ],
    );
  }
}

QzChipTone _chipTone(String tone) {
  switch (tone) {
    case 'accent':
      return QzChipTone.accent;
    case 'info':
      return QzChipTone.info;
    case 'warn':
      return QzChipTone.warn;
    default:
      return QzChipTone.neutral;
  }
}

Color _toneColor(QzColorScheme c, String tone) {
  switch (tone) {
    case 'up':
      return c.marketUp;
    case 'dn':
      return c.marketDown;
    default:
      return c.textDim;
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.account_balance_wallet,
                  size: 20,
                  color: c.accent,
                ),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            profile.address,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        QzChip(
                          label: profile.tag,
                          tone: _chipTone(profile.tagTone),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${l10n.whaleProfileAssetSummaryPrefix}${profile.assetSummary}',
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                l10n.whaleProfileHoldingsValueLabel,
                style: TextStyle(color: c.textDim, fontSize: 12),
              ),
              Text(
                profile.holdingsValueDisplay,
                style: TextStyle(
                  color: c.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _SectionTitle(text: l10n.whaleProfileSectionHoldings),
        const SizedBox(height: QzSpacing.sm),
        _Bordered(
          children: <Widget>[
            for (int i = 0; i < profile.holdings.length; i++)
              _HoldingRow(
                entry: profile.holdings[i],
                isLast: i == profile.holdings.length - 1,
              ),
          ],
        ),
        const SizedBox(height: QzSpacing.lg),
        _SectionTitle(text: l10n.whaleProfileSectionRecentActions),
        const SizedBox(height: QzSpacing.sm),
        if (profile.recentActions.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Center(
              child: Text(
                l10n.whaleProfileRecentActionsEmpty,
                style: TextStyle(color: c.textDim, fontSize: 12),
              ),
            ),
          )
        else
          _Bordered(
            children: <Widget>[
              for (int i = 0; i < profile.recentActions.length; i++)
                _ActionRow(
                  entry: profile.recentActions[i],
                  isLast: i == profile.recentActions.length - 1,
                ),
            ],
          ),
      ],
    );
  }
}

class _HoldingRow extends StatelessWidget {
  const _HoldingRow({required this.entry, required this.isLast});
  final WhaleHoldingEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isLast ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.symbol,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  entry.amountDisplay,
                  style: TextStyle(color: c.textMid, fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                entry.valueDisplay,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                entry.pctDisplay,
                style: TextStyle(
                  color: _toneColor(c, entry.tone),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.entry, required this.isLast});
  final WhaleRecentAction entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color tone = _toneColor(c, entry.tone);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isLast ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: tone,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.action,
                  style: TextStyle(
                    color: tone,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  entry.detail,
                  style: TextStyle(color: c.textMid, fontSize: 11),
                ),
              ],
            ),
          ),
          Text(
            entry.timeDisplay,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});
  final WhaleTradeStats stats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: _StatCell(
                label: l10n.whaleProfileStatPnl,
                value: stats.pnlDisplay,
                valueColor: _toneColor(c, stats.pnlTone),
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _StatCell(
                label: l10n.whaleProfileStatWinRate,
                value: l10n.whaleProfileWinRateValue(stats.winRatePct),
                valueColor: c.text,
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.sm),
        Row(
          children: <Widget>[
            Expanded(
              child: _StatCell(
                label: l10n.whaleProfileStatRealized,
                value: stats.realizedDisplay,
                valueColor: c.text,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _StatCell(
                label: l10n.whaleProfileStatUnrealized,
                value: stats.unrealizedDisplay,
                valueColor: c.text,
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.lg),
        _SectionTitle(text: l10n.whaleProfileDirectionBias),
        const SizedBox(height: QzSpacing.sm),
        _DirectionBar(longPct: stats.longPct, shortPct: stats.shortPct),
        const SizedBox(height: QzSpacing.lg),
        _SectionTitle(text: l10n.whaleProfileSectionAssetPerf),
        const SizedBox(height: QzSpacing.sm),
        _Bordered(
          children: <Widget>[
            for (int i = 0; i < stats.assetPerf.length; i++)
              _AssetPerfRow(
                entry: stats.assetPerf[i],
                isLast: i == stats.assetPerf.length - 1,
              ),
          ],
        ),
      ],
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _DirectionBar extends StatelessWidget {
  const _DirectionBar({required this.longPct, required this.shortPct});
  final int longPct;
  final int shortPct;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final int total = longPct + shortPct == 0 ? 1 : longPct + shortPct;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Text(
              '${l10n.whaleProfileLong} $longPct%',
              style: TextStyle(
                color: c.marketUp,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              '${l10n.whaleProfileShort} $shortPct%',
              style: TextStyle(
                color: c.marketDown,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: Row(
            children: <Widget>[
              Expanded(
                flex: longPct == 0 ? 0 : (longPct * 1000 ~/ total),
                child: Container(height: 6, color: c.marketUp),
              ),
              Expanded(
                flex: shortPct == 0 ? 0 : (shortPct * 1000 ~/ total),
                child: Container(height: 6, color: c.marketDown),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AssetPerfRow extends StatelessWidget {
  const _AssetPerfRow({required this.entry, required this.isLast});
  final WhaleAssetPerf entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isLast ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              entry.symbol,
              style: TextStyle(
                color: c.text,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            entry.pctDisplay,
            style: TextStyle(
              color: _toneColor(c, entry.tone),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(
        color: c.text,
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      ),
    );
  }
}

class _Bordered extends StatelessWidget {
  const _Bordered({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: children),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../data/mock/fixtures/whale_extras.dart';
import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 巨鲸动向 — 发现 tab（issue #1560）。聪明钱榜 + 趋势资产 + 新晋巨鲸。
class WhaleDiscoverTab extends StatelessWidget {
  const WhaleDiscoverTab({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        _Section(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            QzSpacing.lg,
            QzSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _SectionHeader(
                title: l10n.whaleSectionSmartMoney,
                subtitle: l10n.whaleSectionSmartMoneySub,
                actionLabel: l10n.whaleSectionViewAll,
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockSmartMoneyTop5.length; i++)
                      _SmartMoneyRow(
                        entry: mockSmartMoneyTop5[i],
                        isLast: i == mockSmartMoneyTop5.length - 1,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _Section(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _SectionHeader(
                title: l10n.whaleSectionTrending,
                hint: l10n.whaleSectionTrendingSub,
              ),
              const SizedBox(height: QzSpacing.sm),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: QzSpacing.sm,
                crossAxisSpacing: QzSpacing.sm,
                childAspectRatio: 1.55,
                children: <Widget>[
                  for (final TrendingAssetEntry t in mockTrendingAssets)
                    _TrendingCard(entry: t),
                ],
              ),
            ],
          ),
        ),
        _Section(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.whaleSectionEmergingWhales,
                style: TextStyle(
                  color: c.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
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
                        Icons.auto_awesome,
                        size: 20,
                        color: c.accent,
                      ),
                    ),
                    const SizedBox(width: QzSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            l10n.whaleSectionEmergingWhalesTitle,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            l10n.whaleSectionEmergingWhalesSub,
                            style: TextStyle(color: c.textDim, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right, size: 18, color: c.textDim),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.child, required this.padding});
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(color: c.bgElev, padding: padding, child: child);
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.subtitle,
    this.hint,
    this.actionLabel,
  });

  final String title;
  final String? subtitle;
  final String? hint;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                title,
                style: TextStyle(
                  color: c.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              if (subtitle != null) ...<Widget>[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ],
            ],
          ),
        ),
        if (hint != null)
          Text(hint!, style: TextStyle(color: c.textDim, fontSize: 11)),
        if (actionLabel != null)
          Text(
            actionLabel!,
            style: TextStyle(
              color: c.accent,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }
}

class _SmartMoneyRow extends StatelessWidget {
  const _SmartMoneyRow({required this.entry, required this.isLast});

  final SmartMoneyEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool topRank = entry.rank <= 3;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          '/whale/profile/${Uri.encodeComponent(entry.address)}',
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isLast ? Colors.transparent : c.borderSoft,
              ),
            ),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: topRank ? c.accentSoft : c.bgSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${entry.rank}',
                  style: TextStyle(
                    color: topRank ? c.accent : c.textMid,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Text(
                          entry.address,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: QzSpacing.xs),
                        _Tag(label: entry.tag),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${l10n.whaleSmartMoneyHoldingsPrefix}${entry.holdings}',
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  Text(
                    entry.pnlDisplay,
                    style: TextStyle(
                      color: c.marketUp,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${l10n.whaleWinRatePrefix}${entry.winRatePct}%',
                    style: TextStyle(color: c.textDim, fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    Color bg = c.bgSoft;
    Color fg = c.textMid;
    switch (label) {
      case '聪明钱':
      case '长期持有':
        bg = c.accentSoft;
        fg = c.accent;
      case '机构':
        bg = c.statusInfo.withValues(alpha: 0.12);
        fg = c.statusInfo;
      case '新地址':
        bg = c.statusWarn.withValues(alpha: 0.12);
        fg = c.statusWarn;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _TrendingCard extends StatelessWidget {
  const _TrendingCard({required this.entry});
  final TrendingAssetEntry entry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Color toneColor = entry.tone == 'up' ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: Color(entry.colorHex),
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: Text(
                  entry.symbol[0],
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
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
                  color: toneColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Text(
            entry.netDisplay,
            style: TextStyle(
              color: toneColor,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            '${entry.participantCount}${l10n.whaleTrendingParticipantsSuffix}',
            style: TextStyle(color: c.textDim, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

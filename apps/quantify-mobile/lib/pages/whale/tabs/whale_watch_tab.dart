import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/whale_extras.dart';
import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 巨鲸动向 — 监控 tab（issue #1560）。我的监控 + 最近告警 + CTA。
class WhaleWatchTab extends StatelessWidget {
  const WhaleWatchTab({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.xs),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.whaleSectionMyWatch,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  Text(
                    '${mockWatchAddresses.length}${l10n.whaleSectionMyWatchCountSuffix}',
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockWatchAddresses.length; i++)
                      _WatchRow(
                        entry: mockWatchAddresses[i],
                        isLast: i == mockWatchAddresses.length - 1,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: QzSpacing.md),
              SizedBox(
                width: double.infinity,
                height: 44,
                // 添加地址监控能力尚未落地（issue #1663）：按钮置为禁用态
                // (onPressed=null) 避免空 lambda 的 ripple 暗示可点。对齐设
                // 计稿 `WhaleWatch` 添加按钮无 onClick，详见
                // `apps/quantify-mobile/docs/decisions.md` "未实现入口的设
                // 计表达规范" 基线（#1662）。
                child: OutlinedButton.icon(
                  onPressed: null,
                  icon: Icon(Icons.add, size: 18, color: c.textMid),
                  label: Text(
                    l10n.whaleAddWatchAddress,
                    style: TextStyle(color: c.textMid, fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    side: BorderSide(color: c.border),
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.lg, QzSpacing.lg, QzSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.whaleSectionRecentAlerts,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  Text(
                    l10n.whaleSectionRecentAlertsAction,
                    style: TextStyle(
                      color: c.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockWatchAlerts.length; i++)
                      _AlertRow(
                        entry: mockWatchAlerts[i],
                        isLast: i == mockWatchAlerts.length - 1,
                      ),
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

class _WatchRow extends StatelessWidget {
  const _WatchRow({required this.entry, required this.isLast});

  final WatchAddressEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool up = entry.tone == 'up';
    final Color toneColor = up ? c.marketUp : c.marketDown;
    final Color toneSoft = toneColor.withValues(alpha: 0.14);
    return Container(
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
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: toneSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              up ? Icons.arrow_upward : Icons.arrow_downward,
              size: 14,
              color: toneColor,
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
                        entry.name,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (entry.live) ...<Widget>[
                      const SizedBox(width: 6),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: c.marketUp,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${entry.address} · ${entry.lastEventDisplay}',
                  overflow: TextOverflow.ellipsis,
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
                  color: toneColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                l10n.whaleWatchPnl7d,
                style: TextStyle(color: c.textFaint, fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.entry, required this.isLast});

  final WatchAlertEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    Color fg = c.textMid;
    Color bg = c.bgSoft;
    switch (entry.tone) {
      case 'up':
        fg = c.marketUp;
        bg = c.marketUp.withValues(alpha: 0.12);
      case 'warn':
        fg = c.statusWarn;
        bg = c.statusWarn.withValues(alpha: 0.12);
      case 'info':
        fg = c.accent;
        bg = c.accentSoft;
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : c.borderSoft,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              entry.type,
              style: TextStyle(
                color: fg,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.detail,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.text, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  entry.timeDisplay,
                  style: TextStyle(color: c.textDim, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

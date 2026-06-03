import 'package:flutter/material.dart';

import '../../../data/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

enum LiveActionSheetResult { view, toggle, delete }

class LiveActionSheet extends StatelessWidget {
  const LiveActionSheet({super.key, required this.strategy});

  final LiveStrategy strategy;

  static Future<LiveActionSheetResult?> show(
    BuildContext context, {
    required LiveStrategy strategy,
  }) {
    return showModalBottomSheet<LiveActionSheetResult>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => LiveActionSheet(strategy: strategy),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EdgeInsets safe = MediaQuery.viewPaddingOf(context);
    final bool stopped = strategy.status == LiveStrategyStatus.stopped;
    final bool canStart =
        strategy.status == LiveStrategyStatus.paused ||
        strategy.status == LiveStrategyStatus.warning;

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: QzShadow.lightLg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const SizedBox(height: 10),
          Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: c.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: Text(
              strategy.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.textDim,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 2, 8, 6),
            child: Column(
              children: <Widget>[
                _ActionRow(
                  key: const Key('live-action-view'),
                  icon: Icons.format_list_bulleted_rounded,
                  label: l10n.strategyHomeFeaturedView,
                  color: c.text,
                  onTap: () =>
                      Navigator.of(context).pop(LiveActionSheetResult.view),
                ),
                _ActionRow(
                  key: const Key('live-action-toggle'),
                  icon: stopped || canStart
                      ? Icons.play_arrow_rounded
                      : Icons.pause_rounded,
                  label: stopped
                      ? l10n.liveActionResume
                      : (canStart
                            ? l10n.liveActionStart
                            : l10n.liveActionPause),
                  color: stopped || canStart ? c.statusOk : c.text,
                  onTap: () =>
                      Navigator.of(context).pop(LiveActionSheetResult.toggle),
                ),
                _ActionRow(
                  key: const Key('live-action-delete'),
                  icon: Icons.delete_outline_rounded,
                  label: stopped
                      ? l10n.liveActionDeletePermanent
                      : l10n.liveDeletePrimarySoft,
                  color: c.statusDanger,
                  onTap: () =>
                      Navigator.of(context).pop(LiveActionSheetResult.delete),
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(8, 6, 8, 8 + safe.bottom),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.borderSoft)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 46,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  l10n.liveActionCancel,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
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

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          foregroundColor: color,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

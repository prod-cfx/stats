part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _PreflightChecksCard extends StatelessWidget {
  const _PreflightChecksCard({
    required this.scheme,
    required this.title,
    required this.status,
    required this.allPass,
    required this.scanning,
    required this.recheckLabel,
    required this.showRecheck,
    required this.onRecheck,
    required this.rows,
  });

  final QzColorScheme scheme;
  final String title;
  final String status;
  final bool allPass;
  final bool scanning;
  final String recheckLabel;
  final bool showRecheck;
  final VoidCallback? onRecheck;
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final Color statusColor = allPass ? scheme.marketUp : scheme.marketDown;
    final Color statusBg = statusColor.withValues(alpha: 0.15);
    final Color headerBg = allPass
        ? scheme.bgInput
        : scheme.marketDown.withValues(alpha: 0.06);
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(
          color: allPass
              ? scheme.borderSoft
              : scheme.marketDown.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: headerBg,
              border: Border(bottom: BorderSide(color: scheme.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: allPass ? scheme.textDim : scheme.marketDown,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                if (showRecheck) ...<Widget>[
                  _PreflightRecheckButton(
                    label: recheckLabel,
                    scheme: scheme,
                    onTap: onRecheck,
                  ),
                  const SizedBox(width: QzSpacing.sm),
                ],
                _PreflightStatusChip(
                  label: status,
                  color: scanning ? scheme.textDim : statusColor,
                  background: scanning ? scheme.bgInput : statusBg,
                  spinning: scanning,
                ),
              ],
            ),
          ),
          for (int i = 0; i < rows.length; i++) ...<Widget>[
            if (i > 0) Divider(height: 1, color: scheme.borderSoft),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _PreflightRecheckButton extends StatelessWidget {
  const _PreflightRecheckButton({
    required this.label,
    required this.scheme,
    required this.onTap,
  });

  final String label;
  final QzColorScheme scheme;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const Key('deploy-preflight-recheck'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.7 : 1,
        child: Container(
          height: 24,
          padding: const EdgeInsets.symmetric(horizontal: 9),
          decoration: BoxDecoration(
            color: Colors.transparent,
            border: Border.all(color: scheme.marketDown),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.refresh_rounded, size: 12, color: scheme.marketDown),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  color: scheme.marketDown,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreflightStatusChip extends StatelessWidget {
  const _PreflightStatusChip({
    required this.label,
    required this.color,
    required this.background,
    required this.spinning,
  });

  final String label;
  final Color color;
  final Color background;
  final bool spinning;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('deploy-preflight-status'),
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (spinning) ...<Widget>[
            SizedBox(
              width: 11,
              height: 11,
              child: CircularProgressIndicator(strokeWidth: 2, color: color),
            ),
            const SizedBox(width: 4),
          ] else ...<Widget>[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreflightRow extends StatelessWidget {
  const _PreflightRow({
    required this.index,
    required this.check,
    required this.checking,
    required this.scheme,
  });

  final int index;
  final PreflightCheck check;
  final bool checking;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    final Color statusColor = check.ok ? c.marketUp : c.marketDown;
    return Container(
      key: Key('deploy-preflight-row-$index'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      color: checking
          ? c.bgInput
          : (check.ok
                ? Colors.transparent
                : c.marketDown.withValues(alpha: 0.04)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 18,
            height: 18,
            child: checking
                ? CircularProgressIndicator(strokeWidth: 2, color: c.textDim)
                : Icon(
                    check.ok ? Icons.check_circle : Icons.cancel,
                    size: 18,
                    color: statusColor,
                  ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  check.title,
                  style: TextStyle(
                    color: checking
                        ? c.textDim
                        : (check.ok ? c.text : statusColor),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  check.sub,
                  style: TextStyle(color: c.textDim, fontSize: 11, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

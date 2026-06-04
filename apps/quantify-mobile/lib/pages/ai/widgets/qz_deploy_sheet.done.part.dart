part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _DonePane extends StatelessWidget {
  const _DonePane({
    required this.result,
    required this.onFinish,
    this.stickyActions = false,
  });

  final DeploymentResult result;
  final VoidCallback onFinish;
  final bool stickyActions;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<List<String>> rows = <List<String>>[
      <String>[
        l10n.deployDoneDetailStrategyId,
        result.strategyId ?? result.instanceId,
      ],
      <String>[l10n.deployDoneDetailExchange, result.exchange.toUpperCase()],
      if (result.symbol != null)
        <String>[l10n.deployDoneDetailSymbol, result.symbol!],
      if (result.amount != null)
        <String>[
          l10n.deployDoneDetailAmount,
          '${result.amount!.toStringAsFixed(0)} USDT',
        ],
      if (result.leverage != null)
        <String>[l10n.deployDoneDetailLeverage, result.leverage!],
      if (result.startedAt != null)
        <String>[
          l10n.deployDoneDetailStartedAt,
          _formatStartedAt(result.startedAt!),
        ],
    ];
    final List<Widget> content = <Widget>[
      // hero
      Center(
        child: Column(
          children: <Widget>[
            Icon(Icons.check_circle, size: 48, color: c.marketUp),
            const SizedBox(height: QzSpacing.sm),
            Text(
              l10n.deployDoneTitle,
              style: TextStyle(
                color: c.text,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.deployDoneSubtitle(result.exchange.toUpperCase()),
              textAlign: TextAlign.center,
              style: TextStyle(color: c.textDim, fontSize: 12, height: 1.5),
            ),
          ],
        ),
      ),
      const SizedBox(height: QzSpacing.md),
      // detail card
      Container(
        key: const Key('deploy-done-detail'),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.card),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        child: Column(
          children: <Widget>[
            for (final List<String> r in rows)
              _DetailRow(label: r[0], value: r[1], scheme: c),
            _DetailRow(
              label: l10n.deployDoneDetailStatus,
              value: l10n.deployDoneStatusRunning,
              scheme: c,
              valueColor: c.marketUp,
            ),
          ],
        ),
      ),
      const SizedBox(height: QzSpacing.md),
      // next steps
      Text(
        l10n.deployDoneNextStepsLabel,
        style: TextStyle(
          color: c.textDim,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: QzSpacing.sm),
      _NextStepRow(
        stepKey: const Key('deploy-next-live'),
        icon: Icons.show_chart,
        title: l10n.deployDoneNextLiveTitle,
        sub: l10n.deployDoneNextLiveSub,
        scheme: c,
        // pop 返回 result：调用方据此跳 /me/live（#1752 联动）。
        onTap: onFinish,
      ),
      _NextStepRow(
        stepKey: const Key('deploy-next-notify'),
        icon: Icons.notifications_none,
        title: l10n.deployDoneNextNotifyTitle,
        sub: l10n.deployDoneNextNotifySub,
        scheme: c,
        onTap: onFinish,
      ),
      _NextStepRow(
        stepKey: const Key('deploy-next-tune'),
        icon: Icons.auto_awesome,
        title: l10n.deployDoneNextTuneTitle,
        sub: l10n.deployDoneNextTuneSub,
        scheme: c,
        onTap: onFinish,
      ),
    ];
    final Widget action = QzButton(
      key: const Key('deploy-finish'),
      label: l10n.deployDoneCloseButton,
      variant: QzButtonVariant.accent,
      height: 50,
      onPressed: onFinish,
    );

    if (stickyActions) {
      return Stack(
        children: <Widget>[
          Positioned.fill(
            bottom: 92,
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(top: QzSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: content,
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[c.bg.withValues(alpha: 0), c.bg, c.bg],
                  stops: const <double>[0, 0.32, 1],
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 12, 0, QzSpacing.xl),
                child: action,
              ),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        ...content,
        const SizedBox(height: QzSpacing.md),
        action,
      ],
    );
  }
}

class _NextStepRow extends StatelessWidget {
  const _NextStepRow({
    required this.stepKey,
    required this.icon,
    required this.title,
    required this.sub,
    required this.scheme,
    required this.onTap,
  });

  final Key stepKey;
  final IconData icon;
  final String title;
  final String sub;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.sm),
      child: InkWell(
        key: stepKey,
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.card),
        child: Container(
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: c.accent),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      title,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(sub, style: TextStyle(color: c.textDim, fontSize: 11)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 16, color: c.textDim),
            ],
          ),
        ),
      ),
    );
  }
}

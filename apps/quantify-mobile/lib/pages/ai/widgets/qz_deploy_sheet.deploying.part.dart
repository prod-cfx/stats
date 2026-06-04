part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _DeployingPane extends StatefulWidget {
  const _DeployingPane({
    required this.scheme,
    required this.exchangeName,
    required this.onDone,
  });

  final QzColorScheme scheme;
  final String exchangeName;
  final VoidCallback onDone;

  static const int _stepCount = 5;

  static List<DeployingStep> _steps(AppLocalizations l10n) => <DeployingStep>[
    DeployingStep(
      label: l10n.deployingStepAuthTitle,
      sub: l10n.deployingStepAuthSub,
    ),
    DeployingStep(
      label: l10n.deployingStepPushTitle,
      sub: l10n.deployingStepPushSub,
    ),
    DeployingStep(
      label: l10n.deployingStepNodeTitle,
      sub: l10n.deployingStepNodeSub,
    ),
    DeployingStep(
      label: l10n.deployingStepFeedTitle,
      sub: l10n.deployingStepFeedSub,
    ),
    DeployingStep(
      label: l10n.deployingStepReadyTitle,
      sub: l10n.deployingStepReadySub,
    ),
  ];

  @override
  State<_DeployingPane> createState() => _DeployingPaneState();
}

class _DeployingPaneState extends State<_DeployingPane> {
  /// 每步推进间隔。5 步 × 0.36s ≈ 1.8s，对齐历史部署可视化时长。
  static const Duration _stepInterval = Duration(milliseconds: 360);

  int _idx = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleNext();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _scheduleNext() {
    _timer = Timer(_stepInterval, () {
      if (!mounted) return;
      final int next = _idx + 1;
      if (next > _DeployingPane._stepCount) {
        widget.onDone();
        return;
      }
      setState(() => _idx = next);
      _scheduleNext();
    });
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = widget.scheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<DeployingStep> steps = _DeployingPane._steps(l10n);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
          child: Center(
            child: CircularProgressIndicator(
              key: const Key('deploy-progress'),
              color: c.accent,
            ),
          ),
        ),
        Text(
          l10n.deployingTitle(widget.exchangeName),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: c.text,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          l10n.deployingCaption,
          textAlign: TextAlign.center,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: QzSpacing.md),
        for (int i = 0; i < steps.length; i++)
          _DeployingStepRow(
            index: i,
            step: steps[i],
            done: i < _idx,
            active: i == _idx,
            scheme: c,
          ),
      ],
    );
  }
}

class _DeployingStepRow extends StatelessWidget {
  const _DeployingStepRow({
    required this.index,
    required this.step,
    required this.done,
    required this.active,
    required this.scheme,
  });

  final int index;
  final DeployingStep step;
  final bool done;
  final bool active;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Opacity(
      opacity: !done && !active ? 0.5 : 1,
      child: Padding(
        key: Key('deploy-step-$index'),
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: done
                    ? c.marketUp
                    : (active ? c.accent.withValues(alpha: 0.15) : c.bgSoft),
                borderRadius: BorderRadius.circular(11),
              ),
              child: done
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : (active
                        ? SizedBox(
                            width: 11,
                            height: 11,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: c.accent,
                            ),
                          )
                        : null),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    step.label,
                    style: TextStyle(
                      color: active ? c.text : c.textDim,
                      fontSize: 13,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    step.sub,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            if (done)
              Text(
                'OK',
                style: TextStyle(
                  color: c.marketUp,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

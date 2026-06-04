import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/qz_backtest_progress_card.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';

/// AI 量化「回测进行中」整屏页 — 向导第 4 步。
class AiBacktestRunPage extends StatefulWidget {
  const AiBacktestRunPage({super.key});

  @override
  State<AiBacktestRunPage> createState() => _AiBacktestRunPageState();
}

class _AiBacktestRunPageState extends State<AiBacktestRunPage> {
  double _progress = 0.38;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 110), (Timer timer) {
      if (!mounted) return;
      final double next = (_progress + 0.02).clamp(0.0, 1.0);
      setState(() => _progress = next);
      if (next >= 1) {
        timer.cancel();
        Future<void>.delayed(const Duration(milliseconds: 500), () {
          if (mounted) context.pushReplacement('/ai/backtest-result');
        });
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: '回测进行中',
        subtitle: 'BTC 趋势 · 双均线 · 15m',
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.commonCancel,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            QzStepBar(
              steps: <String>[
                l10n.aiStepConfirm,
                l10n.aiStepScript,
                l10n.aiStepBacktestConfig,
                l10n.aiStepBacktest,
                l10n.aiStepDeploy,
              ],
              active: 3,
              done: const <int>[0, 1, 2],
            ),
            Expanded(
              child: Stack(
                children: <Widget>[
                  ListView(
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.md,
                      QzSpacing.lg,
                      100,
                    ),
                    children: <Widget>[
                      QzBacktestProgressCard(progress: _progress),
                    ],
                  ),
                  Positioned(
                    left: QzSpacing.lg,
                    right: QzSpacing.lg,
                    bottom: QzSpacing.lg,
                    child: _SolidCancelButton(
                      key: const Key('backtest-progress-cancel'),
                      label: l10n.backtestProgressCancel,
                      onPressed: () => context.pop(),
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

class _SolidCancelButton extends StatelessWidget {
  const _SolidCancelButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(14),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: c.text.withValues(alpha: 0.04),
                offset: const Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

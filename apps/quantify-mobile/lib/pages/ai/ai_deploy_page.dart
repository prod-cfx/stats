import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import '../../widgets/qz_deploy_sheet.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';

/// AI 量化「部署策略」整屏页 — 向导第 5 步。
class AiDeployPage extends StatelessWidget {
  const AiDeployPage({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: '部署策略',
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
              active: 4,
              done: const <int>[0, 1, 2, 3],
            ),
            const Expanded(child: QzDeploySheet(showHeader: false)),
          ],
        ),
      ),
    );
  }
}

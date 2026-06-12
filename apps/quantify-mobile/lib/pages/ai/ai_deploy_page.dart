import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/deploy_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import 'widgets/qz_deploy_sheet.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';

/// AI 量化「部署策略」整屏页。
class AiDeployPage extends StatelessWidget {
  const AiDeployPage({super.key, this.deploymentContext});

  final DeploymentContext? deploymentContext;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    final String subtitle = deploymentContext?.symbol?.trim().isNotEmpty == true
        ? deploymentContext!.symbol!.trim()
        : 'AI 策略';
    final bool canDeploy =
        deploymentContext?.publishedSnapshotId.trim().isNotEmpty == true;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: '部署策略',
        subtitle: subtitle,
        onBack: () => context.go('/ai'),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.aiConfirmBackToChat,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: canDeploy
            ? QzDeploySheet(
                showHeader: false,
                deploymentContext: deploymentContext,
              )
            : QzEmptyState(
                key: const Key('ai-deploy-empty'),
                icon: Icons.rocket_launch_outlined,
                title: l10n.deployEmptyTitle,
              ),
      ),
    );
  }
}

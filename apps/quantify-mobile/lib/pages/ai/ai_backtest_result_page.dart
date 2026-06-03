import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_backtest_result_card.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';

/// AI 量化「回测结果」整屏页 — 仍属于向导第 4 步。
class AiBacktestResultPage extends ConsumerWidget {
  const AiBacktestResultPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.backtestResultTitle,
        subtitle: 'BTC 趋势 · 双均线 · 15m',
        onBack: () => context.pop(),
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
              child: FutureBuilder<BacktestResult>(
                future: ref.read(backtestRepositoryProvider).getResult('mock'),
                builder:
                    (BuildContext context, AsyncSnapshot<BacktestResult> s) {
                      if (!s.hasData) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      return Stack(
                        children: <Widget>[
                          ListView(
                            padding: const EdgeInsets.fromLTRB(
                              QzSpacing.lg,
                              QzSpacing.md,
                              QzSpacing.lg,
                              100,
                            ),
                            children: <Widget>[
                              QzBacktestResultCard(result: s.data!),
                            ],
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(
                                QzSpacing.lg,
                                QzSpacing.md,
                                QzSpacing.lg,
                                QzSpacing.lg,
                              ),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: <Color>[
                                    c.bg.withValues(alpha: 0),
                                    c.bg,
                                  ],
                                ),
                              ),
                              child: Row(
                                children: <Widget>[
                                  Expanded(
                                    child: QzButton(
                                      label: l10n.backtestCollapseButton,
                                      variant: QzButtonVariant.ghost,
                                      onPressed: () => context.pop(),
                                      expanded: true,
                                    ),
                                  ),
                                  const SizedBox(width: QzSpacing.md),
                                  Expanded(
                                    flex: 2,
                                    child: QzButton(
                                      label: '一键部署到交易所',
                                      variant: QzButtonVariant.accent,
                                      onPressed: () =>
                                          context.push('/ai/deploy'),
                                      expanded: true,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

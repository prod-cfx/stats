import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_panel.dart';
import '../../widgets/qz_spinner.dart';
import 'widgets/strategy_metric_card.dart';
import 'widgets/strategy_signal_tile.dart';

/// 策略详情 detail FutureProvider，按 id 分桶。
///
/// 用 family 而非 single 是为了：
///   1. 不同 id 之间互相缓存，反复进出页面不重拉
///   2. widget test 可以按 id `overrideWith` 注入确定性 future
final FutureProviderFamily<StrategyDetail, String> strategyDetailProvider =
    FutureProvider.family<StrategyDetail, String>((Ref ref, String id) {
  return ref.watch(strategyRepositoryProvider).getStrategyDetail(id);
});

final FutureProviderFamily<List<StrategySignal>, String>
    strategySignalsProvider =
    FutureProvider.family<List<StrategySignal>, String>((Ref ref, String id) {
  return ref.watch(strategyRepositoryProvider).listStrategySignals(id);
});

class StrategyDetailPage extends ConsumerWidget {
  const StrategyDetailPage({super.key, required this.id});

  final String id;

  String _fmtPct(double v, {bool sign = true}) =>
      '${sign && v > 0 ? '+' : ''}${v.toStringAsFixed(2)}%';

  QzMetricEmphasis _emphPos(double v) =>
      v >= 0 ? QzMetricEmphasis.up : QzMetricEmphasis.down;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<StrategyDetail> detailAsync =
        ref.watch(strategyDetailProvider(id));
    final AsyncValue<List<StrategySignal>> signalsAsync =
        ref.watch(strategySignalsProvider(id));
    final Set<String> subscriptions = ref.watch(strategySubscriptionsProvider);
    final bool subscribed = subscriptions.contains(id);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(title: Text(l10n.strategyDetailTitle)),
      body: detailAsync.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object err, _) => Center(
          child: QzEmptyState(title: l10n.commonLoadError, subtitle: err.toString()),
        ),
        data: (StrategyDetail d) => SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.lg,
              QzSpacing.lg,
              // 给底部订阅栏留出空间，避免最后一条信号被遮挡
              80,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _Header(card: d.card),
                const SizedBox(height: QzSpacing.lg),
                _MetricGrid(
                  cards: <Widget>[
                    StrategyMetricCard(
                      label: l10n.strategyDetailReturn7d,
                      value: _fmtPct(d.return7d),
                      emphasis: _emphPos(d.return7d),
                    ),
                    StrategyMetricCard(
                      label: l10n.strategyDetailReturn30d,
                      value: _fmtPct(d.return30d),
                      emphasis: _emphPos(d.return30d),
                    ),
                    StrategyMetricCard(
                      label: l10n.strategyDetailReturnAll,
                      value: _fmtPct(d.returnAll),
                      emphasis: _emphPos(d.returnAll),
                    ),
                    StrategyMetricCard(
                      label: l10n.strategyDetailMaxDrawdown,
                      value: _fmtPct(d.maxDrawdown, sign: false),
                      emphasis: QzMetricEmphasis.down,
                    ),
                    StrategyMetricCard(
                      label: l10n.strategyDetailSharpe,
                      value: d.sharpe.toStringAsFixed(2),
                    ),
                    StrategyMetricCard(
                      label: l10n.strategyDetailWinRate,
                      value: '${(d.winRate * 100).toStringAsFixed(1)}%',
                    ),
                  ],
                ),
                const SizedBox(height: QzSpacing.lg),
                Text(
                  l10n.strategyDetailEquityCurve,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                QzPanel(
                  child: SizedBox(
                    height: 120,
                    child: Center(
                      child: Text(
                        l10n.strategyDetailCurvePlaceholder,
                        style: TextStyle(color: c.textDim, fontSize: 12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: QzSpacing.lg),
                Text(
                  l10n.strategyDetailRecentSignals,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                _SignalsSection(async: signalsAsync),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.sm,
            QzSpacing.lg,
            QzSpacing.sm,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: QzButton(
                  key: const Key('strategy-detail-load-chat-btn'),
                  label: l10n.strategyDetailLoadConversation,
                  variant: QzButtonVariant.ghost,
                  expanded: true,
                  onPressed: () => context.go('/ai?loadStrategy=$id'),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: QzButton(
                  key: const Key('strategy-detail-subscribe-btn'),
                  label: subscribed
                      ? l10n.strategyDetailSubscribed
                      : l10n.strategyDetailSubscribe,
                  variant: subscribed
                      ? QzButtonVariant.ghost
                      : QzButtonVariant.accent,
                  expanded: true,
                  onPressed: () => ref
                      .read(strategySubscriptionsProvider.notifier)
                      .toggle(id),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.card});
  final StrategyCard card;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        CircleAvatar(
          radius: 22,
          backgroundColor: c.accentSoft,
          child: Text(
            card.author.characters.first,
            style: TextStyle(
              color: c.accent,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                card.name,
                style: TextStyle(
                  color: c.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: QzSpacing.xxs),
              Text(
                '${card.author} · ${card.subscribers}${AppLocalizations.of(context).strategyDetailSubscribersSuffix}',
                style: TextStyle(color: c.textDim, fontSize: 12),
              ),
              const SizedBox(height: QzSpacing.sm),
              Wrap(
                spacing: QzSpacing.xs,
                runSpacing: QzSpacing.xs,
                children: card.tags
                    .map((String t) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: QzSpacing.sm,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: c.bgSoft,
                            borderRadius:
                                BorderRadius.circular(QzRadii.pill),
                          ),
                          child: Text(
                            t,
                            style: TextStyle(
                              color: c.textMid,
                              fontSize: 11,
                            ),
                          ),
                        ))
                    .toList(growable: false),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.cards});
  final List<Widget> cards;

  @override
  Widget build(BuildContext context) {
    // 3 列 × 2 行；使用 GridView.count 简化，shrinkWrap 让其落在
    // SingleChildScrollView 内不冲突。
    return GridView.count(
      crossAxisCount: 3,
      mainAxisSpacing: QzSpacing.sm,
      crossAxisSpacing: QzSpacing.sm,
      // 1.3 留出指标 value 字号 + label 行 + 上下 padding 的高度，
      // 1.5 会让 BoxConstraints h=66.7 而 column 实际 ~73，触发 6.3px overflow。
      childAspectRatio: 1.3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: cards,
    );
  }
}

class _SignalsSection extends StatelessWidget {
  const _SignalsSection({required this.async});
  final AsyncValue<List<StrategySignal>> async;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: QzSpacing.lg),
        child: Center(child: QzSpinner()),
      ),
      error: (Object e, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        child: QzEmptyState(title: l10n.strategyDetailSignalsLoadError, subtitle: e.toString()),
      ),
      data: (List<StrategySignal> list) {
        if (list.isEmpty) {
          return QzEmptyState(title: l10n.strategyDetailSignalsEmpty);
        }
        return Column(
          children: list
              .map((StrategySignal s) => StrategySignalTile(signal: s))
              .toList(growable: false),
        );
      },
    );
  }
}

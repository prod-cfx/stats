import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'widgets/equity_curve_view.dart';
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

/// 用户评价（#1565）。
final FutureProviderFamily<List<StrategyReview>, String>
    strategyReviewsProvider =
    FutureProvider.family<List<StrategyReview>, String>((Ref ref, String id) {
  return ref.watch(strategyRepositoryProvider).listReviews(id);
});

/// equity curve 按 (id, timeframe) 缓存（#1565）。
final FutureProviderFamily<List<double>, ({String id, EquityTimeframe tf})>
    strategyEquityProvider = FutureProvider.family<List<double>,
        ({String id, EquityTimeframe tf})>((Ref ref, ({String id, EquityTimeframe tf}) k) {
  return ref.watch(strategyRepositoryProvider).getEquityCurve(k.id, k.tf);
});

class StrategyDetailPage extends ConsumerStatefulWidget {
  const StrategyDetailPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<StrategyDetailPage> createState() =>
      _StrategyDetailPageState();
}

class _StrategyDetailPageState extends ConsumerState<StrategyDetailPage> {
  EquityTimeframe _tf = EquityTimeframe.d30;

  String _fmtPct(double v, {bool sign = true}) =>
      '${sign && v > 0 ? '+' : ''}${v.toStringAsFixed(2)}%';

  QzMetricEmphasis _emphPos(double v) =>
      v >= 0 ? QzMetricEmphasis.up : QzMetricEmphasis.down;

  /// 分享链接 host：使用 RFC 2606 保留 TLD `.invalid` 占位，避免自定义 scheme
  /// 在用户外部分享时变成死链，同时不会误指向真实未注册域名。
  /// 接入真实 Universal Link / App Link 后只改这里。
  static const String _shareLinkBase = 'https://strategy.quantify.invalid/s';

  Future<void> _share(BuildContext ctx, String id) async {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(ctx);
    // 不依赖外部 share_plus；先把链接拷到剪贴板并 toast 提示——保留扩展点
    await Clipboard.setData(ClipboardData(text: '$_shareLinkBase/$id'));
    if (!ctx.mounted) return;
    messenger.showSnackBar(
      SnackBar(content: Text(l10n.strategyDetailShareToast)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final String id = widget.id;
    final AsyncValue<StrategyDetail> detailAsync =
        ref.watch(strategyDetailProvider(id));
    final AsyncValue<List<StrategySignal>> signalsAsync =
        ref.watch(strategySignalsProvider(id));
    final AsyncValue<List<StrategyReview>> reviewsAsync =
        ref.watch(strategyReviewsProvider(id));
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: <Widget>[
                    Text(
                      l10n.strategyDetailEquityCurve,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    _EquityTabBar(
                      selected: _tf,
                      onChanged: (EquityTimeframe v) =>
                          setState(() => _tf = v),
                    ),
                  ],
                ),
                const SizedBox(height: QzSpacing.sm),
                QzPanel(
                  child: _EquitySection(id: id, tf: _tf),
                ),
                const SizedBox(height: QzSpacing.lg),
                Text(
                  l10n.strategyDetailParamsTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                _ParamsSection(card: d.card),
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
                const SizedBox(height: QzSpacing.lg),
                Text(
                  l10n.strategyDetailReviewsTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                _ReviewsSection(async: reviewsAsync),
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
              QzButton(
                key: const Key('strategy-detail-share-btn'),
                label: l10n.strategyDetailShareButton,
                variant: QzButtonVariant.ghost,
                onPressed: () => _share(context, id),
              ),
              const SizedBox(width: QzSpacing.sm),
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
            card.author.isEmpty ? '?' : card.author.characters.first,
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

/// equity 时间维度切换 tab（#1565）。
class _EquityTabBar extends StatelessWidget {
  const _EquityTabBar({required this.selected, required this.onChanged});

  final EquityTimeframe selected;
  final ValueChanged<EquityTimeframe> onChanged;

  String _label(BuildContext ctx, EquityTimeframe t) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (t) {
      EquityTimeframe.d7 => l10n.strategyDetailEquityTab7d,
      EquityTimeframe.d30 => l10n.strategyDetailEquityTab30d,
      EquityTimeframe.d90 => l10n.strategyDetailEquityTab90d,
      EquityTimeframe.y1 => l10n.strategyDetailEquityTab1y,
    };
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (final EquityTimeframe t in EquityTimeframe.values)
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                key: Key('strategy-detail-tf-${t.name}'),
                onTap: () => onChanged(t),
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: QzSpacing.xs, vertical: 2),
                  decoration: BoxDecoration(
                    color: t == selected ? c.accentSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _label(context, t),
                    style: TextStyle(
                      color: t == selected ? c.accent : c.textDim,
                      fontSize: 10,
                      fontWeight: t == selected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _EquitySection extends ConsumerWidget {
  const _EquitySection({required this.id, required this.tf});

  final String id;
  final EquityTimeframe tf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<double>> async = ref.watch(
      strategyEquityProvider((id: id, tf: tf)),
    );
    return SizedBox(
      height: 140,
      child: async.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, _) =>
            Center(child: Text(AppLocalizations.of(context).commonLoadError)),
        data: (List<double> pts) => EquityCurveView(data: pts),
      ),
    );
  }
}

/// 策略参数（#1565）：类型 / 品种 / 周期 / 止损 / 仓位 / 杠杆。
///
/// 因为后端尚未提供策略参数字段，从 [StrategyCard] 的 tags 与 category 派生
/// mock 值；接入真实后端后改成读 StrategyDetail.params。
class _ParamsSection extends StatelessWidget {
  const _ParamsSection({required this.card});
  final StrategyCard card;

  String _categoryLabel(BuildContext ctx) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (card.category) {
      StrategyCategory.all => l10n.commonAll,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  String _symbol() {
    // 仅取明显是交易对的 tag（按报价单位后缀匹配），
    // 避免把 grid / dca / momentum 等策略类型误判成交易对。
    for (final String t in card.tags) {
      final String up = t.toUpperCase();
      if (up.endsWith('USDT') ||
          up.endsWith('USDC') ||
          up.endsWith('USD') ||
          up.endsWith('BTC') ||
          up.endsWith('ETH')) {
        return up;
      }
    }
    return '—';
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({String label, String value})> rows =
        <({String label, String value})>[
      (label: l10n.strategyDetailParamType, value: _categoryLabel(context)),
      (label: l10n.strategyDetailParamSymbol, value: _symbol()),
      (label: l10n.strategyDetailParamPeriod, value: '15m / 1H'),
      (label: l10n.strategyDetailParamStopLoss, value: '2.0%'),
      (label: l10n.strategyDetailParamPosition, value: '100%'),
      (label: l10n.strategyDetailParamLeverage, value: '1×'),
    ];
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
      child: Column(
        children: <Widget>[
          for (int i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
              decoration: BoxDecoration(
                border: Border(
                  bottom: i < rows.length - 1
                      ? BorderSide(color: c.borderSoft, width: 0.5)
                      : BorderSide.none,
                ),
              ),
              child: Row(
                children: <Widget>[
                  Text(
                    rows[i].label,
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                  const Spacer(),
                  Text(
                    rows[i].value,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures()
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
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

/// 用户评价区块（#1565）。
class _ReviewsSection extends StatelessWidget {
  const _ReviewsSection({required this.async});

  final AsyncValue<List<StrategyReview>> async;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: QzSpacing.md),
        child: Center(child: QzSpinner()),
      ),
      error: (Object e, StackTrace st) {
        debugPrint('[StrategyDetail] reviews load failed: $e\n$st');
        return QzEmptyState(
          title: l10n.commonLoadError,
          subtitle: l10n.strategyDetailReviewsEmpty,
        );
      },
      data: (List<StrategyReview> list) {
        if (list.isEmpty) {
          return QzEmptyState(title: l10n.strategyDetailReviewsEmpty);
        }
        return Column(
          children: <Widget>[
            for (final StrategyReview r in list) _ReviewTile(review: r),
          ],
        );
      },
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final StrategyReview review;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: QzSpacing.sm),
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              CircleAvatar(
                radius: 12,
                backgroundColor: c.accentSoft,
                child: Text(
                  review.user.isEmpty ? '?' : review.user.characters.first,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                review.user,
                style: TextStyle(
                  color: c.text,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              _StarsRow(stars: review.stars),
            ],
          ),
          const SizedBox(height: QzSpacing.xs),
          Text(
            review.text,
            style: TextStyle(
              color: c.textMid,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _StarsRow extends StatelessWidget {
  const _StarsRow({required this.stars});

  final int stars;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (int i = 1; i <= 5; i++)
          Icon(
            i <= stars ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 12,
            color: i <= stars ? const Color(0xFFF59E0B) : c.borderStrong,
          ),
      ],
    );
  }
}

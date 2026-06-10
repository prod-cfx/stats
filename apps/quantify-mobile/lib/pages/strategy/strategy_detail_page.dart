import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// `FutureProviderFamily` 在 Riverpod 3.x 未由 flutter_riverpod 公开导出。
import 'package:riverpod/misc.dart' show FutureProviderFamily;
import 'package:go_router/go_router.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_avatar.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import 'strategy_detail_controller.dart';
import 'strategy_detail_state.dart';
import 'widgets/equity_curve_view.dart';
import 'widgets/load_conversation_toast.dart';
import 'widgets/strategy_metric_card.dart';
part 'strategy_detail_page.header.part.dart';
part 'strategy_detail_page.sections.part.dart';

/// 策略详情 detail FutureProvider，按 id 分桶。
///
/// 用 family 而非 single 是为了：
///   1. 不同 id 之间互相缓存，反复进出页面不重拉
///   2. widget test 可以按 id `overrideWith` 注入确定性 future
final FutureProviderFamily<StrategyDetail, String> strategyDetailProvider =
    FutureProvider.family<StrategyDetail, String>((Ref ref, String id) {
      return ref.watch(strategyRepositoryProvider).getStrategyDetail(id);
    });

/// equity curve 按 (id, timeframe) 缓存（#1565）。
final FutureProviderFamily<List<double>, ({String id, EquityTimeframe tf})>
strategyEquityProvider =
    FutureProvider.family<List<double>, ({String id, EquityTimeframe tf})>((
      Ref ref,
      ({String id, EquityTimeframe tf}) k,
    ) {
      return ref.watch(strategyRepositoryProvider).getEquityCurve(k.id, k.tf);
    });

class StrategyDetailPage extends ConsumerStatefulWidget {
  const StrategyDetailPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<StrategyDetailPage> createState() => _StrategyDetailPageState();
}

class _StrategyDetailPageState extends ConsumerState<StrategyDetailPage> {
  /// 把策略 `period`（如 `7D`/`30D`/`90D`/`1Y`）映射到 [EquityTimeframe]；
  /// 无法映射（如 `14D`/`15m`）时回退 [EquityTimeframe.d30]。
  static EquityTimeframe _defaultTimeframe(String period) {
    return switch (period.trim().toUpperCase()) {
      '7D' => EquityTimeframe.d7,
      '30D' => EquityTimeframe.d30,
      '90D' => EquityTimeframe.d90,
      '1Y' => EquityTimeframe.y1,
      _ => EquityTimeframe.d30,
    };
  }

  /// 点击「载入对话」：toast → 700ms → `/ai?loadStrategy=$id`。
  /// toast 文案在此解析（依赖 l10n），timer/导航请求由 controller 持有。
  Future<void> _onLoadConversation(StrategyDetail d) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    try {
      await ref
          .read(strategyRepositoryProvider)
          .startEditSession(
            d.card.id,
            locale: Localizations.localeOf(context).languageCode,
          );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.commonLoadError)));
      return;
    }
    if (!mounted) return;
    ref
        .read(strategyDetailControllerProvider.notifier)
        .fireToastAndNav(
          message: l10n.strategyHomeLoadedToast(d.card.name),
          route: '/ai?loadStrategy=${d.card.id}',
        );
  }

  /// 点击底栏「运行」（#1825，与广场卡 #1821 行为一致）：toast
  /// 「『名』已启动 · 进入实盘监控」，~700ms 后跳实盘监控 `/me/live`。
  Future<void> _onRun(StrategyDetail d) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    try {
      await ref.read(strategyRepositoryProvider).runTemplate(d.card.id);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.commonLoadError)));
      return;
    }
    if (!mounted) return;
    ref
        .read(strategyDetailControllerProvider.notifier)
        .fireToastAndNav(
          message: l10n.strategyHomeStartedToast(d.card.name),
          route: '/me/live',
        );
  }

  String _fmtPct(double v, {bool sign = true}) =>
      '${sign && v > 0 ? '+' : ''}${v.toStringAsFixed(2)}%';

  /// 使用人数：≥1000 缩写为 `x.xk`，否则原值（对齐设计稿 DStat users 格式）。
  String _fmtUsers(int n) =>
      n >= 1000 ? '${(n / 1000).toStringAsFixed(1)}k' : '$n';

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
    final AsyncValue<StrategyDetail> detailAsync = ref.watch(
      strategyDetailProvider(id),
    );
    final Set<String> favorites = ref.watch(strategyFavoritesProvider);
    final bool starred = favorites.contains(id);
    final StrategyDetailState pageState = ref.watch(
      strategyDetailControllerProvider,
    );
    // 导航副作用留 widget：controller 到点写 pendingNav，这里消费并跳转。
    ref.listen<StrategyDetailState>(strategyDetailControllerProvider, (
      StrategyDetailState? prev,
      StrategyDetailState next,
    ) {
      final String? route = next.pendingNav;
      if (route != null) {
        ref.read(strategyDetailControllerProvider.notifier).consumeNav();
        context.go(route);
      }
    });

    // 对齐设计稿 StratDetail：bottom-sheet 形态——顶部避开灵动岛，
    // 圆角顶 + 拖拽 handle + bgElev 头部。整页路由保留（深链 /strategy/:id
    // 不变），仅视觉改造为从底部升起的 sheet。
    return Scaffold(
      backgroundColor: c.scrim,
      body: Padding(
        padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 12),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          child: ColoredBox(
            color: c.bg,
            child: _SheetContent(
              dragHandle: const _SheetDragHandle(),
              header: _Header(
                card: detailAsync.maybeWhen(
                  data: (StrategyDetail d) => d.card,
                  orElse: () => null,
                ),
                starred: starred,
                onToggleStar: () =>
                    ref.read(strategyFavoritesProvider.notifier).toggle(id),
                onClose: () => _close(context),
              ),
              body: Stack(
                children: <Widget>[
                  detailAsync.when(
                    loading: () => const Center(child: QzSpinner()),
                    error: (Object err, _) => Center(
                      child: QzEmptyState(
                        title: l10n.commonLoadError,
                        subtitle: err.toString(),
                      ),
                    ),
                    data: (StrategyDetail d) {
                      final EquityTimeframe tf =
                          pageState.tf ?? _defaultTimeframe(d.card.period);
                      return SafeArea(
                        top: false,
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(
                            QzSpacing.lg,
                            14,
                            QzSpacing.lg,
                            100,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              // equity 卡：左上大号 +CAGR% +「{period} 累计收益」+ 时间 tab
                              // （对齐设计稿 StratDetail equity 卡，#1825）。
                              _EquityCard(
                                cagr: d.cagr,
                                tf: tf,
                                onChanged: (EquityTimeframe v) => ref
                                    .read(
                                      strategyDetailControllerProvider.notifier,
                                    )
                                    .setTf(v),
                                curve: _EquitySection(id: id, tf: tf),
                              ),
                              const SizedBox(height: QzSpacing.md),
                              // 6 格指标：Sharpe / 最大回撤 / 胜率 / 盈亏比 / 交易次数 / 使用人数
                              // （对齐设计稿 StratDetail stats grid，#1825）。
                              _MetricGrid(
                                cards: <Widget>[
                                  StrategyMetricCard(
                                    label: 'Sharpe',
                                    value: d.sharpe.toStringAsFixed(2),
                                  ),
                                  StrategyMetricCard(
                                    label: l10n.strategyDetailMaxDrawdown,
                                    value: _fmtPct(d.maxDrawdown, sign: false),
                                    emphasis: QzMetricEmphasis.down,
                                  ),
                                  StrategyMetricCard(
                                    label: l10n.strategyDetailWinRate,
                                    value:
                                        '${(d.winRate * 100).toStringAsFixed(1)}%',
                                  ),
                                  StrategyMetricCard(
                                    label: l10n.strategyDetailProfitLossRatio,
                                    value: d.profitLossRatio.toStringAsFixed(2),
                                  ),
                                  StrategyMetricCard(
                                    label: l10n.strategyDetailTradeCount,
                                    value: '${d.tradeCount}',
                                  ),
                                  StrategyMetricCard(
                                    label: l10n.strategyDetailUsers,
                                    value: _fmtUsers(d.users),
                                  ),
                                ],
                              ),
                              const SizedBox(height: QzSpacing.md),
                              Text(
                                l10n.strategyDetailParamsTitle,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: QzSpacing.sm),
                              _ParamsSection(detail: d),
                              const SizedBox(height: QzSpacing.md),
                              Text(
                                l10n.strategyDetailDescriptionTitle,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: QzSpacing.sm),
                              _DescriptionSection(card: d.card),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  if (pageState.toast != null)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 24,
                      child: Center(
                        child: LoadConversationToast(
                          key: const Key('strategy-load-conversation-toast'),
                          text: pageState.toast!,
                        ),
                      ),
                    ),
                ],
              ),
              bottomBar: SafeArea(
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
                        height: 48,
                        onPressed: () => _share(context, id),
                      ),
                      const SizedBox(width: QzSpacing.sm),
                      // 「载入对话」对齐设计稿 StratDetail 中间操作（#1825）：
                      // ghost 描边 + toast + 700ms 跳 ai。detail 未加载完时
                      // 按钮 disabled，避免在没有名字的情况下显示空 toast。
                      QzButton(
                        key: const Key('strategy-detail-load-chat-btn'),
                        label: l10n.strategyDetailLoadConversation,
                        variant: QzButtonVariant.ghost,
                        height: 48,
                        leading: const Icon(Icons.smart_toy_outlined),
                        onPressed: detailAsync.maybeWhen(
                          data: (StrategyDetail d) =>
                              () => unawaited(_onLoadConversation(d)),
                          orElse: () => null,
                        ),
                      ),
                      const SizedBox(width: QzSpacing.sm),
                      // 「运行」对齐设计稿 StratDetail 底栏紫渐变主操作（#1825，
                      // 与广场卡 #1821 行为一致）：toast + 700ms 跳实盘监控。
                      Expanded(
                        child: QzButton(
                          key: const Key('strategy-detail-run-btn'),
                          label: l10n.strategyDetailRunButton,
                          variant: QzButtonVariant.accent,
                          expanded: true,
                          height: 48,
                          leading: const Icon(Icons.play_arrow_rounded),
                          onPressed: detailAsync.maybeWhen(
                            data: (StrategyDetail d) =>
                                () => unawaited(_onRun(d)),
                            orElse: () => null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 关闭 sheet：能 pop 则 pop（保留 push 进入的导航栈），否则回首页。
  /// 兼容深链直达 /strategy/:id（栈底无上一页）场景，不让关闭按钮失效。
  void _close(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/strategy');
    }
  }
}

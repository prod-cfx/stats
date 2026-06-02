import 'dart:async';

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
import '../../widgets/qz_avatar.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import 'widgets/equity_curve_view.dart';
import 'widgets/load_conversation_toast.dart';
import 'widgets/strategy_metric_card.dart';

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
  /// 用户尚未手动切换时为 null，渲染时按策略 `card.period` 推导默认 tab
  /// （对齐设计稿 line 1052-1058 默认高亮策略自身周期，#1888）。
  EquityTimeframe? _tf;

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

  /// 「载入对话」toast 与跳转 timer（#1666 对齐 strategy_home_page #1596）。
  /// 显示 toast 后约 700ms 跳 `/ai?loadStrategy=$id`；
  /// dispose / 重复点击需安全取消，避免页面销毁后仍调 router。
  String? _toast;
  Timer? _toastTimer;
  Timer? _navTimer;
  static const Duration _kLoadConversationDelay = Duration(milliseconds: 700);
  static const Duration _kToastDuration = Duration(milliseconds: 2400);

  @override
  void dispose() {
    _toastTimer?.cancel();
    _navTimer?.cancel();
    super.dispose();
  }

  /// 点击「载入对话」：toast → 700ms → `context.go('/ai?loadStrategy=$id')`。
  /// 与 [_StrategyHomePageState._onLoadConversation] 行为对齐。
  void _onLoadConversation(StrategyDetail d) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String id = d.card.id;
    final String msg = l10n.strategyHomeLoadedToast(d.card.name);
    _toastTimer?.cancel();
    _navTimer?.cancel();
    setState(() => _toast = msg);
    _toastTimer = Timer(_kToastDuration, () {
      if (!mounted) return;
      setState(() => _toast = null);
    });
    _navTimer = Timer(_kLoadConversationDelay, () {
      if (!mounted) return;
      context.go('/ai?loadStrategy=$id');
    });
  }

  /// 点击底栏「运行」（#1825，与广场卡 #1821 行为一致）：toast
  /// 「『名』已启动 · 进入实盘监控」，~700ms 后跳实盘监控 `/me/live`。
  /// 复用 toast/nav timer，与「载入对话」同一取消语义，避免叠加跳转；
  /// 后端真实启动接口未就绪，此处先按设计稿做交互占位。
  void _onRun(StrategyDetail d) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String msg = l10n.strategyHomeStartedToast(d.card.name);
    _toastTimer?.cancel();
    _navTimer?.cancel();
    setState(() => _toast = msg);
    _toastTimer = Timer(_kToastDuration, () {
      if (!mounted) return;
      setState(() => _toast = null);
    });
    _navTimer = Timer(_kLoadConversationDelay, () {
      if (!mounted) return;
      context.go('/me/live');
    });
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
    final AsyncValue<StrategyDetail> detailAsync =
        ref.watch(strategyDetailProvider(id));
    final Set<String> favorites = ref.watch(strategyFavoritesProvider);
    final bool starred = favorites.contains(id);

    // 对齐设计稿 StratDetail：bottom-sheet 形态——顶部留 48px scrim，
    // 圆角顶 + 拖拽 handle + bgElev 头部。整页路由保留（深链 /strategy/:id
    // 不变），仅视觉改造为从底部升起的 sheet。
    return Scaffold(
      backgroundColor: c.scrim,
      body: Padding(
        padding: const EdgeInsets.only(top: 48),
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
          child: QzEmptyState(title: l10n.commonLoadError, subtitle: err.toString()),
        ),
        data: (StrategyDetail d) {
          final EquityTimeframe tf = _tf ?? _defaultTimeframe(d.card.period);
          return SafeArea(
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
                const SizedBox(height: QzSpacing.sm),
                // equity 卡：左上大号 +CAGR% +「{period} 累计收益」+ 时间 tab
                // （对齐设计稿 StratDetail equity 卡，#1825）。
                _EquityCard(
                  cagr: d.cagr,
                  tf: tf,
                  onChanged: (EquityTimeframe v) =>
                      setState(() => _tf = v),
                  curve: _EquitySection(id: id, tf: tf),
                ),
                const SizedBox(height: QzSpacing.lg),
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
                      value: '${(d.winRate * 100).toStringAsFixed(1)}%',
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
                  if (_toast != null)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 24,
                      child: Center(
                        child: LoadConversationToast(
                          key: const Key('strategy-load-conversation-toast'),
                          text: _toast!,
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
                              () => _onLoadConversation(d),
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
                            data: (StrategyDetail d) => () => _onRun(d),
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

/// Bottom-sheet 视觉骨架：bgElev 头部（含 handle + [header]）+ 可滚动
/// [child] body + 置底 [bottomBar]。对齐设计稿 StratDetail 三段式结构。
class _SheetContent extends StatelessWidget {
  const _SheetContent({
    required this.dragHandle,
    required this.header,
    required this.body,
    required this.bottomBar,
  });

  final Widget dragHandle;
  final Widget header;
  final Widget body;
  final Widget bottomBar;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      children: <Widget>[
        ColoredBox(
          color: c.bgElev,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.sm,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: Column(
              children: <Widget>[
                dragHandle,
                const SizedBox(height: QzSpacing.md),
                header,
              ],
            ),
          ),
        ),
        Expanded(child: body),
        DecoratedBox(
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border(top: BorderSide(color: c.borderSoft)),
          ),
          child: bottomBar,
        ),
      ],
    );
  }
}

/// 顶部 42×4 拖拽 handle（对齐设计稿 StratDetail）。
class _SheetDragHandle extends StatelessWidget {
  const _SheetDragHandle();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: 42,
      height: 4,
      decoration: BoxDecoration(
        color: c.border,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
    );
  }
}

/// 详情头部（对齐设计稿 StratDetail head）：
/// 头像 + 名 + (类型 Chip + `pair · period`) + 收藏 star + 关闭。
///
/// [card] 在 detail 加载中为 null，此时名称/Chip 占位、star/close 仍可用
/// （star 状态由外部 favorites 提供，与列表同源，不依赖 detail 数据）。
class _Header extends StatelessWidget {
  const _Header({
    required this.card,
    required this.starred,
    required this.onToggleStar,
    required this.onClose,
  });

  final StrategyCard? card;
  final bool starred;
  final VoidCallback onToggleStar;
  final VoidCallback onClose;

  String? _categoryLabel(BuildContext context, StrategyCategory category) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (category) {
      StrategyCategory.all => null,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  QzChipTone _categoryTone(StrategyCategory category) {
    return switch (category) {
      StrategyCategory.trend => QzChipTone.accent,
      StrategyCategory.grid => QzChipTone.info,
      StrategyCategory.arbitrage => QzChipTone.ok,
      StrategyCategory.reversal => QzChipTone.warn,
      StrategyCategory.hedge => QzChipTone.info,
      StrategyCategory.highFreq => QzChipTone.danger,
      StrategyCategory.all => QzChipTone.neutral,
    };
  }

  String _pairPeriod(StrategyCard card) {
    final List<String> parts = <String>[
      if (card.pair.isNotEmpty) card.pair,
      if (card.period.isNotEmpty) card.period,
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard? card = this.card;
    final String symbol = card?.symbol ?? '?';
    final String? catLabel =
        card == null ? null : _categoryLabel(context, card.category);
    final String pairPeriod = card == null ? '' : _pairPeriod(card);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        QzAvatar(label: symbol, size: 48, monospace: true),
        const SizedBox(width: QzSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                card?.name ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: QzSpacing.xs,
                runSpacing: QzSpacing.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  if (catLabel != null && catLabel.isNotEmpty)
                    QzChip(
                      label: catLabel,
                      tone: _categoryTone(card!.category),
                    ),
                  if (pairPeriod.isNotEmpty)
                    Text(
                      pairPeriod,
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        _HeaderButton(
          key: const Key('strategy-detail-star-btn'),
          tooltip: l10n.strategyDetailFavoriteTooltip,
          onPressed: onToggleStar,
          borderRadius: 10,
          background: starred
              ? const Color(0x1FF59E0B) // rgba(245,158,11,0.12)
              : c.bgSoft,
          icon: Icon(
            starred ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 18,
            color: starred ? const Color(0xFFF59E0B) : c.textMid,
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        _HeaderButton(
          key: const Key('strategy-detail-close-btn'),
          tooltip: l10n.strategyDetailCloseTooltip,
          onPressed: onClose,
          borderRadius: 17,
          background: c.bgSoft,
          icon: Icon(Icons.close_rounded, size: 16, color: c.textMid),
        ),
      ],
    );
  }
}

/// 34×34 头部填充按钮（对齐设计稿 star/close 容器）。
/// [borderRadius] 10 = star 圆角方钮，17 = close 圆形钮。
class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    super.key,
    required this.tooltip,
    required this.onPressed,
    required this.background,
    required this.icon,
    required this.borderRadius,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Color background;
  final Widget icon;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    // 视觉容器固定 34×34（对齐设计稿），触控热区放大到 48×48（Material 48dp 最小可点击尺寸）。
    return Tooltip(
      message: tooltip,
      excludeFromSemantics: true, // 语义名仅由下方 Semantics 提供，避免旁白重复朗读
      child: Semantics(
        button: true,
        label: tooltip,
        // 48×48 触控热区（Material 48dp），内含 34×34 视觉块；
        // InkWell 包住视觉块本身，ripple 形状/范围与圆角块严格一致（star r10 圆角方、close r17 圆）。
        child: SizedBox(
          width: 48,
          height: 48,
          child: Center(
            child: Material(
              color: background,
              borderRadius: BorderRadius.circular(borderRadius),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onPressed,
                child: SizedBox(
                  width: 34,
                  height: 34,
                  child: Center(child: icon),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.cards});
  final List<Widget> cards;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('strategy-detail-metric-grid'),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: GridView.count(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: cards,
      ),
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
      key: const Key('strategy-detail-equity-section'),
      height: 120,
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

  /// 交易周期：直接取 [StrategyCard.period]（如 `30D`），缺省回退 `—`。
  String _period() => card.period.isNotEmpty ? card.period : '—';

  /// 杠杆：高频策略 `5×`，其余 `1×`（对齐设计稿 m-screens-2.jsx:995）。
  String _leverage() =>
      card.category == StrategyCategory.highFreq ? '5×' : '1×';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({String label, String value})> rows =
        <({String label, String value})>[
      (label: l10n.strategyDetailParamType, value: _categoryLabel(context)),
      (label: l10n.strategyDetailParamSymbol, value: _symbol()),
      (label: l10n.strategyDetailParamPeriod, value: _period()),
      (label: l10n.strategyDetailParamStopLoss, value: '2.0%'),
      (label: l10n.strategyDetailParamPosition, value: '100%'),
      (label: l10n.strategyDetailParamLeverage, value: _leverage()),
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

/// equity 卡（对齐设计稿 StratDetail equity 卡，#1825）：
/// 左上大号 `+CAGR%` + 「{period} 累计收益」+ 右侧时间维度 tab，下方曲线。
class _EquityCard extends StatelessWidget {
  const _EquityCard({
    required this.cagr,
    required this.tf,
    required this.onChanged,
    required this.curve,
  });

  final double cagr;
  final EquityTimeframe tf;
  final ValueChanged<EquityTimeframe> onChanged;
  final Widget curve;

  String _periodLabel(BuildContext ctx, EquityTimeframe t) {
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
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool up = cagr >= 0;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                '${up ? '+' : ''}${cagr.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: up ? c.marketUp : c.marketDown,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  l10n.strategyDetailCumulativeReturn(
                    _periodLabel(context, tf),
                  ),
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ),
              const Spacer(),
              _EquityTabBar(selected: tf, onChanged: onChanged),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          curve,
        ],
      ),
    );
  }
}

/// 策略说明段（对齐设计稿 StratDetail description，#1825）：
/// 基于 [StrategyCard.description] + 类型派生一段固定说明文本。
class _DescriptionSection extends StatelessWidget {
  const _DescriptionSection({required this.card});
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

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String desc =
        card.description.isEmpty ? '' : '${card.description} ';
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Text(
        l10n.strategyDetailDescriptionBody(desc, _categoryLabel(context)),
        style: TextStyle(color: c.text, fontSize: 13, height: 1.6),
      ),
    );
  }
}

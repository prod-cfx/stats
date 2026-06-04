import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models/live_strategy_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'live_strategy_detail_controller.dart';
import 'widgets/live_close_with_position_sheet.dart';
import 'widgets/live_delete_sheet.dart';
import 'widgets/live_equity_curve.dart';
import 'widgets/live_need_pause_sheet.dart';
import 'widgets/live_status_style.dart';
part 'live_strategy_detail_page.overview.part.dart';
part 'live_strategy_detail_page.positions.part.dart';

/// 实盘策略详情页（#1752，`/me/live/:id`）。
///
/// 对齐设计稿 `ScreenLiveStratDetail`：hero（交易所 glyph + 状态 + 累计盈亏
/// + 权益曲线）→ 4 tab（概览/持仓/交易记录/参数）→ 底部 sticky 主操作。
/// 开启/暂停/恢复/删除走 mock 状态转换（#1773）；脚本/回测/部署档案入口仍依赖
/// 真实数据，保持禁用占位（future）。
class LiveStrategyDetailPage extends ConsumerStatefulWidget {
  const LiveStrategyDetailPage({super.key, required this.id});
  final String id;

  @override
  ConsumerState<LiveStrategyDetailPage> createState() =>
      _LiveStrategyDetailPageState();
}

class _LiveStrategyDetailPageState
    extends ConsumerState<LiveStrategyDetailPage> {
  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<LiveStrategy> strategy = ref.watch(
      liveStrategyDetailProvider(widget.id),
    );

    return Scaffold(
      backgroundColor: c.bg,
      body: strategy.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, StackTrace _) => Scaffold(
          appBar: QzTopBar(
            title: l10n.liveDetailTitle,
            onBack: () => context.pop(),
          ),
          body: Center(
            child: Text(
              l10n.liveLoadError,
              style: TextStyle(color: c.statusDanger),
            ),
          ),
        ),
        data: (LiveStrategy s) => _build(context, l10n, c, s),
      ),
    );
  }

  Widget _build(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
    LiveStrategy s,
  ) {
    final String tab = ref.watch(liveStrategyDetailControllerProvider).tab;
    return Column(
      children: <Widget>[
        QzTopBar(
          title: l10n.liveDetailTitle,
          subtitle: s.name,
          onBack: () => context.pop(),
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
                  _Hero(strategy: s),
                  const SizedBox(height: QzSpacing.md),
                  _DetailTabs(
                    options: <String>[
                      l10n.liveTabOverview,
                      l10n.liveTabPositions,
                      l10n.liveTabHistory,
                      l10n.liveTabParams,
                    ],
                    value: _labelFor(tab, l10n),
                    onChanged: (String v) => ref
                        .read(liveStrategyDetailControllerProvider.notifier)
                        .setTab(_keyFor(v, l10n)),
                  ),
                  const SizedBox(height: QzSpacing.md),
                  _tabBody(tab, s),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _StickyAction(strategy: s),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tabBody(String tab, LiveStrategy s) {
    switch (tab) {
      case 'positions':
        return _PositionsTab(id: s.id);
      case 'history':
        return _HistoryTab(id: s.id);
      case 'params':
        return _ParamsTab(id: s.id);
      case 'overview':
      default:
        return _OverviewTab(strategy: s);
    }
  }

  String _labelFor(String key, AppLocalizations l10n) {
    switch (key) {
      case 'positions':
        return l10n.liveTabPositions;
      case 'history':
        return l10n.liveTabHistory;
      case 'params':
        return l10n.liveTabParams;
      default:
        return l10n.liveTabOverview;
    }
  }

  String _keyFor(String label, AppLocalizations l10n) {
    if (label == l10n.liveTabPositions) return 'positions';
    if (label == l10n.liveTabHistory) return 'history';
    if (label == l10n.liveTabParams) return 'params';
    return 'overview';
  }
}


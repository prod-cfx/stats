import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/whale_profile_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_toast.dart';
import 'whale_profile_basic_tab_controller.dart';
import 'whale_profile_basic_tab_state.dart';
import 'whale_profile_sortable_tab_controller.dart';
import 'whale_profile_sortable_tab_state.dart';
import 'widgets/whale_chart_filter_sheet.dart';
import 'widgets/whale_detail_rows.dart';
import 'widgets/whale_detail_sort.dart';
import 'widgets/whale_perp_summary_card.dart';
import 'widgets/whale_pnl_chart.dart';
import 'widgets/whale_stat_cards.dart';
import 'widgets/whale_watch_rule_sheet.dart';
part 'whale_profile_page.header.part.dart';
part 'whale_profile_page.sortable.part.dart';
part 'whale_profile_page.tabs.part.dart';

/// 巨鲸地址详情页（#1791，`/whale/profile/:address`）。
///
/// 对齐设计稿 `WhaleProfileDetail`（`m-screens-whale-discover.jsx:617`）的
/// 6 tab 重型详情：基本信息（P&L 图 + 4 stat 卡 + 永续总价值明细）/ 现货 /
/// 永续 / 挂单 / 成交 / 历史。消费 #1858 落地的明细数据模型 + fixtures。
/// 交易统计弹窗（#1859/#1866）入口保留为 topbar 按钮，避免成为死代码。
/// 数据由 mock 驱动，真实读路径依赖 #1682。
class WhaleProfilePage extends ConsumerWidget {
  const WhaleProfilePage({super.key, required this.address});

  final String address;

  Future<void> _copyAddress(BuildContext context, AppLocalizations l10n) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!context.mounted) return;
    QzToast.show(context, l10n.whaleProfileCopied);
  }

  // 「一键监控」入口：复用现有 watch 规则流程（#1791 watch tab 同款 sheet）。
  Future<void> _openWatch(BuildContext context) async {
    await WhaleWatchRuleSheet.show(context);
  }

  // 「刷新」入口：失效 profile provider 触发详情数据重载。
  void _refresh(WidgetRef ref) {
    ref.invalidate(whaleProfileProvider(address));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<WhaleProfile> profile = ref.watch(
      whaleProfileProvider(address),
    );

    Widget header({String? tagTone}) => _ProfileHeader(
      address: address,
      tagTone: tagTone,
      onBack: () => context.pop(),
      onCopy: () => _copyAddress(context, l10n),
      onWatch: () => _openWatch(context),
      onRefresh: () => _refresh(ref),
    );

    return Scaffold(
      backgroundColor: c.bg,
      body: profile.when(
        loading: () => Column(
          children: <Widget>[
            header(),
            const Expanded(child: Center(child: QzSpinner())),
          ],
        ),
        error: (Object e, StackTrace _) => Column(
          children: <Widget>[
            header(),
            Expanded(
              child: Center(
                child: Text(
                  l10n.whaleProfileLoadError,
                  style: TextStyle(color: c.statusDanger),
                ),
              ),
            ),
          ],
        ),
        data: (WhaleProfile p) => _Detail(
          profile: p,
          header: header(tagTone: p.tagTone),
        ),
      ),
    );
  }
}


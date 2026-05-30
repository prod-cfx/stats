import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../widgets/qz_empty_state.dart';

/// 「数据」hub 中尚未实现子屏（聚合挂单 / 预测市场 / 币股）的占位空屏。
///
/// 切换到这些 tab 时渲染统一占位，避免崩溃；后续 issue 各自填充真实内容
/// 后替换 [DataHubPage] 中对应 IndexedStack 子项。
class DataHubPlaceholder extends StatelessWidget {
  const DataHubPlaceholder({super.key, required this.label});

  /// 子屏名（如「聚合挂单」），与占位文案一起展示，便于区分当前 tab。
  final String label;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return ColoredBox(
      color: c.bg,
      child: QzEmptyState(
        key: Key('data-hub-placeholder-$label'),
        title: label,
        subtitle: l10n.dataHubPlaceholderTitle,
      ),
    );
  }
}

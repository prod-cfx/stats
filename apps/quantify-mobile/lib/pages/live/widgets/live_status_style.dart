import 'package:flutter/material.dart';

import '../../../domain/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';

/// 实盘策略状态的展示样式（颜色 + 文案）。
///
/// 把状态→颜色映射收口到一个纯函数，消除列表卡 / 详情 hero / badge 各自
/// 重复的 switch（Good Taste：特殊情况变常规）。
class LiveStatusStyle {
  const LiveStatusStyle({
    required this.label,
    required this.fg,
    required this.bg,
    required this.dot,
  });

  final String label;
  final Color fg;
  final Color bg;
  final Color dot;
}

LiveStatusStyle liveStatusStyle(
  LiveStrategyStatus status,
  QzColorScheme c,
  AppLocalizations l10n,
) {
  Color soft(Color base) => base.withValues(alpha: 0.14);
  switch (status) {
    case LiveStrategyStatus.running:
      return LiveStatusStyle(
        label: l10n.liveStatusRunning,
        fg: c.statusOk,
        bg: soft(c.statusOk),
        dot: c.statusOk,
      );
    case LiveStrategyStatus.warning:
      return LiveStatusStyle(
        label: l10n.liveStatusWarning,
        fg: c.statusWarn,
        bg: soft(c.statusWarn),
        dot: c.statusWarn,
      );
    case LiveStrategyStatus.paused:
      return LiveStatusStyle(
        label: l10n.liveStatusPaused,
        fg: c.textDim,
        bg: c.bgSoft,
        dot: c.textDim,
      );
    case LiveStrategyStatus.stopped:
      return LiveStatusStyle(
        label: l10n.liveStatusStopped,
        fg: c.statusDanger,
        bg: soft(c.statusDanger),
        dot: c.statusDanger,
      );
  }
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_button.dart';
import '../../../widgets/qz_card.dart';
part 'qz_backtest_progress_card.parts.part.dart';

/// 「回测中」进度卡，内嵌在 AI 对话流（与结果卡同位置）。
///
/// 对齐设计稿 `m-screens-backtest.jsx` 的 `ScreenBacktestRun`（验收 #1894）：
/// 进度环 + 预计剩余时间 + 2×2 实时计数 + 实时净值曲线 + 引擎日志 + 取消入口。
/// 维持对话内嵌形态（不引入独立 route，形态边界见 docs/decisions.md #1749）。
///
/// 所有实时数值由 [progress]（0..1，调用方 mock 计时驱动）派生，调用方接口
/// 与旧版一致（[progress] + [onCancel]）。计数/曲线/日志为 cosmetic 演示数据，
/// 真实回测引擎接入时再以真实流替换。
class QzBacktestProgressCard extends StatelessWidget {
  const QzBacktestProgressCard({
    super.key,
    required this.progress,
    this.onCancel,
  });

  /// 0..1，由调用方 mock 计时驱动。
  final double progress;

  /// 取消回测；为 null 时不渲染取消按钮。
  final VoidCallback? onCancel;

  // —— cosmetic 演示常量（对齐设计稿数值）——
  static const int _totalBars = 52416;
  static const int _maxTrades = 184;
  static const int _maxWins = 102;
  static const double _maxDrawdownPct = 8.4;
  static const double _maxCumReturnPct = 31.6;
  static const List<String> _periods = <String>[
    '2021-01', '2021-08', '2022-03', '2022-10', '2023-05',
    '2023-12', '2024-07', '2025-02', '2025-09', '2026-05',
  ];

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final double p = progress.clamp(0.0, 1.0);
    final int pct = (p * 100).round();
    final NumberFormat fmt = NumberFormat.decimalPattern();

    final int processedBars = (_totalBars * p).round();
    final int trades = (_maxTrades * p).round();
    final int wins = (_maxWins * p).round();
    final int losses = trades - wins;
    final int periodIdx =
        math.min(_periods.length - 1, (p * _periods.length).floor());

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.backtestProgressTitle,
            style: TextStyle(
              color: c.text,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          _ProgressRing(progress: p, pct: pct),
          const SizedBox(height: QzSpacing.md),
          Center(
            child: Text(
              l10n.backtestProgressSubtitle,
              style: TextStyle(color: c.textMid, fontSize: 13),
            ),
          ),
          const SizedBox(height: QzSpacing.xxs),
          Center(
            child: Text(
              l10n.backtestRunReplayingPeriod(_periods[periodIdx]),
              key: const Key('backtest-progress-period'),
              style: TextStyle(
                color: c.textDim,
                fontSize: 12,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ),
          const SizedBox(height: QzSpacing.lg),
          _CountersGrid(
            processedBars: processedBars,
            totalBars: _totalBars,
            trades: trades,
            wins: wins,
            losses: losses,
            drawdownPct: _maxDrawdownPct * p,
            cumReturnPct: _maxCumReturnPct * p,
            fmt: fmt,
          ),
          const SizedBox(height: QzSpacing.lg),
          _SectionTitle(l10n.backtestRunSectionEquity),
          const SizedBox(height: QzSpacing.sm),
          _EquityCard(progress: p),
          const SizedBox(height: QzSpacing.lg),
          _SectionTitle(l10n.backtestRunSectionLog),
          const SizedBox(height: QzSpacing.sm),
          _EngineLog(progress: p),
          const SizedBox(height: QzSpacing.lg),
          _PrivacyNote(l10n.backtestRunPrivacyNote),
          if (onCancel != null) ...<Widget>[
            const SizedBox(height: QzSpacing.md),
            QzButton(
              key: const Key('backtest-progress-cancel'),
              label: l10n.backtestProgressCancel,
              variant: QzButtonVariant.ghost,
              onPressed: onCancel,
              expanded: true,
            ),
          ],
        ],
      ),
    );
  }
}


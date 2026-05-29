import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_button.dart';
import 'qz_card.dart';

/// 「回测中」进度卡，内嵌在 AI 对话流（与结果卡同位置）。
///
/// 验收 #1751 §3：回测中状态需有明确 UI 表达，不与空白等待混淆。
/// 简化自设计稿 `m-screens-backtest.jsx` 的 `ScreenBacktestRun`——保留
/// 进度百分比 + 线性进度条 + 「正在回放历史 K 线」副标题 + 取消入口，
/// 不引入独立 route（route/sheet 形态边界见 docs/decisions.md #1749）。
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

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final double clamped = progress.clamp(0.0, 1.0);
    final int pct = (clamped * 100).round();

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.backtestProgressTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                '$pct%',
                key: const Key('backtest-progress-percent'),
                style: TextStyle(
                  color: c.accent,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(QzRadii.pill),
            child: LinearProgressIndicator(
              key: const Key('backtest-progress-bar'),
              value: clamped,
              minHeight: 6,
              backgroundColor: c.bgInput,
              valueColor: AlwaysStoppedAnimation<Color>(c.accent),
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          Text(
            l10n.backtestProgressSubtitle,
            style: TextStyle(color: c.textDim, fontSize: 12),
          ),
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

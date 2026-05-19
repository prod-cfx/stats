import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';

/// 策略卡 status badge 视觉（#1565）。
///
/// 4 种状态：
///   - hot：红底白字 + 🔥
///   - new：绿底绿字
///   - official：紫底紫字
///   - pro：橙→红渐变
///
/// 颜色不读 theme token——这些是品牌色，跨主题保持一致。
class StrategyStatusBadgeView extends StatelessWidget {
  const StrategyStatusBadgeView({super.key, required this.badge});

  final StrategyStatusBadge badge;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (badge) {
      StrategyStatusBadge.hot => _Plain(
          label: l10n.strategyBadgeHot,
          bg: const Color(0x1AEF4444),
          fg: const Color(0xFFEF4444),
        ),
      StrategyStatusBadge.newListing => _Plain(
          label: l10n.strategyBadgeNew,
          bg: const Color(0x1F16A36B),
          fg: const Color(0xFF16A36B),
        ),
      StrategyStatusBadge.official => _Plain(
          label: l10n.strategyBadgeOfficial,
          bg: const Color(0x1F7C5CFF),
          fg: const Color(0xFF7C5CFF),
        ),
      StrategyStatusBadge.pro => _Gradient(label: l10n.strategyBadgePro),
    };
  }
}

class _Plain extends StatelessWidget {
  const _Plain({required this.label, required this.bg, required this.fg});
  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _Gradient extends StatelessWidget {
  const _Gradient({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(QzRadii.input),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[Color(0xFFF59E0B), Color(0xFFEF4444)],
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

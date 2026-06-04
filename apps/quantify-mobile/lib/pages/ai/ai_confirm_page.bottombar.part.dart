part of 'ai_confirm_page.dart';
// ignore_for_file: unused_element

/// 免责声明条（shield icon）。
class _DisclaimerBar extends StatelessWidget {
  const _DisclaimerBar({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('ai-confirm-disclaimer'),
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 12, color: c.textDim),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: c.textDim, fontSize: 11, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}

/// 底部 sticky 行动条：从透明到背景色的渐变覆盖层（对齐设计稿
/// `linear-gradient(180deg, transparent, bg 30%)` + `padding:12px 16px 36px`），
/// 次按钮「返回对话」(elev + border) + 主按钮「下一步：策略脚本」(紫色渐变 + 投影 + 箭头)。
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.backLabel,
    required this.nextLabel,
    required this.onBack,
    required this.onNext,
  });

  final String backLabel;
  final String nextLabel;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      // 渐变在 30% 处达到不透明背景色，避免遮挡上方内容又保证按钮区可读。
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
          stops: const <double>[0, 0.3],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _SecondaryCta(label: backLabel, onTap: onBack, scheme: c),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: _PrimaryCta(label: nextLabel, onTap: onNext, scheme: c),
          ),
        ],
      ),
    );
  }
}

/// 次级按钮：elevated 背景 + 边框 + 中性文字色。
class _SecondaryCta extends StatelessWidget {
  const _SecondaryCta({
    required this.label,
    required this.onTap,
    required this.scheme,
  });

  final String label;
  final VoidCallback onTap;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: scheme.bgElev,
      borderRadius: BorderRadius.circular(QzRadii.card),
      child: InkWell(
        key: const Key('ai-confirm-back-cta'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.card),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(color: scheme.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: scheme.text,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

/// 主按钮：紫色渐变 + 投影 + 白字 + 右侧箭头。
class _PrimaryCta extends StatelessWidget {
  const _PrimaryCta({
    required this.label,
    required this.onTap,
    required this.scheme,
  });

  final String label;
  final VoidCallback onTap;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(QzRadii.card),
      child: InkWell(
        key: const Key('ai-confirm-next-cta'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.card),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: scheme.accentGrad,
            borderRadius: BorderRadius.circular(QzRadii.card),
            boxShadow: <BoxShadow>[scheme.accentShadow],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: scheme.accentOn,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: scheme.accentOn,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

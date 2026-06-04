part of 'ai_confirm_page.dart';
// ignore_for_file: unused_element

/// 顶栏右侧「取消」按钮。
/// Hero 卡：spark icon + 策略名 + 副标题 + 4 chips。
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.view, required this.subtitle});

  final StrategyConfirmView view;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      key: const Key('ai-confirm-hero'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.auto_awesome, size: 20, color: c.accent),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      view.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final ({String label, QzChipTone tone}) chip in view.chips)
                QzChip(label: chip.label, tone: chip.tone),
            ],
          ),
        ],
      ),
    );
  }
}

/// 区块标题 + 右侧动作链接（「在对话中修改」）。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          title,
          style: TextStyle(
            color: c.textMid,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
        const Spacer(),
        InkWell(
          key: const Key('ai-confirm-edit-in-chat'),
          onTap: onAction,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.xs,
              vertical: 2,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.edit_outlined, size: 11, color: c.accent),
                const SizedBox(width: 3),
                Text(
                  actionLabel,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// IF / THEN 规则块（IF 标签橙 / THEN 标签蓝，对齐设计稿）。
class _RuleBlock extends StatelessWidget {
  const _RuleBlock({
    required this.index,
    required this.rule,
    required this.ifLabel,
    required this.thenLabel,
  });

  // 设计稿固定标签色，不随主题反色。
  static const Color _ifColor = Color(0xFFD08A2A);
  static const Color _thenColor = Color(0xFF2A88D0);

  final int index;
  final ({String iff, String then}) rule;
  final String ifLabel;
  final String thenLabel;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: Key('ai-confirm-rule-$index'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _label(ifLabel, _ifColor),
          const SizedBox(height: QzSpacing.xs),
          Text(
            rule.iff,
            style: TextStyle(color: c.text, fontSize: 13, height: 1.55),
          ),
          const SizedBox(height: QzSpacing.sm),
          _label(thenLabel, _thenColor),
          const SizedBox(height: QzSpacing.xs),
          Text(
            rule.then,
            style: TextStyle(
              color: c.text,
              fontSize: 13,
              height: 1.55,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text, Color color) => Text(
    text,
    style: TextStyle(
      color: color,
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.2,
    ),
  );
}

/// 规则间分隔（「AND AT THEN」）。
class _RuleSeparator extends StatelessWidget {
  const _RuleSeparator({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.4,
          ),
        ),
      ),
    );
  }
}

/// EXECUTE 块：mono chips + 风控告警条列表。
class _ExecuteBlock extends StatelessWidget {
  const _ExecuteBlock({required this.view});

  final StrategyConfirmView view;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<({String k, String v})> chips = <({String k, String v})>[
      (k: l10n.aiConfirmExecExchange, v: view.execute.exchange),
      (k: l10n.aiConfirmExecSymbol, v: view.execute.symbol),
      (k: l10n.aiConfirmExecPeriod, v: view.execute.period),
      (k: l10n.aiConfirmExecPosition, v: view.execute.position),
      (k: l10n.aiConfirmExecMarket, v: view.execute.market),
    ];
    return Container(
      key: const Key('ai-confirm-execute'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.aiConfirmExecuteTitle,
            style: TextStyle(
              color: c.accent,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final ({String k, String v}) chip in chips)
                _MonoChip(label: chip.k, value: chip.v),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          for (final ({String kind, String desc}) risk
              in view.risks) ...<Widget>[
            _RiskBar(
              kind: risk.kind,
              desc: risk.desc,
              badge: l10n.aiConfirmRiskBadge,
            ),
            const SizedBox(height: QzSpacing.xs),
          ],
        ],
      ),
    );
  }
}

/// EXECUTE 内的 mono key:value chip。
class _MonoChip extends StatelessWidget {
  const _MonoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: QzSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(
            fontSize: 11.5,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
          children: <InlineSpan>[
            TextSpan(
              text: '$label: ',
              style: TextStyle(color: c.textDim),
            ),
            TextSpan(
              text: value,
              style: TextStyle(color: c.text, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

/// 风控告警条（橙色）。
class _RiskBar extends StatelessWidget {
  const _RiskBar({required this.kind, required this.desc, required this.badge});

  final String kind;
  final String desc;
  final String badge;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.06),
        border: Border.all(color: c.statusWarn.withValues(alpha: 0.20)),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.xs,
              vertical: 1,
            ),
            decoration: BoxDecoration(
              color: c.statusWarn.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$badge · $kind',
              style: TextStyle(
                color: c.statusWarn,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Text(
              desc,
              style: TextStyle(color: c.text, fontSize: 12, height: 1.55),
            ),
          ),
        ],
      ),
    );
  }
}

/// AI 提示框（紫底 + bot icon）。
class _AiAdviceBox extends StatelessWidget {
  const _AiAdviceBox({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('ai-confirm-advice'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: c.accent,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(Icons.smart_toy_outlined, size: 14, color: c.accentOn),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.xxs),
                Text(
                  text,
                  style: TextStyle(color: c.text, fontSize: 12, height: 1.65),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

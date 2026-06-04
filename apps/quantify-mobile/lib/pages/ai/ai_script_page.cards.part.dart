part of 'ai_script_page.dart';
// ignore_for_file: unused_element

/// recap 卡：策略名 + 标的元信息（mono）+ 文件名 badge。
class _RecapCard extends StatelessWidget {
  const _RecapCard({required this.params, required this.fileName});

  final Map<String, String> params;
  final String fileName;

  String get _meta {
    final List<String> parts = <String>[
      params['symbol'] ?? 'BTC/USDT',
      if ((params['period'] ?? '').isNotEmpty) params['period']!,
      if ((params['category'] ?? '').isNotEmpty) params['category']!,
      if ((params['leverage'] ?? '').isNotEmpty) params['leverage']!,
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return QzCard(
      child: Row(
        children: <Widget>[
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: c.accentSoft,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(Icons.auto_awesome, size: 18, color: c.accent),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  (params['category'] ?? '').isNotEmpty
                      ? params['category']!
                      : l10n.aiScriptTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Container(
            key: const Key('ai-script-file-badge'),
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.sm,
              vertical: QzSpacing.xxs,
            ),
            decoration: BoxDecoration(
              color: c.border.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(QzRadii.input),
            ),
            child: Text(
              fileName,
              style: TextStyle(
                color: c.textMid,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 状态行：左「待生成/已生成」+ 就绪态右侧复制按钮。
class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.ready,
    required this.copied,
    required this.onCopy,
  });

  final bool ready;
  final bool copied;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Row(
      children: <Widget>[
        Text(
          ready ? l10n.aiScriptStatusReady : l10n.aiScriptStatusPending,
          style: TextStyle(
            color: c.textMid,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const Spacer(),
        if (ready)
          InkWell(
            key: const Key('ai-script-copy'),
            onTap: onCopy,
            borderRadius: BorderRadius.circular(QzRadii.input),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.xs,
                vertical: 2,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    copied ? Icons.check : Icons.copy_outlined,
                    size: 12,
                    color: copied ? c.statusOk : c.accent,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    copied ? l10n.aiScriptCopied : l10n.aiScriptCopy,
                    style: TextStyle(
                      color: copied ? c.statusOk : c.accent,
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

/// 生成中态：spinner + 标题 + 三步文案。
class _GeneratingCard extends StatelessWidget {
  const _GeneratingCard({required this.title, required this.steps});

  final String title;
  final String steps;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      key: const Key('ai-script-generating'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        child: Column(
          children: <Widget>[
            SizedBox(
              width: 46,
              height: 46,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(c.accent),
                backgroundColor: c.accentSoft,
              ),
            ),
            const SizedBox(height: QzSpacing.md),
            Text(
              title,
              style: TextStyle(
                color: c.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: QzSpacing.xxs),
            Text(
              steps,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: c.textDim,
                fontSize: 11,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 就绪态成功提示条。
class _SuccessHint extends StatelessWidget {
  const _SuccessHint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('ai-script-success-hint'),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.statusOk.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(QzRadii.input),
        border: Border.all(color: c.statusOk.withValues(alpha: 0.20)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.check_circle_outline, size: 14, color: c.statusOk),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: c.text, fontSize: 12, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}

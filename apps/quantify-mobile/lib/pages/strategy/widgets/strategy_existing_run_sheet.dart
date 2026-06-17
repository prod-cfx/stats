import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_button.dart';

Future<bool?> showStrategyExistingRunSheet(
  BuildContext context, {
  required StrategyRunResult result,
  required StrategyCard fallbackCard,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (BuildContext context) =>
        _StrategyExistingRunSheet(result: result, fallbackCard: fallbackCard),
  );
}

class _StrategyExistingRunSheet extends StatelessWidget {
  const _StrategyExistingRunSheet({
    required this.result,
    required this.fallbackCard,
  });

  final StrategyRunResult result;
  final StrategyCard fallbackCard;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final _Copy copy = _copyFor(context);
    final String name = _firstNonEmpty(result.name, fallbackCard.name);
    final String symbol = _firstNonEmpty(result.symbol, fallbackCard.pair);
    final String timeframe = _firstNonEmpty(
      result.timeframe,
      fallbackCard.period.replaceFirst('近 ', ''),
    );
    final String meta = <String>[
      symbol,
      timeframe,
    ].where((String value) => value.trim().isNotEmpty).join(' / ');

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.72,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: c.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: c.accentSoft,
                      borderRadius: BorderRadius.circular(QzRadii.input),
                    ),
                    child: Icon(Icons.check, color: c.accent, size: 22),
                  ),
                  const SizedBox(width: QzSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          copy.title,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          copy.description,
                          style: TextStyle(
                            color: c.textMid,
                            fontSize: 14,
                            height: 1.55,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.bg,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (meta.isNotEmpty) ...<Widget>[
                                const SizedBox(height: 6),
                                Text(
                                  meta,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: c.textMid,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        _StatusPill(status: result.status, copy: copy),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      copy.hint,
                      style: TextStyle(
                        color: c.textMid,
                        fontSize: 12,
                        height: 1.55,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: <Widget>[
                  Expanded(
                    flex: 2,
                    child: QzButton(
                      label: copy.viewDetail,
                      variant: QzButtonVariant.accent,
                      expanded: true,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm + 2),
                  Expanded(
                    child: QzButton(
                      label: copy.close,
                      variant: QzButtonVariant.ghost,
                      expanded: true,
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.copy});

  final String? status;
  final _Copy copy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool running = status == 'running' || status == null;
    final bool stopped = status == 'stopped';
    final Color fg = running
        ? const Color(0xFF059669)
        : stopped
        ? c.textMid
        : c.accent;
    final Color bg = fg.withValues(alpha: 0.10);
    final String label = running
        ? copy.running
        : stopped
        ? copy.stopped
        : copy.draft;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: fg.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

class _Copy {
  const _Copy({
    required this.title,
    required this.description,
    required this.hint,
    required this.viewDetail,
    required this.close,
    required this.running,
    required this.stopped,
    required this.draft,
  });

  final String title;
  final String description;
  final String hint;
  final String viewDetail;
  final String close;
  final String running;
  final String stopped;
  final String draft;
}

_Copy _copyFor(BuildContext context) {
  final bool zh = Localizations.localeOf(context).languageCode == 'zh';
  if (!zh) {
    return const _Copy(
      title: 'Same strategy already exists',
      description:
          'This strategy template has already been created. The system keeps only one strategy for the same template.',
      hint:
          'Running it again opens the existing strategy details instead of creating a duplicate.',
      viewDetail: 'View details',
      close: 'Close',
      running: 'Running',
      stopped: 'Stopped',
      draft: 'Draft',
    );
  }
  return const _Copy(
    title: '已存在相同策略',
    description: '这个策略模板已经创建过，系统只保留一个相同模板策略。',
    hint: '再次运行会跳转到这个已有策略详情，不会重复创建。',
    viewDetail: '查看策略详情',
    close: '关闭',
    running: '运行中',
    stopped: '已停止',
    draft: '草稿',
  );
}

String _firstNonEmpty(String? primary, String fallback) {
  final String value = primary?.trim() ?? '';
  return value.isEmpty ? fallback.trim() : value;
}

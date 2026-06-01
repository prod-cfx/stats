import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_top_bar.dart';

/// AI 量化「确认策略」屏 — route `/ai/confirm`（#1832）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-confirm.jsx`
/// （`ScreenStratConfirm` + `ScreenStratScript`）：
///   - 顶栏 title「确认策略」/ sub「检查参数无误后开始回测」
///   - 参数确认卡：展示当前会话参数（position / fast_ma / slow_ma /
///     stop_loss 等），值用 [QzFont.mono]，与参数气泡保持一致。
///   - 底部 CTA「下一步：策略脚本」→ `context.push('/ai/script', extra: params)`，
///     脚本生成/查看拆到独立步骤屏（#1892）。
///
/// 入参：当前会话参数经 `extra` 传入（`Map<String, String>`）。缺省时回退到
/// mock 默认参数，保证直接打开 `/ai/confirm`（如深链 / widget test）不崩。
class AiConfirmPage extends StatefulWidget {
  const AiConfirmPage({super.key, this.params});

  /// 当前会话参数键值对。来自参数气泡 `onConfirm` 接线（#1831），经 router
  /// `extra` 透传。`null` 时使用 [_fallbackParams]。
  final Map<String, String>? params;

  @override
  State<AiConfirmPage> createState() => _AiConfirmPageState();
}

class _AiConfirmPageState extends State<AiConfirmPage> {
  /// 直接深链打开（无会话上下文）时的兜底参数，对齐设计稿 BTC 趋势双均线。
  static const Map<String, String> _fallbackParams = <String, String>{
    'category': '趋势跟踪',
    'symbol': 'BTC/USDT',
    'period': '15m',
    'fast_ma': '5',
    'slow_ma': '20',
    'stop_loss': '2.0%',
    'leverage': '1x',
  };

  Map<String, String> get _params =>
      (widget.params != null && widget.params!.isNotEmpty)
          ? widget.params!
          : _fallbackParams;

  void _next() {
    context.push('/ai/script', extra: _params);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: '确认策略',
        subtitle: '检查参数无误后开始回测',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(QzSpacing.lg),
                children: <Widget>[
                  _ParamCard(params: _params),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.sm,
                QzSpacing.lg,
                QzSpacing.lg,
              ),
              child: QzButton(
                key: const Key('ai-confirm-next-cta'),
                label: l10n.aiConfirmNextScript,
                variant: QzButtonVariant.accent,
                expanded: true,
                onPressed: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 参数确认卡：标题 + 参数键值表（值用 mono）。
class _ParamCard extends StatelessWidget {
  const _ParamCard({required this.params});

  final Map<String, String> params;

  /// 仅展示策略超参，过滤掉非参数字段（category 用于顶部 chip，不进表格）。
  static const Set<String> _excluded = <String>{'category'};

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String? category = params['category'];
    final List<MapEntry<String, String>> rows = params.entries
        .where((MapEntry<String, String> e) => !_excluded.contains(e.key))
        .toList(growable: false);
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(
                '策略参数',
                style: TextStyle(
                  color: c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (category != null && category.isNotEmpty)
                Container(
                  key: const Key('ai-confirm-category-chip'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.sm,
                    vertical: QzSpacing.xxs,
                  ),
                  decoration: BoxDecoration(
                    color: c.accentSoft,
                    borderRadius: BorderRadius.circular(QzRadii.pill),
                  ),
                  child: Text(
                    category,
                    style: TextStyle(
                      color: c.accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: QzSpacing.xs),
          Text(
            '由当前对话生成 · 可在对话中继续微调',
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.md),
          Container(
            key: const Key('ai-confirm-params'),
            width: double.infinity,
            padding: const EdgeInsets.all(QzSpacing.md),
            decoration: BoxDecoration(
              color: c.border.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(QzRadii.input),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                for (final MapEntry<String, String> e in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.7,
                          fontFamily: QzFont.mono,
                          fontFamilyFallback: QzFont.monoFallback,
                        ),
                        children: <InlineSpan>[
                          TextSpan(
                            text: '${e.key} ',
                            style: TextStyle(color: c.textDim),
                          ),
                          TextSpan(
                            text: '= ${e.value}',
                            style: TextStyle(color: c.text),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

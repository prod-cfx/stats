import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

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
///   - 策略脚本预览块：终端风格头部 + mono 代码体 + 复制按钮（脚本取 mock）。
///   - 底部 CTA「下一步：回测设置」→ `context.push('/ai/backtest-config')`，
///     复用既有回测配置流（#1566）。
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

  bool _copied = false;

  Map<String, String> get _params =>
      (widget.params != null && widget.params!.isNotEmpty)
          ? widget.params!
          : _fallbackParams;

  /// 从参数生成 mock 策略脚本预览（对齐 `m-screens-confirm.jsx` STRAT_SCRIPT_BTC）。
  /// 真实脚本由后端 codegen 产出；本屏仅做预览，故按当前参数拼装模板。
  String get _script {
    final Map<String, String> p = _params;
    final String symbol = p['symbol'] ?? 'BTC/USDT';
    final String fast = p['fast_ma'] ?? '5';
    final String slow = p['slow_ma'] ?? '20';
    // stop_loss 形如 "2.0%"；脚本里用小数 trailing 表达，去掉百分号转比例。
    final String stopPct = (p['stop_loss'] ?? '2.0%').replaceAll('%', '');
    final double stopRatio =
        (double.tryParse(stopPct) ?? 2.0) / 100.0;
    return '''
// Quantify Strategy · 双均线趋势
// Source: AI dialogue session
import { Strategy, MA } from '@quantify/sdk';

export default class TrendMA extends Strategy {
  static SYMBOL      = '$symbol';
  static FAST_PERIOD = $fast;
  static SLOW_PERIOD = $slow;
  static STOP_LOSS   = $stopRatio; // trailing

  constructor() {
    super();
    this.fast = new MA({ period: TrendMA.FAST_PERIOD });
    this.slow = new MA({ period: TrendMA.SLOW_PERIOD });
  }

  onBar(bar) {
    this.fast.update(bar.close);
    this.slow.update(bar.close);
    if (!this.fast.ready || !this.slow.ready) return;
    if (this.fast.crossAbove(this.slow) && !this.position) {
      return this.openLong({
        stopLoss: bar.close * (1 - TrendMA.STOP_LOSS),
        tag: 'ma_cross_up',
      });
    }
    if (this.position && this.fast.crossBelow(this.slow)) {
      return this.closePosition({ reason: 'ma_cross_down' });
    }
  }
}''';
  }

  Future<void> _copyScript() async {
    try {
      await Clipboard.setData(ClipboardData(text: _script));
    } catch (_) {
      // 极少数平台 Clipboard 会抛（权限 / 平台异常）；静默降级，不打断流程。
    }
    if (!mounted) return;
    setState(() => _copied = true);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('已复制脚本')));
    Future<void>.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _next() {
    context.push('/ai/backtest-config');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
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
                  const SizedBox(height: QzSpacing.lg),
                  _ScriptPreview(
                    script: _script,
                    copied: _copied,
                    onCopy: _copyScript,
                  ),
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
                label: '下一步：回测设置',
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

/// 策略脚本预览块：终端风格头部（红黄绿点 + 文件名 + 复制）+ mono 代码体。
class _ScriptPreview extends StatelessWidget {
  const _ScriptPreview({
    required this.script,
    required this.copied,
    required this.onCopy,
  });

  final String script;
  final bool copied;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    // 代码体固定深色背景，与设计稿 #1a1530 一致（脚本预览不随主题反色）。
    const Color codeBg = Color(0xFF1A1530);
    const Color codeFg = Color(0xFFD9D5F0);
    return Container(
      decoration: BoxDecoration(
        color: codeBg,
        borderRadius: BorderRadius.circular(QzRadii.card),
        border: Border.all(color: c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 终端风格头部
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: QzSpacing.sm,
            ),
            color: Colors.white.withValues(alpha: 0.04),
            child: Row(
              children: <Widget>[
                const _Dot(Color(0xFFFF5F57)),
                const SizedBox(width: QzSpacing.xs),
                const _Dot(Color(0xFFFEBC2E)),
                const SizedBox(width: QzSpacing.xs),
                const _Dot(Color(0xFF28C840)),
                const Spacer(),
                Text(
                  'strategy.js',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                InkWell(
                  key: const Key('ai-confirm-copy-script'),
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
                          color: copied
                              ? const Color(0xFF5EEAA8)
                              : const Color(0xFFA78BFA),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          copied ? '已复制' : '复制脚本',
                          style: TextStyle(
                            color: copied
                                ? const Color(0xFF5EEAA8)
                                : const Color(0xFFA78BFA),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          // 代码体
          Padding(
            padding: const EdgeInsets.all(QzSpacing.md),
            child: Text(
              script,
              style: const TextStyle(
                color: codeFg,
                fontSize: 11,
                height: 1.6,
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

class _Dot extends StatelessWidget {
  const _Dot(this.color);
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

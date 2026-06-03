import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';

/// 默认参数（直接深链 `/ai/script` 无 extra 时回退），对齐设计稿 BTC 双均线。
const Map<String, String> kStratFallbackParams = <String, String>{
  'category': '趋势跟踪',
  'symbol': 'BTC/USDT',
  'period': '15m',
  'fast_ma': '5',
  'slow_ma': '20',
  'stop_loss': '2.0%',
  'leverage': '5x',
};

/// 由策略字段派生脚本文件名（验收项 6：不再写死 `strategy.js`）。
/// 优先取 `file`；缺省时由 symbol 派生（如 `BTC/USDT` → `btc_trend_ma.js`）。
String stratFileName(Map<String, String> params) {
  final String? explicit = params['file'];
  if (explicit != null && explicit.isNotEmpty) return explicit;
  final String symbol = params['symbol'] ?? 'BTC/USDT';
  final String base = symbol.split('/').first.toLowerCase();
  return '${base}_trend_ma.js';
}

/// 从参数生成 mock 策略脚本（对齐 `m-screens-confirm.jsx` STRAT_SCRIPT_BTC）。
/// 真实脚本由后端 codegen 产出；本屏仅做预览，故按当前参数拼装模板。
String buildStratScript(Map<String, String> params) {
  final String symbol = params['symbol'] ?? 'BTC/USDT';
  final String fast = params['fast_ma'] ?? '5';
  final String slow = params['slow_ma'] ?? '20';
  final String stopPct = (params['stop_loss'] ?? '2.0%').replaceAll('%', '');
  final double stopRatio = (double.tryParse(stopPct) ?? 2.0) / 100.0;
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

enum _ScriptStage { generating, ready }

/// AI 量化「策略脚本」屏 — route `/ai/script`（向导第 2 步，#1892）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-confirm.jsx#ScreenStratScript`：
///   - 顶栏「策略脚本」+ recap 卡（策略名 + 标的元信息 + 文件名 badge）。
///   - 「生成中」态：spinner + 「正在生成策略脚本」+ 三步文案。
///   - 「就绪」态：终端风格头部 + 行号 + 语法高亮代码体 + `✓ READY` badge +
///     展开折叠（长脚本「查看全部 N 行 / 收起」）+ 成功提示条。
///   - 底部「下一步：回测设置」仅就绪态可点 → push `/ai/backtest-config`。
class AiScriptPage extends StatefulWidget {
  const AiScriptPage({super.key, this.params});

  /// 当前会话参数键值对，经 router `extra` 透传。`null` 时回退 [kStratFallbackParams]。
  final Map<String, String>? params;

  @override
  State<AiScriptPage> createState() => _AiScriptPageState();
}

class _AiScriptPageState extends State<AiScriptPage> {
  static const int _collapsedLines = 12;

  _ScriptStage _stage = _ScriptStage.generating;
  bool _expanded = false;
  bool _copied = false;
  Timer? _genTimer;

  Map<String, String> get _params =>
      (widget.params != null && widget.params!.isNotEmpty)
      ? widget.params!
      : kStratFallbackParams;

  String get _script => buildStratScript(_params);
  String get _fileName => stratFileName(_params);
  bool get _ready => _stage == _ScriptStage.ready;

  @override
  void initState() {
    super.initState();
    // mock 生成耗时；真实接入后替换为 codegen 完成回调。
    _genTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _stage = _ScriptStage.ready);
    });
  }

  @override
  void dispose() {
    _genTimer?.cancel();
    super.dispose();
  }

  Future<void> _copyScript() async {
    try {
      await Clipboard.setData(ClipboardData(text: _script));
    } catch (_) {
      // 极少数平台 Clipboard 会抛（权限 / 平台异常）；静默降级，不打断流程。
    }
    if (!mounted) return;
    final AppLocalizations l10n = AppLocalizations.of(context);
    setState(() => _copied = true);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.aiScriptCopiedToast)));
    Future<void>.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _next() {
    if (!_ready) return;
    context.push('/ai/backtest-config');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.aiScriptTitle,
        subtitle: l10n.aiScriptSubtitle,
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            QzStepBar(
              steps: <String>[
                l10n.aiStepConfirm,
                l10n.aiStepScript,
                l10n.aiStepBacktestConfig,
                l10n.aiStepBacktest,
                l10n.aiStepDeploy,
              ],
              active: 1,
              done: const <int>[0],
              onStepTap: (int i) {
                if (i == 0) context.pop();
              },
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  QzSpacing.lg,
                  QzSpacing.md,
                  QzSpacing.lg,
                  QzSpacing.lg,
                ),
                children: <Widget>[
                  _RecapCard(params: _params, fileName: _fileName),
                  const SizedBox(height: QzSpacing.lg),
                  _StatusRow(
                    ready: _ready,
                    copied: _copied,
                    onCopy: _copyScript,
                  ),
                  const SizedBox(height: QzSpacing.sm),
                  if (_ready) ...<Widget>[
                    _ScriptViewer(
                      script: _script,
                      fileName: _fileName,
                      copied: _copied,
                      expanded: _expanded,
                      collapsedLines: _collapsedLines,
                      onToggleExpand: () =>
                          setState(() => _expanded = !_expanded),
                      onCopy: _copyScript,
                    ),
                    const SizedBox(height: QzSpacing.md),
                    _SuccessHint(text: l10n.aiScriptSuccessHint),
                  ] else
                    _GeneratingCard(
                      title: l10n.aiScriptGeneratingTitle,
                      steps: l10n.aiScriptGeneratingSteps,
                    ),
                ],
              ),
            ),
            _BottomBar(
              ready: _ready,
              prevLabel: l10n.aiScriptPrev,
              nextLabel: l10n.aiScriptNext,
              onPrev: () => context.pop(),
              onNext: _next,
            ),
          ],
        ),
      ),
    );
  }
}

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

/// 脚本查看器：终端头部（红黄绿点 + 文件名 + READY badge + 复制）+ 行号 +
/// 语法高亮代码体 + 展开折叠。
class _ScriptViewer extends StatelessWidget {
  const _ScriptViewer({
    required this.script,
    required this.fileName,
    required this.copied,
    required this.expanded,
    required this.collapsedLines,
    required this.onToggleExpand,
    required this.onCopy,
  });

  final String script;
  final String fileName;
  final bool copied;
  final bool expanded;
  final int collapsedLines;
  final VoidCallback onToggleExpand;
  final VoidCallback onCopy;

  // 代码体固定深色背景，与设计稿 #1a1530 一致（不随主题反色）。
  static const Color _codeBg = Color(0xFF1A1530);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<String> lines = script.split('\n');
    final bool hasMore = lines.length > collapsedLines;
    final List<String> shown = expanded
        ? lines
        : lines.take(collapsedLines).toList(growable: false);
    return Container(
      decoration: BoxDecoration(
        color: _codeBg,
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
                  fileName,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Container(
                  key: const Key('ai-script-ready-badge'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.xs,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16C783).withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    l10n.aiScriptReadyBadge,
                    style: const TextStyle(
                      color: Color(0xFF5EEAA8),
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // 代码体（行号 + 高亮）
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.md,
              QzSpacing.sm,
              QzSpacing.md,
              QzSpacing.sm,
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  for (int i = 0; i < shown.length; i++)
                    _CodeLine(number: i + 1, text: shown[i]),
                ],
              ),
            ),
          ),
          // 展开折叠
          if (hasMore)
            InkWell(
              key: const Key('ai-script-expand-toggle'),
              onTap: onToggleExpand,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Icon(
                      expanded ? Icons.expand_less : Icons.expand_more,
                      size: 14,
                      color: const Color(0xFFA78BFA),
                    ),
                    const SizedBox(width: QzSpacing.xs),
                    Text(
                      expanded
                          ? l10n.aiScriptCollapse
                          : l10n.aiScriptExpand(lines.length),
                      style: const TextStyle(
                        color: Color(0xFFA78BFA),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 单行代码：左侧灰色行号 + 右侧高亮文本。
class _CodeLine extends StatelessWidget {
  const _CodeLine({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SizedBox(
          width: 26,
          child: Text(
            '$number',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.25),
              fontSize: 10,
              height: 1.6,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
        const SizedBox(width: 10),
        RichText(
          text: TextSpan(
            style: const TextStyle(
              fontSize: 11,
              height: 1.6,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
              color: Color(0xFFD9D5F0),
            ),
            children: _highlight(text),
          ),
        ),
      ],
    );
  }
}

/// 轻量 JS 语法高亮：行注释 / 字符串 / 关键字 / 数字。KISS，逐段切分。
List<InlineSpan> _highlight(String line) {
  const Color comment = Color(0xFF6B7280);
  const Color string = Color(0xFF86E1A0);
  const Color keyword = Color(0xFFC4B5FD);
  const Color number = Color(0xFFF0B96B);
  const Set<String> kw = <String>{
    'import',
    'from',
    'export',
    'default',
    'class',
    'extends',
    'static',
    'constructor',
    'return',
    'if',
    'else',
    'new',
    'this',
    'true',
    'false',
    'null',
    'undefined',
    'const',
    'let',
    'var',
    'async',
    'await',
    'function',
  };

  // 整行注释（以 // 开头，忽略前导空白）。脚本模板里注释均独占行或行尾，
  // 行尾注释场景少，做整行判定即可（KISS）。
  final int slash = line.indexOf('//');
  if (slash >= 0) {
    final String before = line.substring(0, slash);
    final bool noQuote =
        !before.contains('"') && !before.contains("'") && !before.contains('`');
    if (noQuote) {
      return <InlineSpan>[
        ..._highlightCode(before, kw, keyword, number),
        TextSpan(
          text: line.substring(slash),
          style: const TextStyle(color: comment, fontStyle: FontStyle.italic),
        ),
      ];
    }
  }
  return _highlightCode(line, kw, keyword, number, stringColor: string);
}

/// 高亮非注释片段：先切字符串，再对非字符串切关键字/数字。
List<InlineSpan> _highlightCode(
  String s,
  Set<String> kw,
  Color keyword,
  Color number, {
  Color stringColor = const Color(0xFF86E1A0),
}) {
  final List<InlineSpan> spans = <InlineSpan>[];
  final RegExp str = RegExp(
    r'''(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')''',
  );
  int last = 0;
  for (final RegExpMatch m in str.allMatches(s)) {
    if (m.start > last) {
      spans.addAll(
        _highlightTokens(s.substring(last, m.start), kw, keyword, number),
      );
    }
    spans.add(
      TextSpan(
        text: m.group(0),
        style: TextStyle(color: stringColor),
      ),
    );
    last = m.end;
  }
  if (last < s.length) {
    spans.addAll(_highlightTokens(s.substring(last), kw, keyword, number));
  }
  return spans;
}

/// 对纯代码片段切关键字与数字。
List<InlineSpan> _highlightTokens(
  String s,
  Set<String> kw,
  Color keyword,
  Color number,
) {
  final List<InlineSpan> spans = <InlineSpan>[];
  final RegExp token = RegExp(r'[A-Za-z_]\w*|\d+\.?\d*');
  int last = 0;
  for (final RegExpMatch m in token.allMatches(s)) {
    if (m.start > last) spans.add(TextSpan(text: s.substring(last, m.start)));
    final String t = m.group(0)!;
    if (kw.contains(t)) {
      spans.add(
        TextSpan(
          text: t,
          style: TextStyle(color: keyword, fontWeight: FontWeight.w600),
        ),
      );
    } else if (RegExp(r'^\d').hasMatch(t)) {
      spans.add(
        TextSpan(
          text: t,
          style: TextStyle(color: number),
        ),
      );
    } else {
      spans.add(TextSpan(text: t));
    }
    last = m.end;
  }
  if (last < s.length) spans.add(TextSpan(text: s.substring(last)));
  return spans;
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

/// 底部行动条：上一步 + 下一步（仅就绪态可点）。
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.ready,
    required this.prevLabel,
    required this.nextLabel,
    required this.onPrev,
    required this.onNext,
  });

  final bool ready;
  final String prevLabel;
  final String nextLabel;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: OutlinedButton(
              key: const Key('ai-script-prev'),
              onPressed: onPrev,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                foregroundColor: c.text,
                side: BorderSide(color: c.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(prevLabel),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton(
              key: const Key('ai-script-next-cta'),
              onPressed: ready ? onNext : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: c.accent,
                disabledBackgroundColor: c.border,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(nextLabel),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/models/ai_strategy_context.dart';
import '../../data/providers/repository_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';
import 'ai_script_page_controller.dart';
import 'ai_script_page_state.dart';
part 'ai_script_page.cards.part.dart';
part 'ai_script_page.viewer.part.dart';

/// 默认参数（兼容旧测试/旧入口透传空字段时的脚本预览），对齐设计稿 BTC 双均线。
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

class _ResolvingScriptInput extends StatelessWidget {
  const _ResolvingScriptInput();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.6,
                color: c.accent,
              ),
            ),
            const SizedBox(height: QzSpacing.lg),
            Text(
              '正在检查策略逻辑图',
              key: const Key('ai-script-resolving-title'),
              style: TextStyle(
                color: c.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.xs),
            Text(
              '正在确认当前会话是否已有策略逻辑图。',
              style: TextStyle(color: c.textDim, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ResolveScriptInputError extends StatelessWidget {
  const _ResolveScriptInputError({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.error_outline, size: 42, color: c.statusDanger),
            const SizedBox(height: QzSpacing.md),
            Text(
              '逻辑图状态检查失败',
              key: const Key('ai-script-resolve-error-title'),
              style: TextStyle(
                color: c.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.xs),
            Text(
              '${l10n.commonLoadError}: $error',
              style: TextStyle(color: c.textDim, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.lg),
            OutlinedButton(
              key: const Key('ai-script-resolve-retry'),
              onPressed: onRetry,
              child: Text(l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
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

/// AI 量化「策略脚本」屏 — route `/ai/script`（向导第 2 步，#1892）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-confirm.jsx#ScreenStratScript`：
///   - 顶栏「策略脚本」+ recap 卡（策略名 + 标的元信息 + 文件名 badge）。
///   - 「生成中」态：spinner + 「正在生成策略脚本」+ 三步文案。
///   - 「就绪」态：终端风格头部 + 行号 + 语法高亮代码体 + `✓ READY` badge +
///     展开折叠（长脚本「查看全部 N 行 / 收起」）+ 成功提示条。
///   - 底部「下一步：回测设置」仅就绪态可点 → push `/ai/backtest-config`。
class AiScriptPage extends ConsumerStatefulWidget {
  const AiScriptPage({super.key, this.params, this.strategyContext});

  /// 当前会话参数键值对，经 router `extra` 透传。`null` 时回退 [kStratFallbackParams]。
  final Map<String, String>? params;
  final AiPublishedStrategyContext? strategyContext;

  @override
  ConsumerState<AiScriptPage> createState() => _AiScriptPageState();
}

class _AiScriptPageState extends ConsumerState<AiScriptPage> {
  static const int _collapsedLines = 12;

  AiPublishedStrategyContext? _resolvedStrategyContext;
  bool _resolvingInput = false;
  Object? _resolveError;
  int _resolveEpoch = 0;

  AiScriptPageController get _ctrl =>
      ref.read(aiScriptPageControllerProvider.notifier);

  AiPublishedStrategyContext? get _strategyContext =>
      widget.strategyContext ?? _resolvedStrategyContext;

  bool get _hasDirectInputData =>
      widget.strategyContext != null || widget.params?.isNotEmpty == true;

  bool get _hasInputData =>
      _strategyContext != null || widget.params?.isNotEmpty == true;

  Map<String, String> get _params =>
      _strategyContext?.toRouteParams() ??
      ((widget.params != null && widget.params!.isNotEmpty)
          ? widget.params!
          : kStratFallbackParams);

  String get _script => _strategyContext?.scriptCode?.trim().isNotEmpty == true
      ? _strategyContext!.scriptCode!.trim()
      : buildStratScript(_params);
  String get _fileName => stratFileName(_params);
  String? get _codegenStatus =>
      _params['codegenStatus'] ??
      _params['codegen_status'] ??
      _params['status'];
  String? get _codegenError => _params['codegenError'] ?? _params['error'];
  bool get _canBacktest => _strategyContext?.hasPublishedSnapshot == true;

  @override
  void initState() {
    super.initState();
    _resolvingInput = !_hasDirectInputData;
    Future<void>.microtask(_resolveInputData);
  }

  @override
  void didUpdateWidget(covariant AiScriptPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.params != widget.params ||
        oldWidget.strategyContext != widget.strategyContext) {
      _resolveInputData();
    }
  }

  Future<void> _resolveInputData() async {
    final int epoch = ++_resolveEpoch;
    if (_hasDirectInputData) {
      if (mounted) {
        setState(() {
          _resolvedStrategyContext = null;
          _resolvingInput = false;
          _resolveError = null;
        });
      }
      _syncCodegenStatus();
      return;
    }

    setState(() {
      _resolvedStrategyContext = null;
      _resolvingInput = true;
      _resolveError = null;
    });
    try {
      final List<AiSession> sessions = await ref
          .read(aiChatRepositoryProvider)
          .listSessions();
      final AiPublishedStrategyContext? context = _latestScriptContext(
        sessions,
      );
      if (!mounted || epoch != _resolveEpoch) return;
      setState(() {
        _resolvedStrategyContext = context;
        _resolvingInput = false;
      });
      _syncCodegenStatus();
    } catch (error) {
      if (!mounted || epoch != _resolveEpoch) return;
      setState(() {
        _resolveError = error;
        _resolvingInput = false;
      });
    }
  }

  AiPublishedStrategyContext? _latestScriptContext(List<AiSession> sessions) {
    for (final AiSession session in sessions) {
      for (final ChatTurn turn in session.messages.reversed) {
        final AiPublishedStrategyContext? context = turn.strategyContext;
        if (turn.kind == ChatTurnKind.scriptReady &&
            context != null &&
            (context.hasPublishedSnapshot || context.hasScript)) {
          return context;
        }
      }
    }
    return null;
  }

  void _syncCodegenStatus() {
    _ctrl.syncCodegenStatus(_codegenStatus, errorMessage: _codegenError);
  }

  Future<void> _copyScript() async {
    try {
      await Clipboard.setData(ClipboardData(text: _script));
    } catch (_) {
      // 极少数平台 Clipboard 会抛（权限 / 平台异常）；静默降级，不打断流程。
    }
    if (!mounted) return;
    final AppLocalizations l10n = AppLocalizations.of(context);
    _ctrl.markCopied();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.aiScriptCopiedToast)));
  }

  void _next() {
    final AiPublishedStrategyContext? strategyContext = _strategyContext;
    if (!ref.read(aiScriptPageControllerProvider).ready || !_canBacktest) {
      return;
    }
    context.push('/ai/backtest-config', extra: strategyContext);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiScriptPageState st = ref.watch(aiScriptPageControllerProvider);
    final bool ready = st.ready;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.aiScriptTitle,
        subtitle: l10n.aiScriptSubtitle,
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.commonCancel,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _resolvingInput
            ? const _ResolvingScriptInput()
            : _resolveError != null
            ? _ResolveScriptInputError(
                error: _resolveError.toString(),
                onRetry: _resolveInputData,
              )
            : _hasInputData
            ? Column(
                children: <Widget>[
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
                          ready: ready,
                          copied: st.copied,
                          onCopy: _copyScript,
                        ),
                        const SizedBox(height: QzSpacing.sm),
                        if (ready) ...<Widget>[
                          _ScriptViewer(
                            script: _script,
                            fileName: _fileName,
                            copied: st.copied,
                            expanded: st.expanded,
                            collapsedLines: _collapsedLines,
                            onToggleExpand: _ctrl.toggleExpand,
                            onCopy: _copyScript,
                          ),
                          const SizedBox(height: QzSpacing.md),
                          _SuccessHint(text: l10n.aiScriptSuccessHint),
                        ] else if (st.failed)
                          _ScriptErrorCard(
                            text:
                                '${l10n.commonLoadError}: ${st.errorMessage ?? ''}',
                          )
                        else
                          _GeneratingCard(
                            title: l10n.aiScriptGeneratingTitle,
                            steps: l10n.aiScriptGeneratingSteps,
                          ),
                      ],
                    ),
                  ),
                  _BottomBar(
                    ready: ready && _canBacktest,
                    prevLabel: l10n.aiScriptPrev,
                    nextLabel: l10n.aiScriptNext,
                    onPrev: () => context.go('/ai'),
                    onNext: _next,
                  ),
                ],
              )
            : QzEmptyState(
                key: const Key('ai-script-empty'),
                icon: Icons.account_tree_outlined,
                title: l10n.aiScriptEmptyTitle,
              ),
      ),
    );
  }
}

import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/providers.dart';
import '../../data/services/api_client.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';
import 'ai_confirm_chat_handoff.dart';
part 'ai_confirm_page.blocks.part.dart';
part 'ai_confirm_page.bottombar.part.dart';

/// AI 量化「确认策略」屏 — route `/ai/confirm`（#1832 / 内容对齐 #1891）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-confirm.jsx#ScreenStratConfirm`：
///   - Hero 卡：spark icon + 策略名 + 副标题 + 4 chips（分类/交易对/周期/市场·杠杆）
///   - 策略逻辑区：IF/THEN RuleBlock（IF 橙 #D08A2A / THEN 蓝 #2A88D0），
///     多条规则间「AND AT THEN」分隔，区块标题右侧「在对话中修改」链接
///   - EXECUTE 块：交易所/标的/周期/仓位/市场 mono chips + 风控告警条
///   - AI 提示框（紫底 + bot icon）+ 免责声明条（shield）
///   - 底部双按钮「返回对话」/「确认策略」，顶栏右侧「取消」
///
/// 入参：当前会话参数经 `extra` 透传（`Map<String, String>`）。缺省时回退
/// [_fallbackParams]，保证深链 / widget test 直接打开不崩。
class AiConfirmPage extends ConsumerStatefulWidget {
  const AiConfirmPage({super.key, this.args, this.params});

  final AiConfirmArgs? args;

  /// 当前会话参数键值对。来自参数气泡 `onConfirm` 接线（#1831），经 router
  /// `extra` 透传。`null` 时使用 [_fallbackParams]。
  final Map<String, String>? params;

  /// 直接深链打开（无会话上下文）时的兜底参数，对齐设计稿 BTC 趋势双均线。
  static const Map<String, String> _fallbackParams = <String, String>{
    'category': '趋势跟踪',
    'symbol': 'BTC/USDT',
    'period': '15m',
    'fast_ma': '5',
    'slow_ma': '20',
    'stop_loss': '2.0%',
    'leverage': '5x',
  };

  @override
  ConsumerState<AiConfirmPage> createState() => _AiConfirmPageState();
}

class _AiConfirmPageState extends ConsumerState<AiConfirmPage> {
  static const int _confirmGateAdvanceLimit = 2;
  static const int _publishPollLimit = 60;
  static const Duration _publishPollInterval = Duration(milliseconds: 500);

  CodegenSessionResponseDto? _session;
  bool _loading = false;
  bool _confirming = false;
  String? _error;

  Map<String, String> get _params {
    final Map<String, String> remote = _paramsFromSession(_session);
    if (remote.isNotEmpty) return remote;
    final Map<String, String>? argParams = widget.args?.params;
    if (argParams != null && argParams.isNotEmpty) return argParams;
    if (widget.params != null && widget.params!.isNotEmpty) {
      return widget.params!;
    }
    return AiConfirmPage._fallbackParams;
  }

  String? get _sessionId =>
      widget.args?.codegenSessionId?.trim().isNotEmpty == true
      ? widget.args!.codegenSessionId!.trim()
      : null;

  @override
  void initState() {
    super.initState();
    if (_sessionId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadSession());
    }
  }

  Future<void> _loadSession() async {
    final String? sessionId = _sessionId;
    if (sessionId == null || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final CodegenSessionResponseDto session = await ref
          .read(aiChatRepositoryProvider)
          .getCodegenSession(sessionId);
      if (!mounted) return;
      setState(() => _session = session);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, String> _paramsFromSession(CodegenSessionResponseDto? session) {
    if (session == null) return const <String, String>{};
    return _stringParamsFromBuilt(
      session.publishedSnapshotParamValues ?? session.specDesc,
    );
  }

  Future<void> _next(BuildContext context) async {
    final String? sessionId = _sessionId;
    if (sessionId == null) {
      setState(() {
        _error = '缺少策略生成会话，请返回 AI 对话重新确认策略。';
      });
      return;
    }
    if (_confirming) return;

    setState(() {
      _confirming = true;
      _error = null;
    });
    try {
      final CodegenSessionResponseDto? preflight = await _loadPreflight(
        sessionId,
      );
      if (preflight != null) {
        if (!mounted) return;
        setState(() => _session = preflight);
        final bool opened = await _openIfReusable(sessionId, preflight);
        if (opened) return;
      }

      CodegenSessionResponseDto result;
      try {
        result = await ref
            .read(aiChatRepositoryProvider)
            .confirmStrategy(
              sessionId,
              message: '确认策略',
              confirmedCanonicalDigest:
                  widget.args?.confirmedCanonicalDigest ??
                  _session?.canonicalDigest,
            );
      } catch (error) {
        if (!_isConflictError(error)) rethrow;
        result = await _recoverAfterConflict(sessionId);
      }

      // 对齐 front：确认后后端可能先停在 CONFIRM_GATE，再进入生成/校验队列；
      // 移动端必须等到发布快照可用，后续回测才有 publishedSnapshotId 契约真相。
      result = await _advanceConfirmGate(sessionId, result);
      result = await _waitForPublishedSnapshot(sessionId, result);

      final String publishedSnapshotId =
          result.publishedSnapshotId?.trim() ?? '';
      if (publishedSnapshotId.isEmpty) {
        throw const FormatException('缺少已发布策略快照，无法进入回测流程。请重新确认策略。');
      }

      if (!mounted) return;
      setState(() => _session = result);
      _returnToChat(result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<CodegenSessionResponseDto> _advanceConfirmGate(
    String sessionId,
    CodegenSessionResponseDto initial,
  ) async {
    CodegenSessionResponseDto current = initial;
    for (int i = 0; i < _confirmGateAdvanceLimit; i++) {
      if (current.status != CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE) {
        break;
      }
      try {
        current = await ref
            .read(aiChatRepositoryProvider)
            .confirmStrategy(
              sessionId,
              message: '确认策略',
              confirmedCanonicalDigest: current.canonicalDigest,
            );
      } catch (error) {
        if (!_isConflictError(error)) rethrow;
        current = await _recoverAfterConflict(sessionId);
      }
    }
    return current;
  }

  Future<CodegenSessionResponseDto?> _loadPreflight(String sessionId) async {
    try {
      return await ref
          .read(aiChatRepositoryProvider)
          .getCodegenSession(sessionId);
    } catch (_) {
      // front 对短暂查询失败也会保留本地草稿继续确认；mobile 同步该容错。
      return null;
    }
  }

  Future<bool> _openIfReusable(
    String sessionId,
    CodegenSessionResponseDto snapshot,
  ) async {
    _ensureDigestCompatible(snapshot);
    if (_hasPublishedSnapshot(snapshot)) {
      _returnToChat(snapshot);
      return true;
    }
    if (_isProcessingStatus(snapshot.status)) {
      final CodegenSessionResponseDto published =
          await _waitForPublishedSnapshot(sessionId, snapshot);
      if (!mounted) return true;
      setState(() => _session = published);
      _returnToChat(published);
      return true;
    }
    if (_isTerminalFailure(snapshot.status)) {
      final String reason = snapshot.rejectReason?.trim().isNotEmpty == true
          ? snapshot.rejectReason!.trim()
          : '后端未发布策略快照';
      throw FormatException('策略发布失败：$reason');
    }
    return false;
  }

  Future<CodegenSessionResponseDto> _recoverAfterConflict(
    String sessionId,
  ) async {
    final CodegenSessionResponseDto snapshot = await ref
        .read(aiChatRepositoryProvider)
        .getCodegenSession(sessionId);
    _ensureDigestCompatible(snapshot);
    if (_hasPublishedSnapshot(snapshot)) return snapshot;
    if (!_isTerminalFailure(snapshot.status)) {
      return _waitForPublishedSnapshot(sessionId, snapshot);
    }
    throw const ApiException(
      statusCode: 409,
      code: 'CONFLICT',
      message: '回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。',
    );
  }

  bool _hasPublishedSnapshot(CodegenSessionResponseDto session) {
    return session.status == CodegenSessionResponseDtoStatusEnum.PUBLISHED &&
        session.publishedSnapshotId?.trim().isNotEmpty == true;
  }

  void _ensureDigestCompatible(CodegenSessionResponseDto snapshot) {
    final String local =
        widget.args?.confirmedCanonicalDigest?.trim() ??
        _session?.canonicalDigest?.trim() ??
        '';
    final String remote = snapshot.canonicalDigest?.trim() ?? '';
    if (local.isNotEmpty && remote.isNotEmpty && local != remote) {
      throw const FormatException('当前确认内容与后端会话不一致，请返回 AI 对话重新确认最新策略。');
    }
  }

  bool _isConflictError(Object error) {
    if (error is ApiException) return error.statusCode == 409;
    if (error is DioException) {
      final Object? inner = error.error;
      if (inner is ApiException && inner.statusCode == 409) return true;
      return error.response?.statusCode == 409;
    }
    final String text = error.toString();
    return text.contains('status=409') ||
        text.contains('HTTP 409') ||
        text.contains('CONFLICT');
  }

  Future<CodegenSessionResponseDto> _waitForPublishedSnapshot(
    String sessionId,
    CodegenSessionResponseDto initial,
  ) async {
    CodegenSessionResponseDto current = initial;
    for (int i = 0; i <= _publishPollLimit; i++) {
      if (current.status == CodegenSessionResponseDtoStatusEnum.PUBLISHED) {
        return current;
      }
      if (_isTerminalFailure(current.status)) {
        final String reason = current.rejectReason?.trim().isNotEmpty == true
            ? current.rejectReason!.trim()
            : '后端未发布策略快照';
        throw FormatException('策略发布失败：$reason');
      }
      if (!_isProcessingStatus(current.status) &&
          current.status != CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE &&
          current.status != CodegenSessionResponseDtoStatusEnum.DRAFTING) {
        throw FormatException('策略发布状态异常：${current.status.name}');
      }
      if (i == _publishPollLimit) break;
      await Future<void>.delayed(_publishPollInterval);
      current = await ref
          .read(aiChatRepositoryProvider)
          .getCodegenSession(sessionId);
    }
    throw TimeoutException('策略发布超时，请稍后返回确认策略重试。');
  }

  bool _isProcessingStatus(CodegenSessionResponseDtoStatusEnum status) {
    return status == CodegenSessionResponseDtoStatusEnum.GENERATING ||
        status == CodegenSessionResponseDtoStatusEnum.VALIDATING_STATIC ||
        status == CodegenSessionResponseDtoStatusEnum.VALIDATING_RUNTIME ||
        status == CodegenSessionResponseDtoStatusEnum.VALIDATING_OUTPUT ||
        status == CodegenSessionResponseDtoStatusEnum.VALIDATING_CONSISTENCY;
  }

  bool _isTerminalFailure(CodegenSessionResponseDtoStatusEnum status) {
    return status == CodegenSessionResponseDtoStatusEnum.CONSISTENCY_FAILED ||
        status == CodegenSessionResponseDtoStatusEnum.REJECTED;
  }

  void _returnToChat(CodegenSessionResponseDto result) {
    ref
        .read(aiConfirmChatHandoffProvider.notifier)
        .set(AiConfirmChatHandoff(result: result));
    context.go('/ai');
  }

  // `/ai/script` 保留深链兼容；确认页主路径回到对话页展示脚本生成态。

  void _backToChat(BuildContext context) => context.pop();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyConfirmView view =
        confirmStrategyViewFromSession(_session) ??
        confirmStrategyView(_params, l10n);
    final List<Widget> statusWidgets = <Widget>[
      if (_loading)
        Padding(
          padding: const EdgeInsets.only(bottom: QzSpacing.md),
          child: LinearProgressIndicator(color: c.accent),
        ),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.only(bottom: QzSpacing.md),
          child: _InlineError(message: _error!),
        ),
    ];
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.aiConfirmStrategy,
        subtitle: l10n.aiConfirmSubtitle,
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.aiConfirmCancel,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            // 滚动区 + sticky 渐变操作区叠放（对齐设计稿 `position:absolute`）。
            Expanded(
              child: Stack(
                children: <Widget>[
                  // 内容滚动区：顶 12 / 左右 16 / 底 100（给 sticky bar 留空间，
                  // 滚动到底免责声明不被遮挡），对齐设计稿 `padding:12px 16px 100px`。
                  ListView(
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.md,
                      QzSpacing.lg,
                      100,
                    ),
                    children: <Widget>[
                      _HeroCard(
                        view: view,
                        subtitle: l10n.aiConfirmHeroSubtitle,
                      ),
                      ...statusWidgets,
                      const SizedBox(height: QzSpacing.lg),
                      _SectionTitle(
                        title: l10n.aiConfirmLogicTitle,
                        actionLabel: l10n.aiConfirmEditInChat,
                        onAction: () => context.pop(),
                      ),
                      const SizedBox(height: QzSpacing.sm),
                      for (int i = 0; i < view.rules.length; i++) ...<Widget>[
                        if (i > 0) _RuleSeparator(label: l10n.aiConfirmRuleSep),
                        _RuleBlock(
                          index: i,
                          rule: view.rules[i],
                          ifLabel: l10n.aiConfirmRuleIf,
                          thenLabel: l10n.aiConfirmRuleThen,
                        ),
                      ],
                      const SizedBox(height: QzSpacing.lg),
                      _ExecuteBlock(view: view),
                      const SizedBox(height: QzSpacing.lg),
                      _AiAdviceBox(
                        title: l10n.aiConfirmAdviceTitle,
                        text: view.advice,
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _DisclaimerBar(text: l10n.aiConfirmDisclaimer),
                    ],
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomBar(
                      backLabel: l10n.aiConfirmBackToChat,
                      nextLabel: _confirming
                          ? '确认中...'
                          : l10n.aiConfirmStrategy,
                      onBack: () => _backToChat(context),
                      onNext: () => _next(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 确认策略屏的结构化视图模型（由 params 派生，纯数据，便于测试）。
class StrategyConfirmView {
  const StrategyConfirmView({
    required this.name,
    required this.chips,
    required this.rules,
    required this.execute,
    required this.risks,
    required this.advice,
  });

  final String name;
  final List<({String label, QzChipTone tone})> chips;
  final List<({String iff, String then})> rules;
  final ({
    String exchange,
    String symbol,
    String period,
    String position,
    String market,
  })
  execute;
  final List<({String kind, String desc})> risks;
  final String advice;
}

/// 确认页支持的策略场景（对齐设计稿 `STRAT_SCENARIOS`）。
enum _ConfirmScenario { btcTrend, ethGrid }

dynamic _jsonObjectValue(JsonObject? object) => object?.value;

Map<String, Object?> _objectMapFromBuilt(
  BuiltMap<String, JsonObject?>? source,
) {
  if (source == null) return const <String, Object?>{};
  return Map<String, Object?>.unmodifiable(
    Map<String, Object?>.fromEntries(
      source.entries.map(
        (MapEntry<String, JsonObject?> entry) => MapEntry<String, Object?>(
          entry.key,
          _normalizeConfirmJson(entry.value?.value),
        ),
      ),
    ),
  );
}

Object? _normalizeConfirmJson(Object? value) {
  if (value is BuiltMap) {
    return Map<String, Object?>.unmodifiable(
      Map<String, Object?>.fromEntries(
        value.entries.map(
          (MapEntry<dynamic, dynamic> entry) => MapEntry<String, Object?>(
            entry.key.toString(),
            _normalizeConfirmJson(
              entry.value is JsonObject
                  ? (entry.value as JsonObject).value
                  : entry.value,
            ),
          ),
        ),
      ),
    );
  }
  if (value is BuiltList) {
    return List<Object?>.unmodifiable(value.map(_normalizeConfirmJson));
  }
  if (value is Map) {
    return Map<String, Object?>.unmodifiable(
      value.map(
        (dynamic key, dynamic entry) => MapEntry<String, Object?>(
          key.toString(),
          _normalizeConfirmJson(entry),
        ),
      ),
    );
  }
  if (value is Iterable && value is! String) {
    return List<Object?>.unmodifiable(value.map(_normalizeConfirmJson));
  }
  return value;
}

Map<String, String> _stringParamsFromBuilt(
  BuiltMap<String, JsonObject?>? source,
) {
  if (source == null) return const <String, String>{};
  final Map<String, String> result = <String, String>{};
  for (final MapEntry<String, JsonObject?> entry in source.entries) {
    final dynamic value = _jsonObjectValue(entry.value);
    final String text = value?.toString().trim() ?? '';
    if (text.isNotEmpty) result[entry.key] = text;
  }
  return result;
}

StrategyConfirmView? confirmStrategyViewFromSession(
  CodegenSessionResponseDto? session,
) {
  if (session == null) return null;
  final Map<String, Object?> spec = _objectMapFromBuilt(session.specDesc);
  if (spec.isEmpty) return null;
  final Map<String, Object?> execution = _mapAt(spec, <String>[
    'executionContext',
  ]);
  final Map<String, Object?> graph = _mapAt(spec, <String>[
    'displayLogicGraph',
  ]);
  final List<Object?> blocks = _listAt(graph, <String>['blocks']);
  if (blocks.isEmpty && execution.isEmpty) return null;

  final List<({String iff, String then})> rules =
      <({String iff, String then})>[];
  final List<String> riskTexts = <String>[];
  String? positionText;
  for (final Object? blockRaw in blocks) {
    final Map<String, Object?> block = _asConfirmMap(blockRaw);
    final List<Object?> items = _listAt(block, <String>['items']);
    final List<String> conditions = <String>[];
    final List<String> actions = <String>[];
    for (final Object? itemRaw in items) {
      final Map<String, Object?> item = _asConfirmMap(itemRaw);
      final String text = _readConfirmString(item['text']);
      if (text.isEmpty) continue;
      final String kind = _readConfirmString(item['kind']).toLowerCase();
      if (kind == 'condition') {
        conditions.add(text);
      } else {
        actions.add(text);
        if (text.contains('止损') || text.contains('风控')) riskTexts.add(text);
        if (positionText == null &&
            (text.contains('仓位') || text.toUpperCase().contains('USDT'))) {
          positionText = text;
        }
      }
    }
    if (conditions.isNotEmpty || actions.isNotEmpty) {
      rules.add((
        iff: conditions.isEmpty ? '条件成立' : conditions.join('；'),
        then: actions.isEmpty ? '执行策略动作' : actions.join('\n'),
      ));
    }
  }

  final String exchange = _normalizeConfirmExchange(
    _readConfirmString(execution['exchange'] ?? execution['venue']),
  );
  final String symbol = _readConfirmString(execution['symbol']);
  final String period = _readConfirmString(execution['timeframe']);
  final String market = _normalizeConfirmMarket(
    _readConfirmString(execution['marketType'] ?? execution['market']),
  );
  final String fallbackSymbol = symbol.isEmpty ? 'BTCUSDT' : symbol;
  final String fallbackPeriod = period.isEmpty ? '15m' : period;
  final String fallbackExchange = exchange.isEmpty ? 'OKX' : exchange;
  final String fallbackMarket = market.isEmpty ? '永续合约' : market;
  final String position = positionText ?? _findPositionText(spec) ?? '按策略配置';
  final List<({String kind, String desc})> risks = riskTexts.isEmpty
      ? <({String kind, String desc})>[(kind: '风控', desc: '按已发布策略快照执行')]
      : riskTexts
            .map((String text) => (kind: _riskKind(text), desc: text))
            .toList(growable: false);

  return StrategyConfirmView(
    name: '$fallbackSymbol AI 策略',
    chips: <({String label, QzChipTone tone})>[
      (label: 'AI 量化', tone: QzChipTone.accent),
      (label: fallbackSymbol, tone: QzChipTone.neutral),
      (label: fallbackPeriod, tone: QzChipTone.neutral),
      (label: fallbackMarket, tone: QzChipTone.info),
    ],
    rules: rules.isEmpty
        ? <({String iff, String then})>[
            (iff: '策略条件来自已发布语义图', then: '按后端生成脚本执行'),
          ]
        : rules,
    execute: (
      exchange: fallbackExchange,
      symbol: fallbackSymbol,
      period: fallbackPeriod,
      position: position,
      market: fallbackMarket,
    ),
    risks: risks,
    advice: '策略逻辑已由后端生成并校验。请先完成回测，达标后再部署到交易所。',
  );
}

Map<String, Object?> _mapAt(Map<String, Object?> source, List<String> keys) {
  for (final String key in keys) {
    final Object? value = source[key];
    final Map<String, Object?> map = _asConfirmMap(value);
    if (map.isNotEmpty) return map;
  }
  return const <String, Object?>{};
}

List<Object?> _listAt(Map<String, Object?> source, List<String> keys) {
  for (final String key in keys) {
    final Object? value = source[key];
    if (value is List) return value;
  }
  return const <Object?>[];
}

Map<String, Object?> _asConfirmMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) {
    return value.map(
      (dynamic key, dynamic entry) => MapEntry<String, Object?>(
        key.toString(),
        _normalizeConfirmJson(entry),
      ),
    );
  }
  return const <String, Object?>{};
}

String _readConfirmString(Object? value) {
  final String text = value?.toString().trim() ?? '';
  return text == 'null' ? '' : text;
}

String _normalizeConfirmExchange(String raw) {
  final String value = raw.trim().toLowerCase();
  if (value.isEmpty) return '';
  if (value.contains('okx')) return 'OKX';
  if (value.contains('binance')) return 'Binance';
  if (value.contains('bybit')) return 'Bybit';
  if (value.contains('hyper')) return 'Hyperliquid';
  return raw.toUpperCase();
}

String _normalizeConfirmMarket(String raw) {
  final String value = raw.trim().toLowerCase();
  if (value.contains('spot') || value.contains('现货')) return '现货';
  if (value.contains('perp') ||
      value.contains('future') ||
      value.contains('永续')) {
    return '永续合约';
  }
  return raw;
}

String? _findPositionText(Map<String, Object?> source) {
  for (final Object? value in source.values) {
    if (value is String &&
        (value.contains('仓位') || value.toUpperCase().contains('USDT'))) {
      return value;
    }
    final Map<String, Object?> child = _asConfirmMap(value);
    if (child.isNotEmpty) {
      final String? found = _findPositionText(child);
      if (found != null) return found;
    }
    if (value is List) {
      for (final Object? item in value) {
        final Map<String, Object?> itemMap = _asConfirmMap(item);
        if (itemMap.isEmpty) continue;
        final String? found = _findPositionText(itemMap);
        if (found != null) return found;
      }
    }
  }
  return null;
}

String _riskKind(String text) {
  if (text.contains('止损')) return '止损';
  if (text.contains('止盈')) return '止盈';
  return '风控';
}

/// 由会话参数推断展示场景（#2132）。
///
/// 设计稿确认页以「策略身份 + 场景内容」为核心，而非 `symbol + category` 自由拼接。
/// 优先取显式 `scenario` 字段；否则由 `category` / `symbol` 推断：
///   - 网格类（category 含「网格」或 symbol 为 ETH）→ ETH 网格场景
///   - 其余 → BTC 趋势双均线场景（默认）
_ConfirmScenario _scenarioOf(Map<String, String> params) {
  final String explicit = (params['scenario'] ?? '').toLowerCase();
  if (explicit == 'eth' || explicit == 'eth_grid') {
    return _ConfirmScenario.ethGrid;
  }
  if (explicit == 'btc' || explicit == 'btc_trend') {
    return _ConfirmScenario.btcTrend;
  }

  final String category = params['category'] ?? '';
  final String symbol = (params['symbol'] ?? '').toUpperCase();
  if (category.contains('网格') || symbol.startsWith('ETH')) {
    return _ConfirmScenario.ethGrid;
  }
  return _ConfirmScenario.btcTrend;
}

/// 由会话参数派生确认视图（对齐设计稿 `STRAT_SCENARIOS` 的策略身份与场景内容）。
///
/// 展示文案优先服从设计稿场景模板；仅 fast_ma / slow_ma / stop_loss 等业务参数
/// 做必要插值。纯静态标签（IF/THEN/EXECUTE 等）走 l10n。业务参数仍经 `extra`
/// 原样透传到发布 / 回测上下文，不受此展示映射影响。
StrategyConfirmView confirmStrategyView(
  Map<String, String> params,
  AppLocalizations l10n,
) {
  return switch (_scenarioOf(params)) {
    _ConfirmScenario.ethGrid => _ethGridView(params),
    _ConfirmScenario.btcTrend => _btcTrendView(params),
  };
}

/// BTC 趋势 · 双均线场景（设计稿 `STRAT_SCENARIOS.btc`）。
StrategyConfirmView _btcTrendView(Map<String, String> params) {
  final String symbol = params['symbol'] ?? 'BTC/USDT';
  final String category = params['category'] ?? '趋势跟踪';
  final String period = params['period'] ?? '15m';
  final String fast = params['fast_ma'] ?? '5';
  final String slow = params['slow_ma'] ?? '20';
  final String stop = (params['stop_loss'] ?? '2.0%').replaceAll('%', '');
  final String leverage = params['leverage'] ?? '';
  final String market = leverage.isNotEmpty ? '合约 · $leverage' : '合约 · 5x';

  return StrategyConfirmView(
    name: 'BTC 趋势 · 双均线',
    chips: <({String label, QzChipTone tone})>[
      (label: category, tone: QzChipTone.accent),
      (label: symbol, tone: QzChipTone.neutral),
      (label: period, tone: QzChipTone.neutral),
      (label: market, tone: QzChipTone.info),
    ],
    rules: <({String iff, String then})>[
      (iff: 'MA$fast 上穿 MA$slow，且当前未持有任何方向仓位', then: '开多 100%'),
      (iff: 'MA$fast 下穿 MA$slow', then: '平多'),
      (iff: '持仓回撤 ≥ $stop% (触发追踪止损)', then: '强制平多'),
    ],
    execute: (
      exchange: 'OKX',
      symbol: symbol.replaceAll('/', ''),
      period: period,
      position: '100%',
      market: '永续合约',
    ),
    risks: <({String kind, String desc})>[
      (kind: '止损', desc: '价格相对入场均价下跌 $stop% → 强制平仓'),
      (kind: '止盈', desc: '价格相对入场均价上涨 0.6% → 平仓'),
    ],
    advice:
        '该策略在 BTC 4H/15m 上历史表现稳定，但在区间震荡市场可能出现频繁假突破。'
        '建议同时开启「ATR 过滤」减少噪音。',
  );
}

/// ETH 网格 · 区间震荡场景（设计稿 `STRAT_SCENARIOS.eth`）。
StrategyConfirmView _ethGridView(Map<String, String> params) {
  final String symbol = params['symbol'] ?? 'ETH/USDT';
  final String period = params['period'] ?? '1H';

  return StrategyConfirmView(
    name: 'ETH 网格 · 区间震荡',
    chips: <({String label, QzChipTone tone})>[
      (label: '网格', tone: QzChipTone.info),
      (label: symbol, tone: QzChipTone.neutral),
      (label: period, tone: QzChipTone.neutral),
      (label: '现货', tone: QzChipTone.info),
    ],
    rules: <({String iff, String then})>[
      (iff: '价格下穿任一网格线，且该网格尚未持仓', then: '分批买入 10% 仓位'),
      (iff: '价格上穿对应网格线 (该格已有持仓)', then: '平该格仓位获利'),
      (iff: '价格跌破区间下沿 ≥ 2%', then: '暂停网格 (等待人工恢复)'),
    ],
    execute: (
      exchange: 'OKX',
      symbol: symbol.replaceAll('/', ''),
      period: period.toLowerCase(),
      position: '10% / 格',
      market: '现货',
    ),
    risks: <({String kind, String desc})>[
      (kind: '区间', desc: '下沿 2,400 USDT / 上沿 3,000 USDT，共 10 格'),
      (kind: '熔断', desc: '价格跌破区间下沿 2% → 暂停网格'),
    ],
    advice:
        '该策略适合 ETH 在 2400-3000 区间震荡的行情。如出现单边趋势（尤其向下突破），'
        '会持续被动接货并产生浮亏，务必关注风控提示。',
  );
}

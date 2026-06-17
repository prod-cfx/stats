import 'dart:async';

// ignore_for_file: unused_element, unused_field, prefer_final_fields

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/api_key_models.dart';
import '../../../data/models/ai_chat_models.dart';
import '../../../data/models/deploy_models.dart';
import '../../../data/providers.dart';
import '../../../data/repositories/live_strategy_repository.dart';
import '../../../domain/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../me/api_form_sheet.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_button.dart';
import '../../../widgets/qz_sheet.dart';

part 'qz_deploy_sheet.authorize.part.dart';
part 'qz_deploy_sheet.allocate.part.dart';
part 'qz_deploy_sheet.preflight.part.dart';
part 'qz_deploy_sheet.preflight_account.part.dart';
part 'qz_deploy_sheet.preflight_checks.part.dart';
part 'qz_deploy_sheet.deploying.part.dart';
part 'qz_deploy_sheet.done.part.dart';

/// 「一键部署」底部弹层。
///
/// 单 widget 内承载 3 段状态机
/// （`confirm → deploying → success`，#2064 对齐新版部署设计）。
/// 拆成多个 Widget 反而要把 step 状态外挂或层层 callback，按 KISS 内聚在一处。
///
/// 交易所列表读 `apiKeysProvider`；部署分步动画只表达进度，最终成功态由
/// `AiChatRepository.markDeployed` 的真实部署/轮询结果驱动。
///
/// 交易所 / 市场 / 资金由 AI 对话上下文决定，部署页只做只读账单确认 +
/// 部署前检查。未绑定 API 时在检查失败项内提供 API 绑定入口。
class QzDeploySheet extends ConsumerStatefulWidget {
  const QzDeploySheet({
    super.key,
    this.showHeader = true,
    this.deploymentContext,
  });

  final bool showHeader;
  final DeploymentContext? deploymentContext;

  /// 调起入口；返回的 `DeploymentResult` 表示部署成功，null 表示用户取消 /
  /// 关闭。
  static Future<DeploymentResult?> show(
    BuildContext context, {
    DeploymentContext? deploymentContext,
  }) {
    return QzSheet.show<DeploymentResult>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) =>
          QzDeploySheet(deploymentContext: deploymentContext),
    );
  }

  @override
  ConsumerState<QzDeploySheet> createState() => _QzDeploySheetState();
}

/// 弹层内置的交易所目录。
///
/// 设计稿 (`design/project/mobile/m-screens-1.jsx`) 中授权流的入口由该
/// 目录驱动；后端尚未提供「全部受支持交易所」接口，先维护一份本地枚举。
/// `apiKeysProvider` 返回的交易所若命中本目录，则 authorized=true 并使用
/// 真实 `ExchangeApiKey`；未命中则 authorized=false（走授权引导）。
class _ExchangeCatalogEntry {
  const _ExchangeCatalogEntry({
    required this.code,
    required this.name,
    this.tag = _ExchangeTag.none,
  });

  final String code; // 小写匹配 ExchangeApiKey.exchange
  final String name;
  final _ExchangeTag tag;
}

enum _ExchangeTag { none, recommended, onchain }

const List<_ExchangeCatalogEntry> _kExchangeCatalog = <_ExchangeCatalogEntry>[
  _ExchangeCatalogEntry(
    code: 'binance',
    name: 'Binance',
    tag: _ExchangeTag.recommended,
  ),
  _ExchangeCatalogEntry(code: 'okx', name: 'OKX'),
  _ExchangeCatalogEntry(code: 'bybit', name: 'Bybit'),
  _ExchangeCatalogEntry(
    code: 'hyperliquid',
    name: 'Hyperliquid',
    tag: _ExchangeTag.onchain,
  ),
];

/// 「目录条目 × 用户密钥」合并后的展示项。
class _DeployTarget {
  const _DeployTarget({
    required this.catalog,
    required this.accounts,
    required this.apiKey,
  });

  final _ExchangeCatalogEntry catalog;
  final List<ExchangeApiKey> accounts;
  final ExchangeApiKey? apiKey;
  bool get authorized => accounts.isNotEmpty && apiKey != null;
}

class _QzDeploySheetState extends ConsumerState<QzDeploySheet> {
  /// 资金配置默认值（mock）。
  static const double _defaultAmount = 5000;
  static const int _defaultPerTradePct = 20;
  static const int _defaultMaxDailyLossPct = 10;

  DeployStep _step = DeployStep.resolving;
  _DeployTarget? _deployingTarget;
  DeploymentResult? _result;
  Object? _deployError;
  Object? _resolveError;
  String? _selectedAccountId;

  // #1772 资金配置状态。
  double _amount = _defaultAmount;
  int _perTradePct = _defaultPerTradePct;
  int _maxDailyLossPct = _defaultMaxDailyLossPct;
  // 分渠道通知开关（#1796，对齐设计稿 3 个开关）。
  bool _notifyOpen = true;
  bool _notifyClose = true;
  bool _notifyStopLoss = true;

  @override
  void initState() {
    super.initState();
    unawaited(_restoreExistingDeployment());
  }

  @override
  void didUpdateWidget(covariant QzDeploySheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deploymentContext != widget.deploymentContext) {
      setState(() {
        _resolveError = null;
        _deployError = null;
        _result = null;
        _step = DeployStep.resolving;
      });
      unawaited(_restoreExistingDeployment());
    }
  }

  Future<void> _restoreExistingDeployment() async {
    final DeploymentContext? deploymentContext = widget.deploymentContext;
    if (deploymentContext == null) return;
    try {
      final DeploymentResult? result =
          await _findDeploymentResultFromLiveStrategy(deploymentContext);
      if (!mounted || widget.deploymentContext != deploymentContext) return;
      setState(() {
        _deployError = null;
        _resolveError = null;
        _result = result;
        _step = result == null ? DeployStep.confirm : DeployStep.success;
      });
    } catch (e) {
      if (!mounted || widget.deploymentContext != deploymentContext) return;
      setState(() {
        _resolveError = e;
        _step = DeployStep.resolving;
      });
    }
  }

  void _retryResolveDeployment() {
    setState(() {
      _resolveError = null;
      _deployError = null;
      _result = null;
      _step = DeployStep.resolving;
    });
    unawaited(_restoreExistingDeployment());
  }

  AiSession? _findDeployedSession(
    List<AiSession> sessions,
    DeploymentContext context,
  ) {
    final String sessionId = context.sessionId.trim();
    if (sessionId.isEmpty) return null;
    for (final AiSession session in sessions) {
      final String deployedTo = session.deployedTo?.trim() ?? '';
      if (deployedTo.isEmpty) continue;
      if (session.id == sessionId || session.llmCodegenSessionId == sessionId) {
        return session;
      }
    }
    return null;
  }

  Future<DeploymentResult?> _findDeploymentResultFromLiveStrategy(
    DeploymentContext context,
  ) async {
    final String snapshotId = context.publishedSnapshotId.trim();
    if (snapshotId.isEmpty) return null;
    final LiveStrategyRepository repository = ref.read(
      liveStrategyRepositoryProvider,
    );
    final List<LiveStrategy> strategies = await repository.listStrategies();
    for (final LiveStrategy strategy in strategies) {
      if (strategy.status == LiveStrategyStatus.stopped) continue;
      if (_matchesPublishedSnapshot(strategy, snapshotId)) {
        return _deploymentResultFromLiveStrategy(strategy, context);
      }
      try {
        final LiveStrategy detail = await repository.getStrategy(strategy.id);
        if (detail.status == LiveStrategyStatus.stopped) continue;
        if (_matchesPublishedSnapshot(detail, snapshotId)) {
          return _deploymentResultFromLiveStrategy(detail, context);
        }
      } catch (_) {
        // A list row can disappear before detail fetch. Ignore and keep scanning.
      }
    }
    return null;
  }

  bool _matchesPublishedSnapshot(LiveStrategy strategy, String snapshotId) {
    final String strategySnapshotId =
        strategy.publishedSnapshotId?.trim() ?? '';
    if (strategySnapshotId.isNotEmpty) return strategySnapshotId == snapshotId;
    return strategy.name.trim() == snapshotId;
  }

  DeploymentResult _deploymentResultFromSession(
    AiSession session,
    DeploymentContext context,
  ) {
    final DateTime now = DateTime.now();
    return DeploymentResult(
      exchange: context.exchange ?? '',
      instanceId: session.deployedTo!,
      deployedAt: now,
      strategyId: session.deployedTo,
      symbol: context.symbol ?? session.pair,
      amount: context.amount,
      leverage: context.leverage == null ? null : '${context.leverage}x · 全仓',
      startedAt: now,
    );
  }

  DeploymentResult _deploymentResultFromLiveStrategy(
    LiveStrategy strategy,
    DeploymentContext context,
  ) {
    final DateTime now = DateTime.now();
    final double amount = strategy.capital > 0
        ? strategy.capital
        : context.amount;
    final double? leverage = strategy.deploymentLeverage;
    return DeploymentResult(
      exchange: strategy.exchange.isNotEmpty
          ? strategy.exchange
          : (context.exchange ?? ''),
      instanceId: strategy.id,
      deployedAt: strategy.deployedAt ?? now,
      strategyId: strategy.id,
      symbol: context.symbol ?? strategy.pair,
      amount: amount,
      leverage: leverage == null
          ? (context.leverage == null ? null : '${context.leverage}x · 全仓')
          : '${_formatLeverage(leverage)}x · 全仓',
      startedAt: strategy.deployedAt ?? now,
    );
  }

  String _formatLeverage(double value) {
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(2);
  }

  /// 预检查通过「确认部署」→ 部署中。
  /// 实际部署结果在分步动画跑完后由 `_onDeployingDone` 回填。
  void _confirmDeploy(_DeployTarget target) {
    if (_step != DeployStep.confirm) return;
    if (!target.authorized) return;
    setState(() {
      _deployingTarget = target;
      _deployError = null;
      _step = DeployStep.deploying;
    });
  }

  /// 部署分步动画跑完 → 调真实部署/轮询 → done；失败停留错误态。
  Future<void> _onDeployingDone() async {
    final _DeployTarget? target = _deployingTarget;
    final DeploymentContext? deploymentContext = widget.deploymentContext;
    if (!mounted || target?.apiKey == null || deploymentContext == null) return;
    try {
      final session = await ref
          .read(aiChatRepositoryProvider)
          .markDeployed(
            deploymentContext.sessionId,
            deploymentContext.publishedSnapshotId,
            strategyName: _strategyNameForDeploy(deploymentContext),
            exchangeAccountId: target!.apiKey!.id,
            exchangeAccountName: target.apiKey!.label,
            deploymentExecutionConfig: deploymentContext.toExecutionConfig(
              exchangeAccountId: target.apiKey!.id,
            ),
          );
      if (!mounted) return;
      if (session == null || session.deployedTo == null) {
        setState(() => _deployError = '部署仍在处理中');
        return;
      }
      final DateTime now = DateTime.now();
      setState(() {
        _deployError = null;
        _result = DeploymentResult(
          exchange: target.apiKey!.exchange,
          instanceId: session.deployedTo!,
          deployedAt: now,
          strategyId: session.id,
          symbol: deploymentContext.symbol ?? session.pair,
          amount: deploymentContext.amount,
          leverage: deploymentContext.leverage == null
              ? null
              : '${deploymentContext.leverage}x · 全仓',
          startedAt: now,
        );
        _step = DeployStep.success;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _deployError = e);
    }
  }

  String _strategyNameForDeploy(DeploymentContext context) {
    final String explicit = context.strategyName?.trim() ?? '';
    if (explicit.isNotEmpty) return explicit;
    final String symbol = context.symbol?.trim() ?? '';
    if (symbol.isNotEmpty) {
      final String base = symbol.split('·').first.trim();
      if (base.isNotEmpty) return '$base AI策略';
    }
    return 'AI Strategy';
  }

  /// 兼容旧入口（空列表场景），打开当前策略交易所 API 表单。
  Future<void> _goConfigureApi() async {
    final BuildContext ctx = context;
    Navigator.of(ctx).pop();
    if (!ctx.mounted) return;
    final String exchange = _exchangeNameForConfigure(
      widget.deploymentContext?.exchange,
    );
    final bool? saved = await showApiFormSheet(ctx, exchange: exchange);
    if (saved == true && ctx.mounted) {
      ref.invalidate(apiKeysProvider);
    }
  }

  String _exchangeNameForConfigure(String? exchange) {
    final String code = (exchange ?? 'binance').toLowerCase();
    return _kExchangeCatalog
        .firstWhere(
          (_ExchangeCatalogEntry entry) => entry.code == code,
          orElse: () => _kExchangeCatalog[0],
        )
        .name;
  }

  void _finish() {
    if (!widget.showHeader) {
      context.go('/ai');
      return;
    }
    Navigator.of(context).pop(_result);
  }

  void _viewLiveStrategy() {
    final DeploymentResult? result = _result;
    if (result == null) return;
    if (widget.showHeader) {
      Navigator.of(context).pop(result);
      return;
    }
    final String instanceId = result.instanceId.trim();
    context.push(instanceId.isEmpty ? '/me/live' : '/me/live/$instanceId');
  }

  _DeployTarget _targetFromKeys(List<ExchangeApiKey> keys) {
    final String wanted = (widget.deploymentContext?.exchange ?? 'binance')
        .toLowerCase();
    final _ExchangeCatalogEntry catalog = _kExchangeCatalog.firstWhere(
      (_ExchangeCatalogEntry entry) => entry.code == wanted,
      orElse: () => _kExchangeCatalog[0],
    );
    final List<ExchangeApiKey> accounts = keys
        .where((ExchangeApiKey k) => k.exchange.toLowerCase() == catalog.code)
        .toList(growable: false);
    final ExchangeApiKey? selected = accounts.isEmpty
        ? null
        : accounts.firstWhere(
            (ExchangeApiKey k) => k.id == _selectedAccountId,
            orElse: () => accounts.first,
          );
    return _DeployTarget(
      catalog: catalog,
      accounts: accounts,
      apiKey: selected,
    );
  }

  void _selectAccount(String accountId) {
    setState(() => _selectedAccountId = accountId);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String title = switch (_step) {
      DeployStep.resolving => '检查部署状态',
      DeployStep.confirm => l10n.deploySheetTitlePreflight,
      DeployStep.deploying => l10n.deploySheetTitleDeploying,
      DeployStep.success => l10n.deploySheetTitleDone,
    };
    if (widget.deploymentContext == null) {
      return _DeployContextError(showHeader: widget.showHeader);
    }

    if (_step == DeployStep.resolving) {
      return _DeploySheetFrame(
        showHeader: widget.showHeader,
        title: title,
        step: _step,
        scheme: c,
        l10n: l10n,
        child: _ResolvingPane(
          error: _resolveError,
          onRetry: _retryResolveDeployment,
          onBack: widget.showHeader
              ? () => Navigator.of(context).maybePop()
              : () => context.go('/ai'),
        ),
      );
    }

    final AsyncValue<List<ExchangeApiKey>> keys = ref.watch(apiKeysProvider);
    return keys.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: QzSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (Object e, _) => Padding(
        padding: const EdgeInsets.all(QzSpacing.lg),
        child: Text(
          '${l10n.commonLoadError}: $e',
          style: TextStyle(color: c.textDim, fontSize: 13),
        ),
      ),
      data: (List<ExchangeApiKey> list) {
        final _DeployTarget target = _targetFromKeys(list);
        final Widget body = _buildBody(c, l10n, target);
        return _DeploySheetFrame(
          showHeader: widget.showHeader,
          title: title,
          step: _step,
          scheme: c,
          l10n: l10n,
          child: body,
        );
      },
    );
  }

  Widget _buildBody(
    QzColorScheme c,
    AppLocalizations l10n,
    _DeployTarget target,
  ) {
    switch (_step) {
      case DeployStep.confirm:
        return _PreflightPane(
          target: target,
          deploymentContext: widget.deploymentContext!,
          amount: _amount,
          onAccountChanged: _selectAccount,
          onGoConfigure: _goConfigureApi,
          onBack: widget.showHeader
              ? () => Navigator.of(context).maybePop()
              : () => context.go('/ai'),
          onConfirm: () => _confirmDeploy(target),
          stickyActions: !widget.showHeader,
        );
      case DeployStep.deploying:
        final _DeployTarget active = _deployingTarget ?? target;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _DeployingPane(
              scheme: c,
              exchangeName: active.catalog.name,
              onDone: _onDeployingDone,
            ),
            if (_deployError != null) ...<Widget>[
              const SizedBox(height: QzSpacing.md),
              Text(
                '${l10n.commonLoadError}: $_deployError',
                style: TextStyle(color: c.statusDanger, fontSize: 13),
              ),
            ],
          ],
        );
      case DeployStep.success:
        return _DonePane(
          result: _result!,
          onFinish: _finish,
          onViewLive: _viewLiveStrategy,
          stickyActions: !widget.showHeader,
        );
      case DeployStep.resolving:
        return _ResolvingPane(
          error: _resolveError,
          onRetry: _retryResolveDeployment,
          onBack: widget.showHeader
              ? () => Navigator.of(context).maybePop()
              : () => context.go('/ai'),
        );
    }
  }
}

class _DeploySheetFrame extends StatelessWidget {
  const _DeploySheetFrame({
    required this.showHeader,
    required this.title,
    required this.step,
    required this.scheme,
    required this.l10n,
    required this.child,
  });

  final bool showHeader;
  final String title;
  final DeployStep step;
  final QzColorScheme scheme;
  final AppLocalizations l10n;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        showHeader ? QzSpacing.lg : 0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: showHeader ? MainAxisSize.min : MainAxisSize.max,
        children: <Widget>[
          if (showHeader) ...<Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      color: scheme.text,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                _StepIndicator(step: step, scheme: scheme, l10n: l10n),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
          ],
          if (showHeader)
            Flexible(
              fit: FlexFit.loose,
              child: SingleChildScrollView(child: child),
            )
          else
            Expanded(child: child),
        ],
      ),
    );
  }
}

class _ResolvingPane extends StatelessWidget {
  const _ResolvingPane({
    required this.error,
    required this.onRetry,
    required this.onBack,
  });

  final Object? error;
  final VoidCallback onRetry;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool failed = error != null;
    return Padding(
      key: const Key('deploy-resolving'),
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Center(
            child: failed
                ? Icon(Icons.error_outline, size: 44, color: c.statusDanger)
                : CircularProgressIndicator(color: c.accent),
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            failed ? '部署状态检查失败' : '正在检查部署状态',
            key: const Key('deploy-resolving-title'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.text,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            failed ? '无法确认当前策略是否已部署，请重试后再继续。' : '正在确认是否已有实盘实例，避免重复提交。',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.textDim, fontSize: 13, height: 1.5),
          ),
          if (failed) ...<Widget>[
            const SizedBox(height: QzSpacing.md),
            Text(
              '$error',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.statusDanger, fontSize: 12),
            ),
            const SizedBox(height: QzSpacing.lg),
            Row(
              children: <Widget>[
                Expanded(
                  child: QzButton(
                    key: const Key('deploy-resolve-back'),
                    label: '返回对话',
                    variant: QzButtonVariant.ghost,
                    onPressed: onBack,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: QzButton(
                    key: const Key('deploy-resolve-retry'),
                    label: '重试',
                    variant: QzButtonVariant.accent,
                    onPressed: onRetry,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _DeployContextError extends StatelessWidget {
  const _DeployContextError({required this.showHeader});

  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('deploy-context-error'),
      padding: EdgeInsets.fromLTRB(
        QzSpacing.lg,
        showHeader ? 0 : QzSpacing.lg,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '缺少部署上下文',
            style: TextStyle(
              color: c.text,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          Text(
            '请从 AI 会话或回测结果入口重新发起部署。',
            style: TextStyle(color: c.textDim, fontSize: 13, height: 1.5),
          ),
        ],
      ),
    );
  }
}

/// sheet 顶部轻量步骤指示：confirm/deploying/success = 1..3。
class _StepIndicator extends StatelessWidget {
  const _StepIndicator({
    required this.step,
    required this.scheme,
    required this.l10n,
  });

  final DeployStep step;
  final QzColorScheme scheme;
  final AppLocalizations l10n;

  static const int _total = 3;

  @override
  Widget build(BuildContext context) {
    final int current = switch (step) {
      DeployStep.resolving => 1,
      DeployStep.confirm => 1,
      DeployStep.deploying => 2,
      DeployStep.success => 3,
    };
    return Container(
      key: const Key('deploy-step-indicator'),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: scheme.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Text(
        l10n.deployStepIndicator(current, _total),
        style: TextStyle(
          color: scheme.accent,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _RiskBanner extends StatelessWidget {
  const _RiskBanner({required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('deploy-risk-banner'),
      padding: const EdgeInsets.all(QzSpacing.sm),
      decoration: BoxDecoration(
        color: scheme.marketUp.withValues(alpha: 0.10),
        border: Border.all(color: scheme.marketUp.withValues(alpha: 0.30)),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 14, color: scheme.marketUp),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: scheme.marketUp,
                fontSize: 12,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyFooter extends StatelessWidget {
  const _SafetyFooter({required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(Icons.lock_outline, size: 12, color: scheme.textDim),
        const SizedBox(width: QzSpacing.xs),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: scheme.textDim, fontSize: 11, height: 1.5),
          ),
        ),
      ],
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.text, required this.scheme});
  final String text;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: scheme.border.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Text(text, style: TextStyle(color: scheme.textDim, fontSize: 10)),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.title, required this.sub});
  final int n;
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.accent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Text(
              '$n',
              style: TextStyle(
                color: c.accent,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    height: 1.45,
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

/// 部署中分步任务列表（#1772 DpDeploying）。
///
/// 圆形进度 + 5 步任务，逐步用一次性 `Future.delayed` 推进 `_idx`；跑到末尾
/// 调 `onDone`。刻意用「跑到尽头即停」的有限链式延时（非无限循环动画），
/// 让 widget test 可用显式 `pump(Duration)` 步进、避免 `pumpAndSettle` 挂在
/// 周期动画上（与历史 `_deployDuration` 计时模式一致）。

/// 启动时间格式化（本地时区 `yyyy-MM-dd HH:mm`，不引第三方依赖）。
String _formatStartedAt(DateTime t) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}';
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    required this.scheme,
    this.valueColor,
  });

  final String label;
  final String value;
  final QzColorScheme scheme;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: scheme.textDim, fontSize: 12),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? scheme.text,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// 只读账单确认的风险 summary 单格（净值 / Sharpe / 最大回撤）（#1896）。
class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.label,
    required this.value,
    required this.scheme,
    this.valueColor,
  });

  final String label;
  final String value;
  final QzColorScheme scheme;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? scheme.text,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: scheme.textDim, fontSize: 11)),
        ],
      ),
    );
  }
}

/// 资金配置（#1772 DpAllocate）。
///
/// 投入金额 + 25/50/75/MAX 快捷比例（基于固定 mock 可用额度 10000 USDT）+
/// 单笔仓位上限 / 日内最大亏损滑块 + 分渠道通知开关。全部前端 mock 输入。
/// （#1796：stepper → Slider，单一通知 Switch → 3 个分渠道开关，对齐设计稿。）

/// 部署前预检查（#1772 PreflightChecks）。
///
/// 策略 recap + 3 项检查（API/余额/网络）逐项扫描。原型默认全通过；
/// `_PreflightPaneState` 用一次性链式延时驱动逐项揭示，扫完即停（非循环），
/// 测试可显式 `pump(Duration)` 步进。失败态保留「重新检测」交互入口；
/// 当前 mock 三项均通过，全部通过才允许「确认部署」。

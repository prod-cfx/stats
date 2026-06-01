import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/api_key_models.dart';
import '../data/models/deploy_models.dart';
import '../data/providers.dart';
import '../l10n/app_localizations.dart';
import '../pages/me/api_form_sheet.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_button.dart';
import 'qz_sheet.dart';

/// 「一键部署」底部弹层。
///
/// 单 widget 内承载 6 步状态机
/// （`pickExchange → authorize → allocate → preflight → deploying → done`，
/// #1772 在 #1653 的 4 步上补齐资金配置 / 预检查）。
/// 拆成多个 Widget 反而要把 step 状态外挂或层层 callback，按 KISS 内聚在一处。
///
/// 真后端尚未接入：交易所列表读 `apiKeysProvider`；部署进度用一次性链式
/// `Timer` 模拟分步推进；成功后生成本地实例 ID 并 `Navigator.pop`
/// 把 `DeploymentResult` 返回给调用方（`AiHomePage` 据此在对话流追加系统消息 +
/// 弹出 toast）。
///
/// issue #1653：补齐设计稿引导流程。
/// - 选择交易所步：风控 banner + 内置交易所目录（已配置 / 未授权 / 链上 tag）
///   + 底部安全提示。
/// - 选择「未授权」交易所：authorize 步显示 3 步授权引导 + 提币权限警告 +
///   合规 checkbox，确认后直接打开 API 配置表单（取代跳 `/me/api` 列表）。
/// - 选择「已配置」交易所：authorize 步保持原权限授权 → 「同意并部署」。
class QzDeploySheet extends ConsumerStatefulWidget {
  const QzDeploySheet({super.key});

  /// 调起入口；返回的 `DeploymentResult` 表示部署成功，null 表示用户取消 /
  /// 关闭。
  static Future<DeploymentResult?> show(BuildContext context) {
    return QzSheet.show<DeploymentResult>(
      context: context,
      builder: (BuildContext ctx) => const QzDeploySheet(),
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
    required this.apiKey,
  });

  final _ExchangeCatalogEntry catalog;
  final ExchangeApiKey? apiKey; // 非空即已配置
  bool get authorized => apiKey != null;
}

class _QzDeploySheetState extends ConsumerState<QzDeploySheet> {
  /// 资金配置默认值（mock）。
  static const double _defaultAmount = 5000;
  static const int _defaultPerTradePct = 20;
  static const int _defaultMaxDailyLossPct = 10;

  DeployStep _step = DeployStep.pickExchange;
  _DeployTarget? _selected;
  DeploymentResult? _result;
  bool _consent = false;

  // #1772 资金配置状态。
  double _amount = _defaultAmount;
  int _perTradePct = _defaultPerTradePct;
  int _maxDailyLossPct = _defaultMaxDailyLossPct;
  // 分渠道通知开关（#1796，对齐设计稿 3 个开关）。
  bool _notifyOpen = true;
  bool _notifyClose = true;
  bool _notifyStopLoss = true;

  /// 选中交易所 → 授权步；授权/未授权变体由 `_buildBody` 按 `authorized` 分流。
  void _pickTarget(_DeployTarget t) {
    setState(() {
      _selected = t;
      _consent = false;
      _step = DeployStep.authorize;
    });
  }

  /// authorize「同意并部署」→ 进入资金配置（#1772）。
  void _confirmAuthorize() {
    if (_selected?.apiKey == null) return;
    setState(() => _step = DeployStep.allocate);
  }

  /// 资金配置「下一步」→ 部署前预检查（#1772）。
  void _goPreflight() => setState(() => _step = DeployStep.preflight);

  void _backToAllocate() => setState(() => _step = DeployStep.allocate);

  /// 预检查通过「确认部署」→ 部署中（#1772）。
  /// 实际部署结果在分步动画跑完后由 `_onDeployingDone` 回填。
  void _confirmDeploy() => setState(() => _step = DeployStep.deploying);

  /// 部署分步动画跑完 → 用资金配置快照回填 `DeploymentResult` → done。
  void _onDeployingDone() {
    if (!mounted || _selected?.apiKey == null) return;
    final DateTime now = DateTime.now();
    final DeploymentResult result = DeploymentResult(
      exchange: _selected!.apiKey!.exchange,
      instanceId: 'inst-${now.microsecondsSinceEpoch}',
      deployedAt: now,
      strategyId:
          'QF-${now.millisecondsSinceEpoch.toRadixString(36).toUpperCase().substring(0, 6)}',
      symbol: 'BTC/USDT · 15m',
      amount: _amount,
      leverage: '5x · 全仓',
      startedAt: now,
    );
    setState(() {
      _result = result;
      _step = DeployStep.done;
    });
  }

  /// 未授权流程：勾选 consent 后打开 API 表单 bottom sheet。
  /// 先 pop 当前 deploy sheet 避免栈错位 + barrier 叠加；
  /// `Navigator.pop(null)` 表示用户中断本次部署。
  Future<void> _openApiForm() async {
    if (!_consent || _selected == null) return;
    final BuildContext ctx = context;
    final String exchangeName = _selected!.catalog.name;
    Navigator.of(ctx).pop();
    if (!ctx.mounted) return;
    final bool? saved = await showApiFormSheet(ctx, exchange: exchangeName);
    if (saved == true && ctx.mounted) {
      ref.invalidate(apiKeysProvider);
    }
  }

  /// 兼容旧入口（空列表场景），等价于打开 Binance API 表单。
  Future<void> _goConfigureApi() async {
    final BuildContext ctx = context;
    Navigator.of(ctx).pop();
    if (!ctx.mounted) return;
    final bool? saved = await showApiFormSheet(ctx, exchange: 'Binance');
    if (saved == true && ctx.mounted) {
      ref.invalidate(apiKeysProvider);
    }
  }

  void _backToPick() {
    setState(() {
      _selected = null;
      _consent = false;
      _step = DeployStep.pickExchange;
    });
  }

  void _finish() {
    Navigator.of(context).pop(_result);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String title = switch (_step) {
      DeployStep.pickExchange => l10n.deploySheetTitleExchange,
      DeployStep.authorize => l10n.deploySheetTitleAuthorize,
      DeployStep.allocate => l10n.deploySheetTitleAllocate,
      DeployStep.preflight => l10n.deploySheetTitlePreflight,
      DeployStep.deploying => l10n.deploySheetTitleDeploying,
      DeployStep.done => l10n.deploySheetTitleDone,
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _StepIndicator(step: _step, scheme: c, l10n: l10n),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          _buildBody(c, l10n),
        ],
      ),
    );
  }

  Widget _buildBody(QzColorScheme c, AppLocalizations l10n) {
    switch (_step) {
      case DeployStep.pickExchange:
        return _ExchangePicker(
          onPick: _pickTarget,
          onGoConfigure: _goConfigureApi,
        );
      case DeployStep.authorize:
        final _DeployTarget t = _selected!;
        if (t.authorized) {
          return _AuthorizePane(
            apiKey: t.apiKey!,
            onConfirm: _confirmAuthorize,
          );
        }
        return _UnauthorizedPane(
          target: t,
          consent: _consent,
          onConsentChanged: (bool v) => setState(() => _consent = v),
          onCancel: _backToPick,
          onOpenApiForm: _openApiForm,
        );
      case DeployStep.allocate:
        return _AllocatePane(
          target: _selected!,
          amount: _amount,
          perTradePct: _perTradePct,
          maxDailyLossPct: _maxDailyLossPct,
          notifyOpen: _notifyOpen,
          notifyClose: _notifyClose,
          notifyStopLoss: _notifyStopLoss,
          onAmountChanged: (double v) => setState(() => _amount = v),
          onPerTradeChanged: (int v) => setState(() => _perTradePct = v),
          onMaxDailyLossChanged: (int v) =>
              setState(() => _maxDailyLossPct = v),
          onNotifyOpenChanged: (bool v) => setState(() => _notifyOpen = v),
          onNotifyCloseChanged: (bool v) => setState(() => _notifyClose = v),
          onNotifyStopLossChanged: (bool v) =>
              setState(() => _notifyStopLoss = v),
          onNext: _goPreflight,
        );
      case DeployStep.preflight:
        return _PreflightPane(
          target: _selected!,
          amount: _amount,
          onBack: _backToAllocate,
          onConfirm: _confirmDeploy,
        );
      case DeployStep.deploying:
        return _DeployingPane(
          scheme: c,
          exchangeName: _selected!.catalog.name,
          onDone: _onDeployingDone,
        );
      case DeployStep.done:
        return _DonePane(
          result: _result!,
          onFinish: _finish,
        );
    }
  }
}

/// sheet 顶部轻量步骤指示（替代设计稿整页 5 步 StepBar，KISS）。
/// pickExchange 不计步；authorize/allocate/preflight/deploying/done = 1..5。
class _StepIndicator extends StatelessWidget {
  const _StepIndicator({
    required this.step,
    required this.scheme,
    required this.l10n,
  });

  final DeployStep step;
  final QzColorScheme scheme;
  final AppLocalizations l10n;

  static const int _total = 5;

  @override
  Widget build(BuildContext context) {
    final int current = switch (step) {
      DeployStep.pickExchange => 0,
      DeployStep.authorize => 1,
      DeployStep.allocate => 2,
      DeployStep.preflight => 3,
      DeployStep.deploying => 4,
      DeployStep.done => 5,
    };
    if (current == 0) return const SizedBox.shrink();
    return Container(
      key: const Key('deploy-step-indicator'),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm, vertical: 2),
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

class _ExchangePicker extends ConsumerWidget {
  const _ExchangePicker({
    required this.onPick,
    required this.onGoConfigure,
  });

  final void Function(_DeployTarget) onPick;
  final VoidCallback onGoConfigure;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ExchangeApiKey>> keys =
        ref.watch(apiKeysProvider);
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return keys.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: QzSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (Object e, _) => Text(
        '${l10n.commonLoadError}: $e',
        style: TextStyle(color: c.textDim, fontSize: 13),
      ),
      data: (List<ExchangeApiKey> list) {
        // 合并目录与用户密钥；目录里命中 ExchangeApiKey 的项标 authorized。
        final List<_DeployTarget> targets = _kExchangeCatalog
            .map<_DeployTarget>(
              (_ExchangeCatalogEntry e) => _DeployTarget(
                catalog: e,
                apiKey: list.cast<ExchangeApiKey?>().firstWhere(
                      (ExchangeApiKey? k) =>
                          k?.exchange.toLowerCase() == e.code,
                      orElse: () => null,
                    ),
              ),
            )
            .toList(growable: false);
        // 兜底：所有都未授权 + 用户从未配过任何 key → 引导按钮。
        final bool anyConfigured = targets.any((_DeployTarget t) => t.authorized);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _RiskBanner(scheme: c, text: l10n.deployRiskBannerOk),
            const SizedBox(height: QzSpacing.md),
            for (final _DeployTarget t in targets)
              Padding(
                padding: const EdgeInsets.only(bottom: QzSpacing.sm),
                child: _ExchangeRow(
                  target: t,
                  onTap: () => onPick(t),
                ),
              ),
            const SizedBox(height: QzSpacing.sm),
            _SafetyFooter(scheme: c, text: l10n.deployFooterSafety),
            if (!anyConfigured) ...<Widget>[
              const SizedBox(height: QzSpacing.md),
              QzButton(
                key: const Key('deploy-go-configure'),
                label: l10n.deployGoConfigureButton,
                variant: QzButtonVariant.accent,
                onPressed: onGoConfigure,
              ),
            ],
          ],
        );
      },
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
            style: TextStyle(
              color: scheme.textDim,
              fontSize: 11,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }
}

class _ExchangeRow extends StatelessWidget {
  const _ExchangeRow({required this.target, required this.onTap});

  final _DeployTarget target;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool authorized = target.authorized;
    final String? tagText = switch (target.catalog.tag) {
      _ExchangeTag.recommended => l10n.deployExchangeTagRecommended,
      _ExchangeTag.onchain => l10n.deployExchangeTagOnchain,
      _ExchangeTag.none => null,
    };
    return InkWell(
      key: Key('deploy-exchange-${target.catalog.code}'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(QzRadii.card),
      child: Container(
        padding: const EdgeInsets.all(QzSpacing.md),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.card),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Text(
                        target.catalog.name.toUpperCase(),
                        style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (tagText != null) ...<Widget>[
                        const SizedBox(width: QzSpacing.xs),
                        _MiniTag(text: tagText, scheme: c),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    authorized
                        ? target.apiKey!.label
                        : l10n.deployUnauthorizedIdentityWarning,
                    style: TextStyle(
                      color: authorized ? c.textDim : c.marketDown,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: authorized
                    ? c.marketUp.withValues(alpha: 0.15)
                    : c.border.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Text(
                authorized
                    ? l10n.deployExchangeConfigured
                    : l10n.deployExchangeNotConfigured,
                style: TextStyle(
                  color: authorized ? c.marketUp : c.textDim,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
      ),
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
      child: Text(
        text,
        style: TextStyle(color: scheme.textDim, fontSize: 10),
      ),
    );
  }
}

class _AuthorizePane extends StatelessWidget {
  const _AuthorizePane({
    required this.apiKey,
    required this.onConfirm,
  });

  final ExchangeApiKey apiKey;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          '${apiKey.exchange.toUpperCase()} · ${apiKey.label}',
          style: TextStyle(color: c.text, fontSize: 14),
        ),
        const SizedBox(height: QzSpacing.md),
        Text(
          l10n.deployAuthorizePermissionTitle,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: QzSpacing.sm),
        for (final String perm in <String>[
          l10n.deployAuthorizePermissionSpot,
          l10n.deployAuthorizePermissionFutures,
          l10n.deployAuthorizePermissionBalance,
        ])
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: <Widget>[
                Icon(Icons.check_circle_outline, size: 14, color: c.marketUp),
                const SizedBox(width: QzSpacing.xs),
                Text(perm, style: TextStyle(color: c.text, fontSize: 13)),
              ],
            ),
          ),
        const SizedBox(height: QzSpacing.lg),
        QzButton(
          key: const Key('deploy-confirm'),
          label: l10n.deployAuthorizeConfirmButton,
          variant: QzButtonVariant.accent,
          onPressed: onConfirm,
        ),
      ],
    );
  }
}

/// 未授权交易所的 3 步引导 + 提币警告 + 合规 checkbox。
class _UnauthorizedPane extends StatelessWidget {
  const _UnauthorizedPane({
    required this.target,
    required this.consent,
    required this.onConsentChanged,
    required this.onCancel,
    required this.onOpenApiForm,
  });

  final _DeployTarget target;
  final bool consent;
  final ValueChanged<bool> onConsentChanged;
  final VoidCallback onCancel;
  final VoidCallback onOpenApiForm;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // identity 卡片
        Container(
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.border.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  target.catalog.name.isEmpty
                      ? '?'
                      : target.catalog.name.substring(0, 1),
                  style: TextStyle(
                    color: c.text,
                    fontSize: 16,
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
                      target.catalog.name,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.deployUnauthorizedIdentityWarning,
                      style: TextStyle(color: c.marketDown, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Text(
          l10n.deployUnauthorizedTitle,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        _Step(
          n: 1,
          title: l10n.deployUnauthorizedStep1Title,
          sub: l10n.deployUnauthorizedStep1Sub,
        ),
        _Step(
          n: 2,
          title: l10n.deployUnauthorizedStep2Title,
          sub: l10n.deployUnauthorizedStep2Sub,
        ),
        _Step(
          n: 3,
          title: l10n.deployUnauthorizedStep3Title,
          sub: l10n.deployUnauthorizedStep3Sub,
        ),
        const SizedBox(height: QzSpacing.md),
        // 提币权限警告
        Container(
          key: const Key('deploy-withdraw-warning'),
          padding: const EdgeInsets.all(QzSpacing.sm),
          decoration: BoxDecoration(
            color: c.marketDown.withValues(alpha: 0.10),
            border: Border.all(color: c.marketDown.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.warning_amber_outlined,
                  size: 16, color: c.marketDown),
              const SizedBox(width: QzSpacing.xs),
              Expanded(
                child: Text(
                  l10n.deployUnauthorizedWithdrawWarning,
                  style: TextStyle(
                    color: c.marketDown,
                    fontSize: 12,
                    height: 1.55,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        // consent checkbox
        InkWell(
          key: const Key('deploy-consent'),
          onTap: () => onConsentChanged(!consent),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: QzSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    color: consent ? c.accent : Colors.transparent,
                    border: Border.all(
                      color: consent ? c.accent : c.border,
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: consent
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: Text(
                    l10n.deployUnauthorizedConsent,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Row(
          children: <Widget>[
            QzButton(
              key: const Key('deploy-unauth-cancel'),
              label: l10n.deployUnauthorizedCancelButton,
              variant: QzButtonVariant.ghost,
              onPressed: onCancel,
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: QzButton(
                key: const Key('deploy-open-api-form'),
                label: l10n.deployUnauthorizedOpenFormButton,
                variant: QzButtonVariant.accent,
                onPressed: consent ? onOpenApiForm : null,
              ),
            ),
          ],
        ),
      ],
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
class _DeployingPane extends StatefulWidget {
  const _DeployingPane({
    required this.scheme,
    required this.exchangeName,
    required this.onDone,
  });

  final QzColorScheme scheme;
  final String exchangeName;
  final VoidCallback onDone;

  static const int _stepCount = 5;

  static List<DeployingStep> _steps(AppLocalizations l10n) => <DeployingStep>[
        DeployingStep(
          label: l10n.deployingStepAuthTitle,
          sub: l10n.deployingStepAuthSub,
        ),
        DeployingStep(
          label: l10n.deployingStepPushTitle,
          sub: l10n.deployingStepPushSub,
        ),
        DeployingStep(
          label: l10n.deployingStepNodeTitle,
          sub: l10n.deployingStepNodeSub,
        ),
        DeployingStep(
          label: l10n.deployingStepFeedTitle,
          sub: l10n.deployingStepFeedSub,
        ),
        DeployingStep(
          label: l10n.deployingStepReadyTitle,
          sub: l10n.deployingStepReadySub,
        ),
      ];

  @override
  State<_DeployingPane> createState() => _DeployingPaneState();
}

class _DeployingPaneState extends State<_DeployingPane> {
  /// 每步推进间隔。5 步 × 0.36s ≈ 1.8s，对齐历史部署可视化时长。
  static const Duration _stepInterval = Duration(milliseconds: 360);

  int _idx = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleNext();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _scheduleNext() {
    _timer = Timer(_stepInterval, () {
      if (!mounted) return;
      final int next = _idx + 1;
      if (next > _DeployingPane._stepCount) {
        widget.onDone();
        return;
      }
      setState(() => _idx = next);
      _scheduleNext();
    });
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = widget.scheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<DeployingStep> steps = _DeployingPane._steps(l10n);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
          child: Center(
            child: CircularProgressIndicator(
              key: const Key('deploy-progress'),
              color: c.accent,
            ),
          ),
        ),
        Text(
          l10n.deployingTitle(widget.exchangeName),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: c.text,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          l10n.deployingCaption,
          textAlign: TextAlign.center,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: QzSpacing.md),
        for (int i = 0; i < steps.length; i++)
          _DeployingStepRow(
            index: i,
            step: steps[i],
            done: i < _idx,
            active: i == _idx,
            scheme: c,
          ),
      ],
    );
  }
}

class _DeployingStepRow extends StatelessWidget {
  const _DeployingStepRow({
    required this.index,
    required this.step,
    required this.done,
    required this.active,
    required this.scheme,
  });

  final int index;
  final DeployingStep step;
  final bool done;
  final bool active;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Opacity(
      opacity: !done && !active ? 0.5 : 1,
      child: Padding(
        key: Key('deploy-step-$index'),
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: done
                    ? c.marketUp
                    : (active ? c.accent.withValues(alpha: 0.15) : c.bgSoft),
                borderRadius: BorderRadius.circular(11),
              ),
              child: done
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : (active
                      ? SizedBox(
                          width: 11,
                          height: 11,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: c.accent,
                          ),
                        )
                      : null),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    step.label,
                    style: TextStyle(
                      color: active ? c.text : c.textDim,
                      fontSize: 13,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    step.sub,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            if (done)
              Text(
                'OK',
                style: TextStyle(
                  color: c.marketUp,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 启动时间格式化（本地时区 `yyyy-MM-dd HH:mm`，不引第三方依赖）。
String _formatStartedAt(DateTime t) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}';
}

class _DonePane extends StatelessWidget {
  const _DonePane({required this.result, required this.onFinish});

  final DeploymentResult result;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<List<String>> rows = <List<String>>[
      <String>[
        l10n.deployDoneDetailStrategyId,
        result.strategyId ?? result.instanceId,
      ],
      <String>[l10n.deployDoneDetailExchange, result.exchange.toUpperCase()],
      if (result.symbol != null)
        <String>[l10n.deployDoneDetailSymbol, result.symbol!],
      if (result.amount != null)
        <String>[
          l10n.deployDoneDetailAmount,
          '${result.amount!.toStringAsFixed(0)} USDT',
        ],
      if (result.leverage != null)
        <String>[l10n.deployDoneDetailLeverage, result.leverage!],
      if (result.startedAt != null)
        <String>[
          l10n.deployDoneDetailStartedAt,
          _formatStartedAt(result.startedAt!),
        ],
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // hero
        Center(
          child: Column(
            children: <Widget>[
              Icon(Icons.check_circle, size: 48, color: c.marketUp),
              const SizedBox(height: QzSpacing.sm),
              Text(
                l10n.deployDoneTitle,
                style: TextStyle(
                  color: c.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                l10n.deployDoneSubtitle(result.exchange.toUpperCase()),
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textDim, fontSize: 12, height: 1.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        // detail card
        Container(
          key: const Key('deploy-done-detail'),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.md,
            vertical: QzSpacing.sm,
          ),
          child: Column(
            children: <Widget>[
              for (final List<String> r in rows)
                _DetailRow(label: r[0], value: r[1], scheme: c),
              _DetailRow(
                label: l10n.deployDoneDetailStatus,
                value: l10n.deployDoneStatusRunning,
                scheme: c,
                valueColor: c.marketUp,
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        // next steps
        Text(
          l10n.deployDoneNextStepsLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        _NextStepRow(
          stepKey: const Key('deploy-next-live'),
          icon: Icons.show_chart,
          title: l10n.deployDoneNextLiveTitle,
          sub: l10n.deployDoneNextLiveSub,
          scheme: c,
          // pop 返回 result：调用方据此跳 /me/live（#1752 联动）。
          onTap: onFinish,
        ),
        _NextStepRow(
          stepKey: const Key('deploy-next-notify'),
          icon: Icons.notifications_none,
          title: l10n.deployDoneNextNotifyTitle,
          sub: l10n.deployDoneNextNotifySub,
          scheme: c,
          onTap: onFinish,
        ),
        _NextStepRow(
          stepKey: const Key('deploy-next-tune'),
          icon: Icons.auto_awesome,
          title: l10n.deployDoneNextTuneTitle,
          sub: l10n.deployDoneNextTuneSub,
          scheme: c,
          onTap: onFinish,
        ),
        const SizedBox(height: QzSpacing.md),
        QzButton(
          key: const Key('deploy-finish'),
          label: l10n.deployDoneCloseButton,
          variant: QzButtonVariant.primary,
          onPressed: onFinish,
        ),
      ],
    );
  }
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
      padding: const EdgeInsets.symmetric(vertical: 6),
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
          Text(
            label,
            style: TextStyle(color: scheme.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _NextStepRow extends StatelessWidget {
  const _NextStepRow({
    required this.stepKey,
    required this.icon,
    required this.title,
    required this.sub,
    required this.scheme,
    required this.onTap,
  });

  final Key stepKey;
  final IconData icon;
  final String title;
  final String sub;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.sm),
      child: InkWell(
        key: stepKey,
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.card),
        child: Container(
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: c.accent),
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
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sub,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 16, color: c.textDim),
            ],
          ),
        ),
      ),
    );
  }
}

/// 资金配置（#1772 DpAllocate）。
///
/// 投入金额 + 25/50/75/MAX 快捷比例（基于固定 mock 可用额度 10000 USDT）+
/// 单笔仓位上限 / 日内最大亏损滑块 + 分渠道通知开关。全部前端 mock 输入。
/// （#1796：stepper → Slider，单一通知 Switch → 3 个分渠道开关，对齐设计稿。）
class _AllocatePane extends StatelessWidget {
  const _AllocatePane({
    required this.target,
    required this.amount,
    required this.perTradePct,
    required this.maxDailyLossPct,
    required this.notifyOpen,
    required this.notifyClose,
    required this.notifyStopLoss,
    required this.onAmountChanged,
    required this.onPerTradeChanged,
    required this.onMaxDailyLossChanged,
    required this.onNotifyOpenChanged,
    required this.onNotifyCloseChanged,
    required this.onNotifyStopLossChanged,
    required this.onNext,
  });

  /// mock 可用额度，快捷比例据此换算。
  static const double _available = 10000;

  final _DeployTarget target;
  final double amount;
  final int perTradePct;
  final int maxDailyLossPct;
  final bool notifyOpen;
  final bool notifyClose;
  final bool notifyStopLoss;
  final ValueChanged<double> onAmountChanged;
  final ValueChanged<int> onPerTradeChanged;
  final ValueChanged<int> onMaxDailyLossChanged;
  final ValueChanged<bool> onNotifyOpenChanged;
  final ValueChanged<bool> onNotifyCloseChanged;
  final ValueChanged<bool> onNotifyStopLossChanged;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // 投入金额
        Text(
          l10n.deployAllocateAmountLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Container(
          key: const Key('deploy-allocate-amount'),
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '\$${amount.toStringAsFixed(0)} USDT',
                style: TextStyle(
                  color: c.text,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: QzSpacing.sm),
              Row(
                children: <Widget>[
                  for (final int pct in <int>[25, 50, 75, 100])
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: InkWell(
                          key: Key('deploy-allocate-pct-$pct'),
                          onTap: () =>
                              onAmountChanged(_available * pct / 100),
                          borderRadius: BorderRadius.circular(QzRadii.card),
                          child: Container(
                            height: 30,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: c.border.withValues(alpha: 0.3),
                              borderRadius:
                                  BorderRadius.circular(QzRadii.card),
                            ),
                            child: Text(
                              pct == 100 ? 'MAX' : '$pct%',
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.deployAllocateAmountHint,
          style: TextStyle(color: c.textDim, fontSize: 11),
        ),
        const SizedBox(height: QzSpacing.md),
        // 单笔仓位上限（滑块）
        _AllocateSliderRow(
          fieldKey: const Key('deploy-allocate-per-trade'),
          label: l10n.deployAllocatePerTradeLabel,
          caption: l10n.deployAllocatePerTradeCaption,
          value: perTradePct,
          min: 10,
          max: 100,
          step: 5,
          ticks: const <String>['10%', '50%', '100%'],
          valueLabel: '$perTradePct%',
          valueColor: c.accent,
          onChanged: onPerTradeChanged,
          scheme: c,
        ),
        const SizedBox(height: QzSpacing.sm),
        // 日内最大亏损（滑块，danger 色）
        _AllocateSliderRow(
          fieldKey: const Key('deploy-allocate-max-loss'),
          label: l10n.deployAllocateMaxDailyLossLabel,
          caption: l10n.deployAllocateMaxDailyLossCaption,
          value: maxDailyLossPct,
          min: 1,
          max: 15,
          step: 1,
          ticks: const <String>['-1%', '-8%', '-15%'],
          valueLabel: '-$maxDailyLossPct%',
          valueColor: c.statusDanger,
          onChanged: onMaxDailyLossChanged,
          scheme: c,
        ),
        const SizedBox(height: QzSpacing.sm),
        // 通知（分渠道开关）
        Text(
          l10n.deployAllocateNotifySectionLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Container(
          key: const Key('deploy-allocate-notify'),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: <Widget>[
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-open'),
                label: l10n.deployAllocateNotifyOpenLabel,
                caption: l10n.deployAllocateNotifyOpenCaption,
                value: notifyOpen,
                onChanged: onNotifyOpenChanged,
                showDivider: false,
                scheme: c,
              ),
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-close'),
                label: l10n.deployAllocateNotifyCloseLabel,
                caption: l10n.deployAllocateNotifyCloseCaption,
                value: notifyClose,
                onChanged: onNotifyCloseChanged,
                showDivider: true,
                scheme: c,
              ),
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-stop-loss'),
                label: l10n.deployAllocateNotifyStopLossLabel,
                caption: l10n.deployAllocateNotifyStopLossCaption,
                value: notifyStopLoss,
                onChanged: onNotifyStopLossChanged,
                showDivider: true,
                scheme: c,
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.lg),
        QzButton(
          key: const Key('deploy-allocate-next'),
          label: l10n.deployAllocateNextButton,
          variant: QzButtonVariant.accent,
          onPressed: onNext,
        ),
      ],
    );
  }
}

/// 资金配置内的「label + 值 + 滑块 + 刻度」行（#1796，对齐设计稿 DpSlider）。
class _AllocateSliderRow extends StatelessWidget {
  const _AllocateSliderRow({
    required this.fieldKey,
    required this.label,
    required this.caption,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.ticks,
    required this.valueLabel,
    required this.valueColor,
    required this.onChanged,
    required this.scheme,
  });

  final Key fieldKey;
  final String label;
  final String caption;
  final int value;
  final int min;
  final int max;
  final int step;

  /// 滑块下方刻度标签（左/中/右），对齐设计稿三档。
  final List<String> ticks;
  final String valueLabel;
  final Color valueColor;
  final ValueChanged<int> onChanged;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    final int divisions = ((max - min) / step).round();
    return Container(
      key: fieldKey,
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      caption,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Text(
                valueLabel,
                style: TextStyle(
                  color: valueColor,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: valueColor,
              thumbColor: valueColor,
              inactiveTrackColor: c.border,
              overlayColor: valueColor.withValues(alpha: 0.16),
              trackHeight: 4,
            ),
            child: Slider(
              value: value.toDouble().clamp(min.toDouble(), max.toDouble()),
              min: min.toDouble(),
              max: max.toDouble(),
              divisions: divisions,
              label: valueLabel,
              onChanged: (double v) =>
                  onChanged(v.round().clamp(min, max)),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              for (final String t in ticks)
                Text(
                  t,
                  style: TextStyle(color: c.textDim, fontSize: 10),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 通知分渠道开关行（#1796，对齐设计稿 3 个开关）。
class _NotifyRow extends StatelessWidget {
  const _NotifyRow({
    required this.rowKey,
    required this.label,
    required this.caption,
    required this.value,
    required this.onChanged,
    required this.showDivider,
    required this.scheme,
  });

  final Key rowKey;
  final String label;
  final String caption;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool showDivider;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Container(
      key: rowKey,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.xs,
      ),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(top: BorderSide(color: c.borderSoft))
            : null,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  caption,
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

/// 部署前预检查（#1772 PreflightChecks）。
///
/// 策略 recap + 3 项检查（API/余额/网络）逐项扫描。原型默认全通过；
/// `_PreflightPaneState` 用一次性链式延时驱动逐项揭示，扫完即停（非循环），
/// 测试可显式 `pump(Duration)` 步进。失败态保留「重新检测」交互入口；
/// 当前 mock 三项均通过，全部通过才允许「确认部署」。
class _PreflightPane extends StatefulWidget {
  const _PreflightPane({
    required this.target,
    required this.amount,
    required this.onBack,
    required this.onConfirm,
  });

  final _DeployTarget target;
  final double amount;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  State<_PreflightPane> createState() => _PreflightPaneState();
}

class _PreflightPaneState extends State<_PreflightPane> {
  static const Duration _scanInterval = Duration(milliseconds: 360);

  int _scanned = 0;
  bool _rechecking = false;
  // 首轮预检 mock 失败（去绑定 API / 余额不足 / 时延异常）；「重新检测」翻转为全 pass。
  // 替代旧的 3 项永远 pass，覆盖设计稿失败路径（#1896）。
  bool _recovered = false;
  Timer? _timer;

  List<PreflightCheck> _checks(AppLocalizations l10n) => <PreflightCheck>[
        PreflightCheck(
          ok: _recovered,
          title: _recovered
              ? l10n.deployPreflightApiOkTitle(widget.target.catalog.name)
              : l10n.deployPreflightApiFailTitle,
          sub: _recovered
              ? l10n.deployPreflightApiOkSub
              : l10n.deployPreflightApiFailSub,
          actionable: !_recovered,
        ),
        PreflightCheck(
          ok: _recovered,
          title: _recovered
              ? l10n.deployPreflightBalanceOkTitle
              : l10n.deployPreflightBalanceFailTitle,
          sub: _recovered
              ? l10n.deployPreflightBalanceOkSub
              : l10n.deployPreflightBalanceFailSub,
        ),
        PreflightCheck(
          ok: _recovered,
          title: _recovered
              ? l10n.deployPreflightLatencyOkTitle
              : l10n.deployPreflightLatencyFailTitle,
          sub: _recovered
              ? l10n.deployPreflightLatencyOkSub
              : l10n.deployPreflightLatencyFailSub,
        ),
      ];

  @override
  void initState() {
    super.initState();
    _startScan();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startScan() {
    _timer = Timer(_scanInterval, () {
      if (!mounted) return;
      setState(() => _scanned += 1);
      if (_scanned < 3) {
        _startScan();
      } else if (_rechecking) {
        setState(() => _rechecking = false);
      }
    });
  }

  void _recheck() {
    setState(() {
      _rechecking = true;
      _recovered = true; // 复检：mock 视作问题已处理 → 全 pass。
      _scanned = 0;
    });
    _startScan();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<PreflightCheck> checks = _checks(l10n);
    final bool scanning = _scanned < checks.length;
    final int pass = checks.where((PreflightCheck c) => c.ok).length;
    final int fail = checks.length - pass;
    final bool allPass = fail == 0;
    final bool canDeploy = !scanning && allPass;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // 只读账单确认：策略 + 风险 summary 卡（净值 / Sharpe / 最大回撤）
        // + 只读表单（交易所 / 市场类型 / 选择账户 / 部署杠杆）+ footnote（#1896）。
        Container(
          key: const Key('deploy-confirm-bill'),
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.deployPreflightStrategyName,
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                l10n.deployPreflightStrategyMeta,
                style: TextStyle(color: c.textDim, fontSize: 12),
              ),
              const SizedBox(height: QzSpacing.md),
              // 风险 summary 3 格（mock）。
              Row(
                children: <Widget>[
                  _SummaryCell(
                    label: l10n.deployConfirmSummaryReturn,
                    value: '+38.2%',
                    valueColor: c.marketUp,
                    scheme: c,
                  ),
                  _SummaryCell(
                    label: l10n.deployConfirmSummarySharpe,
                    value: '1.86',
                    scheme: c,
                  ),
                  _SummaryCell(
                    label: l10n.deployConfirmSummaryMaxDrawdown,
                    value: '-12.4%',
                    valueColor: c.marketDown,
                    scheme: c,
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Divider(color: c.border, height: 1),
              const SizedBox(height: QzSpacing.xs),
              // 只读表单。
              _DetailRow(
                label: l10n.deployConfirmFieldExchange,
                value: widget.target.catalog.name,
                scheme: c,
              ),
              _DetailRow(
                label: l10n.deployConfirmFieldMarketType,
                value: l10n.deployConfirmMarketPerp,
                scheme: c,
              ),
              _DetailRow(
                label: l10n.deployConfirmFieldAccount,
                value:
                    widget.target.apiKey?.label ?? widget.target.catalog.name,
                scheme: c,
              ),
              _DetailRow(
                label: l10n.deployConfirmFieldLeverage,
                value: '5x · 全仓',
                scheme: c,
              ),
              const SizedBox(height: QzSpacing.xs),
              Text(
                l10n.deployConfirmFootnote,
                style: TextStyle(color: c.textDim, fontSize: 11, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        // checks header
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                l10n.deploySheetTitlePreflight,
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (!allPass && !scanning)
              QzButton(
                key: const Key('deploy-preflight-recheck'),
                label: _rechecking
                    ? l10n.deployPreflightRechecking
                    : l10n.deployPreflightRecheck,
                variant: QzButtonVariant.ghost,
                onPressed: _rechecking ? null : _recheck,
              ),
            Container(
              key: const Key('deploy-preflight-status'),
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: allPass
                    ? c.marketUp.withValues(alpha: 0.15)
                    : c.marketDown.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Text(
                scanning
                    ? l10n.deployPreflightScanning(_scanned, checks.length)
                    : (allPass
                        ? l10n.deployPreflightPassed(pass, checks.length)
                        : l10n.deployPreflightFailed(fail, checks.length)),
                style: TextStyle(
                  color: allPass ? c.marketUp : c.marketDown,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.sm),
        for (int i = 0; i < checks.length; i++)
          _PreflightRow(
            index: i,
            check: checks[i],
            checking: i >= _scanned,
            scheme: c,
          ),
        const SizedBox(height: QzSpacing.lg),
        Row(
          children: <Widget>[
            QzButton(
              key: const Key('deploy-preflight-back'),
              label: l10n.deployPreflightBackButton,
              variant: QzButtonVariant.ghost,
              onPressed: widget.onBack,
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: QzButton(
                key: const Key('deploy-preflight-confirm'),
                label: l10n.deployPreflightConfirmButton,
                variant: QzButtonVariant.accent,
                onPressed: canDeploy ? widget.onConfirm : null,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _PreflightRow extends StatelessWidget {
  const _PreflightRow({
    required this.index,
    required this.check,
    required this.checking,
    required this.scheme,
  });

  final int index;
  final PreflightCheck check;
  final bool checking;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    final Color statusColor = check.ok ? c.marketUp : c.marketDown;
    return Padding(
      key: Key('deploy-preflight-row-$index'),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 18,
            height: 18,
            child: checking
                ? CircularProgressIndicator(strokeWidth: 2, color: c.textDim)
                : Icon(
                    check.ok ? Icons.check_circle : Icons.cancel,
                    size: 18,
                    color: statusColor,
                  ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  check.title,
                  style: TextStyle(
                    color: checking ? c.textDim : (check.ok ? c.text : statusColor),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  check.sub,
                  style: TextStyle(color: c.textDim, fontSize: 11, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

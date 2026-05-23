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
/// 单 widget 内承载 4 步状态机（`pickExchange → authorize → deploying → done`）。
/// 拆成 4 个 Widget 反而要把 step 状态外挂或层层 callback，按 KISS 内聚在一处。
///
/// 真后端尚未接入：交易所列表读 `apiKeysProvider`；「同意并部署」用
/// `Future.delayed` 模拟 1.8s 进度反馈；成功后生成本地实例 ID 并 `Navigator.pop`
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
  /// 部署进度可视化时长。验收 ≥1.5s；取 1.8s 留 buffer。
  static const Duration _deployDuration = Duration(milliseconds: 1800);

  DeployStep _step = DeployStep.pickExchange;
  _DeployTarget? _selected;
  DeploymentResult? _result;
  bool _consent = false;

  /// 已授权交易所走原权限授权流。
  void _pickAuthorized(_DeployTarget t) {
    setState(() {
      _selected = t;
      _consent = false;
      _step = DeployStep.authorize;
    });
  }

  /// 未授权交易所走 3 步引导流。
  void _pickUnauthorized(_DeployTarget t) {
    setState(() {
      _selected = t;
      _consent = false;
      _step = DeployStep.authorize;
    });
  }

  Future<void> _confirmAuthorize() async {
    if (_selected?.apiKey == null) return;
    setState(() => _step = DeployStep.deploying);
    await Future<void>.delayed(_deployDuration);
    if (!mounted) return;
    final DeploymentResult result = DeploymentResult(
      exchange: _selected!.apiKey!.exchange,
      instanceId: 'inst-${DateTime.now().microsecondsSinceEpoch}',
      deployedAt: DateTime.now(),
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
          Text(
            title,
            style: TextStyle(
              color: c.text,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
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
          onPickAuthorized: _pickAuthorized,
          onPickUnauthorized: _pickUnauthorized,
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
      case DeployStep.deploying:
        return _DeployingPane(scheme: c);
      case DeployStep.done:
        return _DonePane(
          result: _result!,
          onFinish: _finish,
        );
    }
  }
}

class _ExchangePicker extends ConsumerWidget {
  const _ExchangePicker({
    required this.onPickAuthorized,
    required this.onPickUnauthorized,
    required this.onGoConfigure,
  });

  final void Function(_DeployTarget) onPickAuthorized;
  final void Function(_DeployTarget) onPickUnauthorized;
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
                  onTap: () => t.authorized
                      ? onPickAuthorized(t)
                      : onPickUnauthorized(t),
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

class _DeployingPane extends StatelessWidget {
  const _DeployingPane({required this.scheme});

  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
      child: Center(
        key: const Key('deploy-progress'),
        child: CircularProgressIndicator(color: scheme.text),
      ),
    );
  }
}

class _DonePane extends StatelessWidget {
  const _DonePane({required this.result, required this.onFinish});

  final DeploymentResult result;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Row(
          children: <Widget>[
            Icon(Icons.check_circle, size: 18, color: c.marketUp),
            const SizedBox(width: QzSpacing.xs),
            Expanded(
              child: Text(
                '${result.exchange.toUpperCase()} · ${result.instanceId}',
                style: TextStyle(color: c.text, fontSize: 14),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.lg),
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

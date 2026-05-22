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

class _QzDeploySheetState extends ConsumerState<QzDeploySheet> {
  /// 部署进度可视化时长。验收 ≥1.5s；取 1.8s 留 buffer。
  static const Duration _deployDuration = Duration(milliseconds: 1800);

  DeployStep _step = DeployStep.pickExchange;
  ExchangeApiKey? _selected;
  DeploymentResult? _result;

  /// 部署引导入口（issue #1648）：未配置任何 API 时，直接打开 API 表单
  /// bottom sheet（默认 Binance，覆盖最常见用户首选），跳过独立列表页。
  /// 先 pop 当前 deploy sheet 避免栈错位 + barrier 叠加；pop(null) 表示
  /// 用户中断本次部署。保存成功后由 `apiKeysProvider` 失效驱动后续刷新。
  Future<void> _goConfigureApi() async {
    final BuildContext ctx = context;
    Navigator.of(ctx).pop();
    if (!ctx.mounted) return;
    final bool? saved =
        await showApiFormSheet(ctx, exchange: 'Binance');
    if (saved == true && ctx.mounted) {
      ref.invalidate(apiKeysProvider);
    }
  }

  void _pickExchange(ExchangeApiKey key) {
    setState(() {
      _selected = key;
      _step = DeployStep.authorize;
    });
  }

  Future<void> _confirmAuthorize() async {
    if (_selected == null) return;
    setState(() => _step = DeployStep.deploying);
    await Future<void>.delayed(_deployDuration);
    if (!mounted) return;
    final DeploymentResult result = DeploymentResult(
      exchange: _selected!.exchange,
      instanceId: 'inst-${DateTime.now().microsecondsSinceEpoch}',
      deployedAt: DateTime.now(),
    );
    setState(() {
      _result = result;
      _step = DeployStep.done;
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
          onPick: _pickExchange,
          onGoConfigure: _goConfigureApi,
        );
      case DeployStep.authorize:
        return _AuthorizePane(
          selected: _selected!,
          onConfirm: _confirmAuthorize,
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
    required this.onPick,
    required this.onGoConfigure,
  });

  final void Function(ExchangeApiKey) onPick;
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
        if (list.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
                child: Text(
                  l10n.deployExchangeEmptyHint,
                  style: TextStyle(color: c.textDim, fontSize: 13),
                ),
              ),
              QzButton(
                key: const Key('deploy-go-configure'),
                label: l10n.deployGoConfigureButton,
                variant: QzButtonVariant.accent,
                onPressed: onGoConfigure,
              ),
            ],
          );
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            for (final ExchangeApiKey k in list)
              Padding(
                padding: const EdgeInsets.only(bottom: QzSpacing.sm),
                child: _ExchangeRow(
                  apiKey: k,
                  configured: true,
                  onTap: () => onPick(k),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _ExchangeRow extends StatelessWidget {
  const _ExchangeRow({
    required this.apiKey,
    required this.configured,
    required this.onTap,
  });

  final ExchangeApiKey apiKey;
  final bool configured;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return InkWell(
      key: Key('deploy-exchange-${apiKey.id}'),
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
                  Text(
                    apiKey.exchange.toUpperCase(),
                    style: TextStyle(
                      color: c.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    apiKey.label,
                    style: TextStyle(color: c.textDim, fontSize: 12),
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
                color: configured
                    ? c.marketUp.withValues(alpha: 0.15)
                    : c.border.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Text(
                configured
                    ? l10n.deployExchangeConfigured
                    : l10n.deployExchangeNotConfigured,
                style: TextStyle(
                  color: configured ? c.marketUp : c.textDim,
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

class _AuthorizePane extends StatelessWidget {
  const _AuthorizePane({
    required this.selected,
    required this.onConfirm,
  });

  final ExchangeApiKey selected;
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
          '${selected.exchange.toUpperCase()} · ${selected.label}',
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

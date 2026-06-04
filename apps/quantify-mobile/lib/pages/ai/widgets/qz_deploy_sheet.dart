import 'dart:async';

// ignore_for_file: unused_element, unused_field, prefer_final_fields

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/api_key_models.dart';
import '../../../data/models/deploy_models.dart';
import '../../../data/providers.dart';
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
part 'qz_deploy_sheet.deploying.part.dart';
part 'qz_deploy_sheet.done.part.dart';

/// 「一键部署」底部弹层。
///
/// 单 widget 内承载 3 段状态机
/// （`confirm → deploying → success`，#2064 对齐新版部署设计）。
/// 拆成多个 Widget 反而要把 step 状态外挂或层层 callback，按 KISS 内聚在一处。
///
/// 真后端尚未接入：交易所列表读 `apiKeysProvider`；部署进度用一次性链式
/// `Timer` 模拟分步推进；成功后生成本地实例 ID 并 `Navigator.pop`
/// 把 `DeploymentResult` 返回给调用方（`AiHomePage` 据此在对话流追加系统消息 +
/// 弹出 toast）。
///
/// 交易所 / 市场 / 资金由 AI 对话上下文决定，部署页只做只读账单确认 +
/// 部署前检查。未绑定 API 时在检查失败项内提供 API 绑定入口。
class QzDeploySheet extends ConsumerStatefulWidget {
  const QzDeploySheet({super.key, this.showHeader = true});

  final bool showHeader;

  /// 调起入口；返回的 `DeploymentResult` 表示部署成功，null 表示用户取消 /
  /// 关闭。
  static Future<DeploymentResult?> show(BuildContext context) {
    return QzSheet.show<DeploymentResult>(
      context: context,
      useRootNavigator: true,
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

  DeployStep _step = DeployStep.confirm;
  _DeployTarget? _deployingTarget;
  DeploymentResult? _result;
  String? _selectedAccountId;

  // #1772 资金配置状态。
  double _amount = _defaultAmount;
  int _perTradePct = _defaultPerTradePct;
  int _maxDailyLossPct = _defaultMaxDailyLossPct;
  // 分渠道通知开关（#1796，对齐设计稿 3 个开关）。
  bool _notifyOpen = true;
  bool _notifyClose = true;
  bool _notifyStopLoss = true;

  /// 预检查通过「确认部署」→ 部署中。
  /// 实际部署结果在分步动画跑完后由 `_onDeployingDone` 回填。
  void _confirmDeploy(_DeployTarget target) {
    if (!target.authorized) return;
    setState(() {
      _deployingTarget = target;
      _step = DeployStep.deploying;
    });
  }

  /// 部署分步动画跑完 → 用资金配置快照回填 `DeploymentResult` → done。
  void _onDeployingDone() {
    final _DeployTarget? target = _deployingTarget;
    if (!mounted || target?.apiKey == null) return;
    final DateTime now = DateTime.now();
    final DeploymentResult result = DeploymentResult(
      exchange: target!.apiKey!.exchange,
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
      _step = DeployStep.success;
    });
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

  void _finish() {
    Navigator.of(context).pop(_result);
  }

  _DeployTarget _targetFromKeys(List<ExchangeApiKey> keys) {
    final _ExchangeCatalogEntry catalog = _kExchangeCatalog[0];
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
      DeployStep.confirm => l10n.deploySheetTitlePreflight,
      DeployStep.deploying => l10n.deploySheetTitleDeploying,
      DeployStep.success => l10n.deploySheetTitleDone,
    };
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
        return Padding(
          padding: EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            widget.showHeader ? QzSpacing.lg : 0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: widget.showHeader
                ? MainAxisSize.min
                : MainAxisSize.max,
            children: <Widget>[
              if (widget.showHeader) ...<Widget>[
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
              ],
              if (widget.showHeader)
                Flexible(
                  fit: FlexFit.loose,
                  child: SingleChildScrollView(child: body),
                )
              else
                Expanded(child: body),
            ],
          ),
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
          amount: _amount,
          onAccountChanged: _selectAccount,
          onGoConfigure: _goConfigureApi,
          onBack: () => Navigator.of(context).maybePop(),
          onConfirm: () => _confirmDeploy(target),
          stickyActions: !widget.showHeader,
        );
      case DeployStep.deploying:
        final _DeployTarget active = _deployingTarget ?? target;
        return _DeployingPane(
          scheme: c,
          exchangeName: active.catalog.name,
          onDone: _onDeployingDone,
        );
      case DeployStep.success:
        return _DonePane(
          result: _result!,
          onFinish: _finish,
          stickyActions: !widget.showHeader,
        );
    }
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

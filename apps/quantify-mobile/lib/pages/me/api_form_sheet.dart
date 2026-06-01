import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';

/// 交易所认证形态（对齐设计稿 `m-screens-4.jsx:2825-2831` 的 `API_META`）。
enum _ApiMode { key, wallet }

/// 表单环境：仅 `testnet=true` 的交易所允许在主网 / 测试网间切换。
enum _ApiEnv { mainnet, testnet }

/// 单个交易所的表单 meta：决定渲染哪种字段与权限。
class _ApiMeta {
  const _ApiMeta({
    required this.mode,
    this.passphrase = false,
    this.testnet = false,
  });

  final _ApiMode mode;

  /// OKX 家族（OKX/Bitget/KuCoin）需要 Passphrase。
  final bool passphrase;

  /// 是否提供独立测试网（仅 Binance），决定是否渲染环境切换。
  final bool testnet;
}

const Map<String, _ApiMeta> _apiMetaTable = <String, _ApiMeta>{
  'binance': _ApiMeta(mode: _ApiMode.key, testnet: true),
  'okx': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'bitget': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'kucoin': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'hyperliquid': _ApiMeta(mode: _ApiMode.wallet),
};

/// 测试网接口域名（仅 Binance 测试网展示，对齐 `m-screens-4.jsx:3008`）。
const String _testnetEndpoint = 'https://testnet.binance.vision';

/// 测试网保存按钮琥珀渐变（对齐 `m-screens-4.jsx:3028`，QzButton 仅有紫色 accent
/// 渐变，故 testnet 按钮在本文件内自绘）。
const LinearGradient _testnetButtonGrad = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: <Color>[Color(0xFFF59E0B), Color(0xFFD97706)],
);

_ApiMeta _metaFor(String exchange) =>
    _apiMetaTable[exchange.toLowerCase()] ??
    const _ApiMeta(mode: _ApiMode.key);

/// 弹出原型第 10 屏的 API 凭据表单。
///
/// 调用方负责传 [exchange]（已选定，sheet 内不让改）。`addKey` 成功后
/// 关闭 sheet 并 `return true`，让调用方刷新列表。
Future<bool?> showApiFormSheet(
  BuildContext context, {
  required String exchange,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (BuildContext context) => ApiFormSheet(exchange: exchange),
  );
}

class ApiFormSheet extends ConsumerStatefulWidget {
  const ApiFormSheet({super.key, required this.exchange});
  final String exchange;

  @override
  ConsumerState<ApiFormSheet> createState() => _ApiFormSheetState();
}

class _ApiFormSheetState extends ConsumerState<ApiFormSheet> {
  /// API Key / Secret / 钱包地址 / Agent 私钥共用的最小长度阈值（plan 决策：
  /// 加固高于原型非空校验；现实凭据 / 0x 地址均 ≥ 32 字符，16 是保守下限）。
  static const int _minCredentialLen = 16;

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  // key 模式
  final TextEditingController _apiKey = TextEditingController();
  final TextEditingController _secret = TextEditingController();
  final TextEditingController _passphrase = TextEditingController();
  // wallet 模式
  final TextEditingController _walletAddress = TextEditingController();
  final TextEditingController _agentKey = TextEditingController();
  // 共用
  final TextEditingController _label = TextEditingController();

  bool _showSecret = false;
  bool _saving = false;

  late final _ApiMeta _meta = _metaFor(widget.exchange);

  /// 当前环境。不支持测试网的交易所恒为主网；切换控件也不渲染。
  _ApiEnv _env = _ApiEnv.mainnet;

  bool get _isTestnet => _meta.testnet && _env == _ApiEnv.testnet;

  @override
  void dispose() {
    _apiKey.dispose();
    _secret.dispose();
    _passphrase.dispose();
    _walletAddress.dispose();
    _agentKey.dispose();
    _label.dispose();
    super.dispose();
  }

  String? _validateRequired(
    String? v, {
    required int minLen,
    required String name,
  }) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return '${l10n.meApiFormPleaseEnter}$name';
    if (v.length < minLen) {
      return '$name${l10n.meApiFormMinLenInfix}$minLen${l10n.meApiFormMinLenSuffix}';
    }
    return null;
  }

  String? _validateNotEmpty(String? v, {required String name}) {
    if (v == null || v.isEmpty) {
      return '${AppLocalizations.of(context).meApiFormPleaseEnter}$name';
    }
    return null;
  }

  String? _validateLabel(String? v) {
    if (v == null || v.isEmpty) return null; // 可选
    if (v.length > 30) return AppLocalizations.of(context).meApiFormNoteTooLong;
    return null;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final AppLocalizations l10n = AppLocalizations.of(context);
    // wallet 模式：主钱包地址 → apiKey 槽，Agent 私钥 → apiSecret 槽。
    final bool isWallet = _meta.mode == _ApiMode.wallet;
    final String apiKey = isWallet ? _walletAddress.text : _apiKey.text;
    final String apiSecret = isWallet ? _agentKey.text : _secret.text;
    final String? passphrase =
        (!isWallet && _meta.passphrase) ? _passphrase.text : null;
    try {
      await ref.read(apiKeyRepositoryProvider).addKey(
            exchange: widget.exchange,
            label: _label.text.trim().isEmpty
                ? l10n.meApiFormDefaultLabel
                : _label.text.trim(),
            apiKey: apiKey,
            apiSecret: apiSecret,
            apiPassphrase: passphrase,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      // 不把后端异常原文塞给用户 SnackBar，避免暴露请求体片段 / 内部
      // 字段名 / stack trace 片段。统一显示固定通用文案；详细错误走日志。
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.meApiFormSaveFailed)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final MediaQueryData mq = MediaQuery.of(context);

    return AnimatedPadding(
      duration: const Duration(milliseconds: 200),
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: mq.size.height * 0.9,
        ),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(24),
          ),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              // grabber
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: c.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                child: Row(
                  children: <Widget>[
                    _ExchangeBadge(exchange: widget.exchange),
                    const SizedBox(width: QzSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Flexible(
                                child: Text(
                                  '${widget.exchange} API',
                                  style: TextStyle(
                                    color: c.text,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              if (_isTestnet) ...<Widget>[
                                const SizedBox(width: 6),
                                _TestnetBadge(c: c),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _isTestnet
                                ? l10n.meApiFormTestnetSubtitle
                                : l10n.meApiFormPermissionHint,
                            style: TextStyle(
                              color: c.textMid,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                    children: <Widget>[
                      // 环境切换：仅支持测试网的交易所渲染（设计稿先于密钥决策）。
                      if (_meta.testnet) ...<Widget>[
                        _Label(text: l10n.meApiFormEnvLabel),
                        const SizedBox(height: 6),
                        _EnvToggle(
                          l10n: l10n,
                          env: _env,
                          onChanged: (_ApiEnv next) =>
                              setState(() => _env = next),
                        ),
                        const SizedBox(height: 14),
                      ],
                      _WarningBanner(
                        exchange: widget.exchange,
                        wallet: _meta.mode == _ApiMode.wallet,
                        testnet: _isTestnet,
                      ),
                      const SizedBox(height: 18),
                      ..._buildCredentialFields(c, l10n),
                      const SizedBox(height: 14),
                      _Label(text: l10n.meApiFormLabelNote),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _label,
                        decoration: _inputDecoration(c),
                        validator: _validateLabel,
                      ),
                      if (_isTestnet) ...<Widget>[
                        const SizedBox(height: 14),
                        _EndpointHint(l10n: l10n),
                      ],
                      const SizedBox(height: 18),
                      _Label(text: l10n.meApiFormPermissionSection),
                      const SizedBox(height: 8),
                      _PermissionList(
                        l10n: l10n,
                        wallet: _meta.mode == _ApiMode.wallet,
                        testnet: _isTestnet,
                      ),
                    ],
                  ),
                ),
              ),
              // footer
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      flex: 1,
                      child: QzButton(
                        label: l10n.commonCancel,
                        variant: QzButtonVariant.ghost,
                        onPressed: () => Navigator.of(context).pop(false),
                        expanded: true,
                      ),
                    ),
                    const SizedBox(width: QzSpacing.sm + 2),
                    Expanded(
                      flex: 2,
                      child: _isTestnet
                          ? _TestnetSaveButton(
                              label: l10n.meApiFormSaveTestnetButton,
                              loading: _saving,
                              onPressed: _saving ? null : _save,
                            )
                          : QzButton(
                              label: l10n.meApiFormSaveButton,
                              variant: QzButtonVariant.accent,
                              loading: _saving,
                              onPressed: _saving ? null : _save,
                              expanded: true,
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 按 meta.mode 渲染凭据字段：wallet → 地址 + Agent 私钥；
  /// key → API Key + Secret(+ Passphrase)。
  List<Widget> _buildCredentialFields(
    QzColorScheme c,
    AppLocalizations l10n,
  ) {
    if (_meta.mode == _ApiMode.wallet) {
      return <Widget>[
        _Label(text: l10n.meApiFormWalletAddressLabel, required: true),
        const SizedBox(height: 6),
        TextFormField(
          controller: _walletAddress,
          decoration: _inputDecoration(c),
          validator: (String? v) => _validateRequired(
            v,
            minLen: _minCredentialLen,
            name: l10n.meApiFormWalletAddressLabel,
          ),
        ),
        const SizedBox(height: 14),
        _Label(text: l10n.meApiFormAgentKeyLabel, required: true),
        const SizedBox(height: 6),
        TextFormField(
          controller: _agentKey,
          obscureText: !_showSecret,
          decoration: _secretDecoration(c),
          validator: (String? v) => _validateRequired(
            v,
            minLen: _minCredentialLen,
            name: l10n.meApiFormAgentKeyLabel,
          ),
        ),
        const SizedBox(height: 6),
        _FieldHint(text: l10n.meApiFormWalletHint),
      ];
    }

    final String secretLabel =
        _meta.passphrase ? l10n.meApiFormSecretKeyLabel : l10n.meApiFormSecretLabel;
    return <Widget>[
      _Label(text: l10n.meApiFormApiKeyLabel, required: true),
      const SizedBox(height: 6),
      TextFormField(
        controller: _apiKey,
        decoration: _inputDecoration(c),
        validator: (String? v) => _validateRequired(
          v,
          minLen: _minCredentialLen,
          name: 'API Key',
        ),
      ),
      const SizedBox(height: 14),
      _Label(text: secretLabel, required: true),
      const SizedBox(height: 6),
      TextFormField(
        controller: _secret,
        obscureText: !_showSecret,
        decoration: _secretDecoration(c),
        validator: (String? v) => _validateRequired(
          v,
          minLen: _minCredentialLen,
          name: secretLabel,
        ),
      ),
      if (_meta.passphrase) ...<Widget>[
        const SizedBox(height: 14),
        _Label(text: l10n.meApiFormPassphraseLabel, required: true),
        const SizedBox(height: 6),
        TextFormField(
          controller: _passphrase,
          obscureText: !_showSecret,
          decoration: _inputDecoration(c),
          validator: (String? v) => _validateNotEmpty(
            v,
            name: l10n.meApiFormPassphraseLabel,
          ),
        ),
        const SizedBox(height: 6),
        _FieldHint(text: l10n.meApiFormPassphraseHint),
      ],
    ];
  }

  InputDecoration _inputDecoration(QzColorScheme c) {
    return InputDecoration(
      filled: true,
      fillColor: c.bgInput,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(QzRadii.input),
        borderSide: BorderSide(color: c.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(QzRadii.input),
        borderSide: BorderSide(color: c.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(QzRadii.input),
        borderSide: BorderSide(color: c.accent),
      ),
    );
  }

  /// 带「显示/隐藏」眼睛图标的 secret 类输入框装饰。
  InputDecoration _secretDecoration(QzColorScheme c) {
    return _inputDecoration(c).copyWith(
      suffixIcon: IconButton(
        icon: Icon(
          _showSecret ? Icons.visibility_off : Icons.visibility,
          size: 18,
          color: c.textMid,
        ),
        onPressed: () => setState(() => _showSecret = !_showSecret),
      ),
    );
  }
}

class _FieldHint extends StatelessWidget {
  const _FieldHint({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(color: c.textMid, fontSize: 11, height: 1.5),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.text, this.required = false});
  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          text,
          style: TextStyle(
            color: c.text,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (required) ...<Widget>[
          const SizedBox(width: 4),
          Text(
            '*',
            style: TextStyle(color: c.statusDanger, fontSize: 13),
          ),
        ],
      ],
    );
  }
}

class _ExchangeBadge extends StatelessWidget {
  const _ExchangeBadge({required this.exchange});
  final String exchange;

  Color _color() {
    switch (exchange.toLowerCase()) {
      case 'binance':
        return const Color(0xFFF0B90B);
      case 'okx':
        return const Color(0xFF22272F);
      case 'hyperliquid':
        return const Color(0xFF13ABA1);
      default:
        return const Color(0xFF7C5CFF);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color bg = _color();
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(11),
      ),
      alignment: Alignment.center,
      child: Text(
        exchange.isEmpty ? '?' : exchange.substring(0, 1).toUpperCase(),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// 「授权权限」区块（对齐设计稿 `m-screens-4.jsx:2998-3015`）。
///
/// - key 模式：读取账户与持仓 / 现货下单 / 合约下单（均 ok）+ 提币（blocked）。
/// - wallet 模式：读取账户与持仓 / 永续·现货下单（均 ok）+ 转账·提币（disabled）。
class _PermissionList extends StatelessWidget {
  const _PermissionList({
    required this.l10n,
    required this.wallet,
    this.testnet = false,
  });
  final AppLocalizations l10n;
  final bool wallet;
  final bool testnet;

  @override
  Widget build(BuildContext context) {
    if (wallet) {
      return Column(
        children: <Widget>[
          _PermissionRow(
            label: l10n.meApiFormPermAccountRead,
            value: l10n.meApiFormPermRequired,
            tone: _PermTone.ok,
          ),
          const SizedBox(height: 8),
          _PermissionRow(
            label: l10n.meApiFormPermPerpSpotOrder,
            value: l10n.meApiFormPermRequired,
            tone: _PermTone.ok,
          ),
          const SizedBox(height: 8),
          _PermissionRow(
            label: l10n.meApiFormPermTransferWithdraw,
            value: l10n.meApiFormPermAgentNoAccess,
            tone: _PermTone.disabled,
          ),
        ],
      );
    }
    return Column(
      children: <Widget>[
        _PermissionRow(
          label: l10n.meApiFormPermAccountRead,
          value: l10n.meApiFormPermRequired,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        _PermissionRow(
          label: l10n.meApiFormPermSpotOrder,
          value: l10n.meApiFormPermRequired,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        _PermissionRow(
          label: l10n.meApiFormPermFuturesOrder,
          value: l10n.meApiFormPermOptional,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        // 测试网无资金，提币行降级为 disabled「测试网无提币」（设计稿 3058）。
        _PermissionRow(
          label: l10n.meApiFormPermWithdrawLabel,
          value: testnet
              ? l10n.meApiFormPermWithdrawTestnetValue
              : l10n.meApiFormPermWithdrawValue,
          tone: testnet ? _PermTone.disabled : _PermTone.blocked,
        ),
      ],
    );
  }
}

enum _PermTone { ok, blocked, disabled }

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.label,
    required this.value,
    required this.tone,
  });
  final String label;
  final String value;
  final _PermTone tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color fg;
    final Color bg;
    final IconData icon;
    switch (tone) {
      case _PermTone.ok:
        fg = c.statusOk;
        bg = c.statusOk.withValues(alpha: 0.10);
        icon = Icons.check_circle_outline;
      case _PermTone.blocked:
        fg = c.statusDanger;
        bg = c.statusDanger.withValues(alpha: 0.10);
        icon = Icons.block;
      case _PermTone.disabled:
        fg = c.textMid;
        bg = c.bgInput;
        icon = Icons.remove;
    }
    final double opacity = tone == _PermTone.disabled ? 0.6 : 1;
    return Opacity(
      opacity: opacity,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Text(
              value,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WarningBanner extends StatelessWidget {
  const _WarningBanner({
    required this.exchange,
    required this.wallet,
    this.testnet = false,
  });
  final String exchange;
  final bool wallet;
  final bool testnet;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 测试网文案不分 bold/body，整段一句话提示去 testnet.binance.vision 申请。
    final String boldText = testnet
        ? l10n.meApiFormTestnetWarningBold
        : (wallet ? l10n.meApiFormWalletWarningMust : l10n.meApiFormWarningMust);
    final String bodyText = testnet
        ? l10n.meApiFormTestnetWarningBody
        : (wallet
            ? l10n.meApiFormWalletWarningBody
            : l10n.meApiFormWarningBody(exchange));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 16, color: c.statusWarn),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: TextStyle(
                  color: c.statusWarn,
                  fontSize: 12,
                  height: 1.55,
                ),
                children: <InlineSpan>[
                  TextSpan(
                    text: boldText,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: bodyText),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 标题旁的 `TESTNET` 琥珀标签（设计稿 `m-screens-4.jsx:2864`）。
class _TestnetBadge extends StatelessWidget {
  const _TestnetBadge({required this.c});
  final QzColorScheme c;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(5),
      ),
      alignment: Alignment.center,
      child: Text(
        'TESTNET',
        style: TextStyle(
          color: c.statusWarn,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

/// 主网 / 测试网分段控件（设计稿 `m-screens-4.jsx:2879-2918`）。
class _EnvToggle extends StatelessWidget {
  const _EnvToggle({
    required this.l10n,
    required this.env,
    required this.onChanged,
  });
  final AppLocalizations l10n;
  final _ApiEnv env;
  final ValueChanged<_ApiEnv> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        children: <Widget>[
          _segment(
            c,
            selected: env == _ApiEnv.mainnet,
            label: l10n.meApiFormEnvMainnetLabel,
            sub: l10n.meApiFormEnvMainnetSub,
            color: c.accent,
            onTap: () => onChanged(_ApiEnv.mainnet),
          ),
          const SizedBox(width: 3),
          _segment(
            c,
            selected: env == _ApiEnv.testnet,
            label: l10n.meApiFormEnvTestnetLabel,
            sub: l10n.meApiFormEnvTestnetSub,
            color: c.statusWarn,
            onTap: () => onChanged(_ApiEnv.testnet),
          ),
        ],
      ),
    );
  }

  Widget _segment(
    QzColorScheme c, {
    required bool selected,
    required String label,
    required String sub,
    required Color color,
    required VoidCallback onTap,
  }) {
    final Color fg = selected ? color : c.textMid;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? c.bgElev : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: fg,
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                sub,
                style: TextStyle(
                  color: selected ? fg : c.textMid,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 测试网接口域名 mono hint（设计稿 `m-screens-4.jsx:2998-3015`）。
class _EndpointHint extends StatelessWidget {
  const _EndpointHint({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.meApiFormEndpointLabel,
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _testnetEndpoint,
            style: TextStyle(
              color: c.text,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

/// 测试网保存按钮：琥珀渐变（设计稿 `m-screens-4.jsx:3024-3038`）。
class _TestnetSaveButton extends StatelessWidget {
  const _TestnetSaveButton({
    required this.label,
    required this.loading,
    required this.onPressed,
  });
  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final bool disabled = loading || onPressed == null;
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              gradient: _testnetButtonGrad,
              borderRadius: BorderRadius.circular(QzRadii.input),
            ),
            alignment: Alignment.center,
            child: loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

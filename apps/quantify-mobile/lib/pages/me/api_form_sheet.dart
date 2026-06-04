import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';
import 'api_form_sheet_controller.dart';
import 'api_form_sheet_state.dart';
import 'widgets/qz_exchange_logo.dart';
part 'api_form_sheet.fields.part.dart';

/// 交易所认证形态（对齐设计稿 `m-screens-4.jsx:2825-2831` 的 `API_META`）。
enum _ApiMode { key, wallet }

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
    useRootNavigator: true,
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

  /// 按 `exchange` 纯派生，无状态流转，故留在 widget。
  late final _ApiMeta _meta = _metaFor(widget.exchange);

  ApiFormSheetController get _controller =>
      ref.read(apiFormSheetControllerProvider.notifier);

  /// 当前是否处于测试网态：交易所支持测试网且 controller env 选了 testnet。
  bool _isTestnetFor(ApiEnv env) => _meta.testnet && env == ApiEnv.testnet;

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
    final AppLocalizations l10n = AppLocalizations.of(context);
    // wallet 模式：主钱包地址 → apiKey 槽，Agent 私钥 → apiSecret 槽。
    final bool isWallet = _meta.mode == _ApiMode.wallet;
    final String apiKey = isWallet ? _walletAddress.text : _apiKey.text;
    final String apiSecret = isWallet ? _agentKey.text : _secret.text;
    final String? passphrase =
        (!isWallet && _meta.passphrase) ? _passphrase.text : null;
    final bool ok = await _controller.save(
      exchange: widget.exchange,
      label: _label.text.trim().isEmpty
          ? l10n.meApiFormDefaultLabel
          : _label.text.trim(),
      apiKey: apiKey,
      apiSecret: apiSecret,
      apiPassphrase: passphrase,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
      return;
    }
    // 保存失败：不暴露后端原文，统一固定文案（controller 已吞原文，详细走日志）。
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.meApiFormSaveFailed)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final MediaQueryData mq = MediaQuery.of(context);
    final ApiFormSheetState st = ref.watch(apiFormSheetControllerProvider);
    final bool isTestnet = _isTestnetFor(st.env);

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
                    QzExchangeLogo(exchange: widget.exchange, size: 42),
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
                              if (isTestnet) ...<Widget>[
                                const SizedBox(width: 6),
                                _TestnetBadge(c: c),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isTestnet
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
                          env: st.env,
                          onChanged: _controller.setEnv,
                        ),
                        const SizedBox(height: 14),
                      ],
                      _WarningBanner(
                        exchange: widget.exchange,
                        wallet: _meta.mode == _ApiMode.wallet,
                        testnet: isTestnet,
                      ),
                      const SizedBox(height: 18),
                      ..._buildCredentialFields(c, l10n, st.showSecret),
                      const SizedBox(height: 14),
                      _Label(text: l10n.meApiFormLabelNote),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _label,
                        decoration: _inputDecoration(c),
                        validator: _validateLabel,
                      ),
                      if (isTestnet) ...<Widget>[
                        const SizedBox(height: 14),
                        _EndpointHint(l10n: l10n),
                      ],
                      const SizedBox(height: 18),
                      _Label(text: l10n.meApiFormPermissionSection),
                      const SizedBox(height: 8),
                      _PermissionList(
                        l10n: l10n,
                        wallet: _meta.mode == _ApiMode.wallet,
                        testnet: isTestnet,
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
                      child: isTestnet
                          ? _TestnetSaveButton(
                              label: l10n.meApiFormSaveTestnetButton,
                              loading: st.saving,
                              onPressed: st.saving ? null : _save,
                            )
                          : QzButton(
                              label: l10n.meApiFormSaveButton,
                              variant: QzButtonVariant.accent,
                              loading: st.saving,
                              onPressed: st.saving ? null : _save,
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
    bool showSecret,
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
          obscureText: !showSecret,
          decoration: _secretDecoration(c, showSecret),
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
        obscureText: !showSecret,
        decoration: _secretDecoration(c, showSecret),
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
          obscureText: !showSecret,
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
  InputDecoration _secretDecoration(QzColorScheme c, bool showSecret) {
    return _inputDecoration(c).copyWith(
      suffixIcon: IconButton(
        icon: Icon(
          showSecret ? Icons.visibility_off : Icons.visibility,
          size: 18,
          color: c.textMid,
        ),
        onPressed: _controller.toggleSecret,
      ),
    );
  }
}


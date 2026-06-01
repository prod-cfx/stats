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

/// 单个交易所的表单 meta：决定渲染哪种字段与权限。
class _ApiMeta {
  const _ApiMeta({
    required this.mode,
    this.passphrase = false,
  });

  final _ApiMode mode;

  /// OKX 家族（OKX/Bitget/KuCoin）需要 Passphrase。
  final bool passphrase;
}

const Map<String, _ApiMeta> _apiMetaTable = <String, _ApiMeta>{
  'binance': _ApiMeta(mode: _ApiMode.key),
  'okx': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'bitget': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'kucoin': _ApiMeta(mode: _ApiMode.key, passphrase: true),
  'hyperliquid': _ApiMeta(mode: _ApiMode.wallet),
};

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
                          Text(
                            '${widget.exchange} API',
                            style: TextStyle(
                              color: c.text,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            l10n.meApiFormPermissionHint,
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
                      _WarningBanner(
                        exchange: widget.exchange,
                        wallet: _meta.mode == _ApiMode.wallet,
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
                      const SizedBox(height: 18),
                      _Label(text: l10n.meApiFormPermissionSection),
                      const SizedBox(height: 8),
                      _PermissionList(
                        l10n: l10n,
                        wallet: _meta.mode == _ApiMode.wallet,
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
                      child: QzButton(
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
  const _PermissionList({required this.l10n, required this.wallet});
  final AppLocalizations l10n;
  final bool wallet;

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
        _PermissionRow(
          label: l10n.meApiFormPermWithdrawLabel,
          value: l10n.meApiFormPermWithdrawValue,
          tone: _PermTone.blocked,
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
  const _WarningBanner({required this.exchange, required this.wallet});
  final String exchange;
  final bool wallet;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final String boldText =
        wallet ? l10n.meApiFormWalletWarningMust : l10n.meApiFormWarningMust;
    final String bodyText = wallet
        ? l10n.meApiFormWalletWarningBody
        : l10n.meApiFormWarningBody(exchange);
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

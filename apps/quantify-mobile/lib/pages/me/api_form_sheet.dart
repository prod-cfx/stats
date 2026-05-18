import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';

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
  /// API Key 与 Secret 共用的最小长度阈值（plan 决策 #6：加固高于原型
  /// 非空校验；现实交易所凭据均 ≥ 32 字符，16 是相对保守的下限）。
  static const int _minCredentialLen = 16;

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _apiKey = TextEditingController();
  final TextEditingController _secret = TextEditingController();
  final TextEditingController _label = TextEditingController();

  bool _showSecret = false;
  bool _testing = false;
  bool _saving = false;

  @override
  void dispose() {
    _apiKey.dispose();
    _secret.dispose();
    _label.dispose();
    super.dispose();
  }

  String? _validateRequired(String? v, {required int minLen, required String name}) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return '${l10n.meApiFormPleaseEnter}$name';
    if (v.length < minLen) return '$name${l10n.meApiFormMinLenInfix}$minLen${l10n.meApiFormMinLenSuffix}';
    return null;
  }

  String? _validateLabel(String? v) {
    if (v == null || v.isEmpty) return null; // 可选
    if (v.length > 30) return AppLocalizations.of(context).meApiFormNoteTooLong;
    return null;
  }

  Future<void> _testConnection() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _testing = true);
    try {
      final ApiConnectionTester tester =
          ref.read(apiConnectionTesterProvider);
      final bool ok = await tester();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ok ? AppLocalizations.of(context).meApiFormConnectionOk : AppLocalizations.of(context).meApiFormConnectionFailed)),
      );
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiKeyRepositoryProvider).addKey(
            exchange: widget.exchange,
            label: _label.text.trim().isEmpty ? AppLocalizations.of(context).meApiFormDefaultLabel : _label.text.trim(),
            apiKey: _apiKey.text,
            apiSecret: _secret.text,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${AppLocalizations.of(context).meApiFormSaveFailedPrefix}$e')),
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
                      _WarningBanner(exchange: widget.exchange),
                      const SizedBox(height: 18),
                      _Label(text: 'API Key', required: true),
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
                      _Label(text: 'Secret', required: true),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _secret,
                        obscureText: !_showSecret,
                        decoration: _inputDecoration(c).copyWith(
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showSecret
                                  ? Icons.visibility_off
                                  : Icons.visibility,
                              size: 18,
                              color: c.textMid,
                            ),
                            onPressed: () => setState(
                              () => _showSecret = !_showSecret,
                            ),
                          ),
                        ),
                        validator: (String? v) => _validateRequired(
                          v,
                          minLen: _minCredentialLen,
                          name: 'Secret',
                        ),
                      ),
                      const SizedBox(height: 14),
                      _Label(text: l10n.meApiFormLabelNote),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _label,
                        decoration: _inputDecoration(c),
                        validator: _validateLabel,
                      ),
                      const SizedBox(height: 18),
                      OutlinedButton(
                        onPressed: _testing ? null : _testConnection,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(44),
                          side: BorderSide(color: c.border),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(QzRadii.input),
                          ),
                          foregroundColor: c.text,
                        ),
                        child: _testing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(l10n.meApiFormTestButton),
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

class _WarningBanner extends StatelessWidget {
  const _WarningBanner({required this.exchange});
  final String exchange;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
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
                    text: l10n.meApiFormWarningMust,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(
                    text: l10n.meApiFormWarningBody(exchange),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

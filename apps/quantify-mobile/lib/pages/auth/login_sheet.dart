import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../widgets/qz_grab_handle.dart';
import 'login_sheet_controller.dart';
import 'login_sheet_state.dart';
import 'widgets/login_form_widgets.dart';

Future<void> showLoginSheet(BuildContext context) {
  final BuildContext parentContext = context;
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x73080A14),
    builder: (BuildContext sheetContext) =>
        LoginSheet(onAuthenticated: () => parentContext.go('/ai')),
  );
}

class LoginSheet extends ConsumerStatefulWidget {
  const LoginSheet({super.key, this.onAuthenticated});

  final VoidCallback? onAuthenticated;

  @override
  ConsumerState<LoginSheet> createState() => _LoginSheetState();
}

class _LoginSheetState extends ConsumerState<LoginSheet> {
  static final RegExp _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _code = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  String? _validateEmail(String? v) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return l10n.authLoginEmailRequired;
    if (!_emailRe.hasMatch(v)) return l10n.authLoginEmailInvalid;
    return null;
  }

  String? _validateCode(String? v) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return l10n.authLoginCodeRequired;
    if (!RegExp(r'^\d{6}$').hasMatch(v)) return l10n.authLoginCodeInvalid;
    return null;
  }

  LoginSheetController get _controller =>
      ref.read(loginSheetControllerProvider.notifier);

  Future<void> _sendLoginCode() async {
    final String? emailError = _validateEmail(_email.text.trim());
    if (emailError != null) {
      _formKey.currentState?.validate();
      return;
    }
    await _controller.sendLoginCode(email: _email.text.trim());
  }

  Future<void> _submitEmail() async {
    if (!_formKey.currentState!.validate()) return;
    final bool ok = await _controller.submitEmailCode(
      email: _email.text.trim(),
      code: _code.text.trim(),
    );
    if (!mounted || !ok) return;
    Navigator.of(context).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onAuthenticated?.call();
    });
  }

  Future<void> _submitTelegram() async {
    final bool ok = await _controller.submitTelegram();
    if (!mounted || !ok) return;
    Navigator.of(context).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onAuthenticated?.call();
    });
  }

  /// 把 controller 落的一次性错误信号弹成 SnackBar，按来源选前缀文案。
  void _showError(LoginSheetState st) {
    final String? msg = st.errorMessage;
    if (msg == null || msg.isEmpty) return;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String prefix = st.errorPrefixKind == LoginErrorKind.telegram
        ? l10n.authTelegramLoginFailedPrefix
        : l10n.authLoginFailedPrefix;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$prefix$msg')),
    );
  }

  void _onTermsTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(AppLocalizations.of(context).authLoginTermsLink)),
    );
  }

  void _onPrivacyTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).authLoginPrivacyLink),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;

    // 一次性错误信号：仅在 epoch 变化时弹一次，避免重建重弹。
    ref.listen<int>(
      loginSheetControllerProvider.select((LoginSheetState s) => s.errorEpoch),
      (int? prev, int next) {
        if (next == 0 || next == prev) return;
        _showError(ref.read(loginSheetControllerProvider));
      },
    );

    final LoginSheetState st = ref.watch(loginSheetControllerProvider);
    final bool busy = st.busy;
    final String sendCodeLabel = st.codeCountdown > 0
        ? l10n.authLoginCountdown(st.codeCountdown)
        : (st.codeSent ? l10n.authLoginResend : l10n.authLoginSendCode);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DecoratedBox(
        key: const Key('login-sheet'),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: const <BoxShadow>[
            BoxShadow(
              color: Color(0x52000000),
              blurRadius: 40,
              offset: Offset(0, -16),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const QzGrabHandle(
                    key: Key('login-sheet-handle'),
                    margin: EdgeInsets.only(top: 10, bottom: 8),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 10, 22, 4),
                    child: Row(
                      children: <Widget>[
                        const LoginLogoMark(),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                l10n.authLoginSheetTitle,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                l10n.authLoginSheetSubtitle,
                                style: TextStyle(
                                  color: c.textDim,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          key: const Key('login-sheet-close'),
                          onPressed: () => Navigator.of(context).pop(),
                          style: IconButton.styleFrom(
                            backgroundColor: c.bgSoft,
                            foregroundColor: c.textMid,
                            fixedSize: const Size(32, 32),
                            minimumSize: const Size(32, 32),
                            padding: EdgeInsets.zero,
                          ),
                          icon: const Icon(Icons.close, size: 14),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 14, 22, 0),
                    child: Form(
                      key: _formKey,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          LoginTextField(
                            fieldKey: const Key('login-email-field'),
                            shellKey: const Key('login-email-field-shell'),
                            labelKey: const Key('login-email-label'),
                            controller: _email,
                            enabled: !busy,
                            label: l10n.authLoginEmailLabel,
                            hintText: 'you@example.com',
                            keyboardType: TextInputType.emailAddress,
                            validator: _validateEmail,
                            colors: c,
                          ),
                          const SizedBox(height: 10),
                          LoginTextField(
                            fieldKey: const Key('login-code-field'),
                            shellKey: const Key('login-code-field-shell'),
                            labelKey: const Key('login-code-label'),
                            controller: _code,
                            enabled: !busy,
                            label: l10n.authLoginCodeLabel,
                            hintText: l10n.authLoginCodeHint,
                            keyboardType: TextInputType.number,
                            validator: _validateCode,
                            colors: c,
                            suffix: SendCodeButton(
                              key: const Key('login-send-code'),
                              label: sendCodeLabel,
                              loading: st.codeLoading,
                              enabled: !busy && st.codeCountdown == 0,
                              onPressed: _sendLoginCode,
                              colors: c,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 18, 22, 0),
                    child: GradientPrimaryButton(
                      key: const Key('login-submit'),
                      label: l10n.authLoginButton,
                      loading: st.emailLoading,
                      onPressed: busy ? null : _submitEmail,
                      colors: c,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 14, 22, 0),
                    child: Row(
                      children: <Widget>[
                        Expanded(
                          child: Divider(color: c.borderSoft, height: 1),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(
                            l10n.authLoginOr,
                            style: TextStyle(color: c.textFaint, fontSize: 11),
                          ),
                        ),
                        Expanded(
                          child: Divider(color: c.borderSoft, height: 1),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                    child: TelegramGhostButton(
                      key: const Key('login-telegram'),
                      label: l10n.authLoginTelegramButton,
                      loading: st.telegramLoading,
                      onPressed: busy ? null : _submitTelegram,
                      colors: c,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 14, 22, 0),
                    child: TermsLine(
                      onTermsTap: _onTermsTap,
                      onPrivacyTap: _onPrivacyTap,
                      colors: c,
                      l10n: l10n,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

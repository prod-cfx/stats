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
  final TextEditingController _password = TextEditingController();
  final TextEditingController _betaCode = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _betaCode.dispose();
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

  String? _validatePassword(String? v) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return l10n.authRegisterPasswordRequired;
    if (v.length < 6) return l10n.authRegisterPasswordInvalid;
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

  Future<void> _submitRegister() async {
    if (!_formKey.currentState!.validate()) return;
    final String beta = _betaCode.text.trim();
    final bool ok = await _controller.submitRegister(
      email: _email.text.trim(),
      password: _password.text,
      betaCode: beta.isEmpty ? null : beta,
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
    final String prefix = switch (st.errorPrefixKind) {
      LoginErrorKind.telegram => l10n.authTelegramLoginFailedPrefix,
      LoginErrorKind.register => l10n.authRegisterFailedPrefix,
      LoginErrorKind.login => l10n.authLoginFailedPrefix,
    };
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$prefix$msg')));
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

  void _showRegisterComingSoon() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).authRegisterComingSoonTitle),
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
    final bool isRegister = st.mode == AuthSheetMode.register;
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
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                    child: _AuthModeToggle(
                      mode: st.mode,
                      enabled: !busy,
                      loginLabel: l10n.authRegisterTabLogin,
                      registerLabel: l10n.authRegisterTabRegister,
                      onChanged: _controller.setMode,
                      colors: c,
                    ),
                  ),
                  Stack(
                    children: <Widget>[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(22, 14, 22, 0),
                            child: Form(
                              key: _formKey,
                              autovalidateMode:
                                  AutovalidateMode.onUserInteraction,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: <Widget>[
                                  LoginTextField(
                                    fieldKey: const Key('login-email-field'),
                                    shellKey: const Key(
                                      'login-email-field-shell',
                                    ),
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
                                  if (isRegister) ...<Widget>[
                                    LoginTextField(
                                      fieldKey: const Key(
                                        'register-password-field',
                                      ),
                                      shellKey: const Key(
                                        'register-password-field-shell',
                                      ),
                                      labelKey: const Key(
                                        'register-password-label',
                                      ),
                                      controller: _password,
                                      enabled: !busy,
                                      label: l10n.authRegisterPasswordLabel,
                                      hintText: l10n.authRegisterPasswordHint,
                                      obscureText: true,
                                      validator: _validatePassword,
                                      colors: c,
                                    ),
                                    const SizedBox(height: 10),
                                    LoginTextField(
                                      fieldKey: const Key(
                                        'register-beta-code-field',
                                      ),
                                      shellKey: const Key(
                                        'register-beta-code-field-shell',
                                      ),
                                      labelKey: const Key(
                                        'register-beta-code-label',
                                      ),
                                      controller: _betaCode,
                                      enabled: !busy,
                                      label: l10n.authRegisterBetaCodeLabel,
                                      hintText: l10n.authRegisterBetaCodeHint,
                                      validator: (_) => null,
                                      colors: c,
                                    ),
                                  ] else
                                    LoginTextField(
                                      fieldKey: const Key('login-code-field'),
                                      shellKey: const Key(
                                        'login-code-field-shell',
                                      ),
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
                              key: isRegister
                                  ? const Key('register-submit')
                                  : const Key('login-submit'),
                              label: isRegister
                                  ? l10n.authRegisterButton
                                  : l10n.authLoginButton,
                              loading: isRegister
                                  ? st.registerLoading
                                  : st.emailLoading,
                              onPressed: busy
                                  ? null
                                  : (isRegister
                                        ? _submitRegister
                                        : _submitEmail),
                              colors: c,
                            ),
                          ),
                        ],
                      ),
                      if (isRegister)
                        Positioned.fill(
                          child: _RegisterComingSoonOverlay(
                            colors: c,
                            title: l10n.authRegisterComingSoonTitle,
                            subtitle: l10n.authRegisterComingSoonSubtitle,
                            onTap: _showRegisterComingSoon,
                          ),
                        ),
                    ],
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

class _RegisterComingSoonOverlay extends StatelessWidget {
  const _RegisterComingSoonOverlay({
    required this.colors,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final QzColorScheme colors;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: title,
      child: Material(
        color: colors.bgElev.withValues(alpha: 0.68),
        child: InkWell(
          key: const Key('login-sheet-register-coming-soon-overlay'),
          onTap: onTap,
          child: Center(
            child: Container(
              key: const Key('login-sheet-register-coming-soon-message'),
              margin: const EdgeInsets.symmetric(horizontal: 26),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
              decoration: BoxDecoration(
                color: colors.bgElev.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.borderSoft),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Color(0x24000000),
                    blurRadius: 18,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(Icons.lock_clock, color: colors.accent, size: 22),
                  const SizedBox(height: 8),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: colors.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: colors.textDim,
                      fontSize: 12,
                      height: 1.4,
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

/// 登录/注册分段切换。两段等宽，选中段高亮。
class _AuthModeToggle extends StatelessWidget {
  const _AuthModeToggle({
    required this.mode,
    required this.enabled,
    required this.loginLabel,
    required this.registerLabel,
    required this.onChanged,
    required this.colors,
  });

  final AuthSheetMode mode;
  final bool enabled;
  final String loginLabel;
  final String registerLabel;
  final ValueChanged<AuthSheetMode> onChanged;
  final QzColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.bgSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.borderSoft),
      ),
      child: Row(
        children: <Widget>[
          _segment(
            key: const Key('auth-mode-login'),
            label: loginLabel,
            selected: mode == AuthSheetMode.login,
            target: AuthSheetMode.login,
          ),
          _segment(
            key: const Key('auth-mode-register'),
            label: registerLabel,
            selected: mode == AuthSheetMode.register,
            target: AuthSheetMode.register,
          ),
        ],
      ),
    );
  }

  Widget _segment({
    required Key key,
    required String label,
    required bool selected,
    required AuthSheetMode target,
  }) {
    return Expanded(
      child: GestureDetector(
        key: key,
        onTap: enabled && !selected ? () => onChanged(target) : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? colors.bgElev : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? colors.text : colors.textDim,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

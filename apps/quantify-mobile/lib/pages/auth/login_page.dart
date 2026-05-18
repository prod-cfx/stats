import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth/session_controller.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';

/// 原型 07 屏登录页。
///
/// 视觉重点：accent 渐变主按钮 + ghost Telegram 一键登录。表单字段做前端
/// 校验（邮箱格式、密码 6+）；提交走 [SessionController.loginEmail]，成功后
/// `context.go('/ai')` 跳到默认落地。失败走 SnackBar。
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  static final RegExp _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _emailLoading = false;
  bool _telegramLoading = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  String? _validateEmail(String? v) {
    if (v == null || v.isEmpty) return '请输入邮箱';
    if (!_emailRe.hasMatch(v)) return '邮箱格式不正确';
    return null;
  }

  String? _validatePassword(String? v) {
    if (v == null || v.isEmpty) return '请输入密码';
    if (v.length < 6) return '密码至少 6 位';
    return null;
  }

  Future<void> _submitEmail() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _emailLoading = true);
    try {
      await ref.read(sessionControllerProvider.notifier).loginEmail(
            email: _email.text.trim(),
            password: _password.text,
          );
      if (!mounted) return;
      context.go('/ai');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('登录失败：$e')),
      );
    } finally {
      if (mounted) setState(() => _emailLoading = false);
    }
  }

  Future<void> _submitTelegram() async {
    setState(() => _telegramLoading = true);
    try {
      await ref.read(sessionControllerProvider.notifier).loginTelegram();
      if (!mounted) return;
      context.go('/ai');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Telegram 登录失败：$e')),
      );
    } finally {
      if (mounted) setState(() => _telegramLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool busy = _emailLoading || _telegramLoading;

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bg,
        elevation: 0,
        title: const Text('登录'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: QzSpacing.xl,
          ),
          child: Form(
            key: _formKey,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                // 品牌 logo 占位 —— 原型 07 屏顶部圆角方块。
                Center(
                  child: Container(
                    key: const ValueKey<String>('login-brand'),
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      gradient: c.accentGrad,
                      borderRadius: BorderRadius.circular(QzRadii.card),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Q',
                      style: TextStyle(
                        color: c.accentOn,
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: QzSpacing.lg),
                Center(
                  child: Text(
                    '欢迎回到 Quantify',
                    style: TextStyle(
                      color: c.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: QzSpacing.xl),

                TextFormField(
                  key: const ValueKey<String>('login-email-field'),
                  controller: _email,
                  enabled: !busy,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: '邮箱',
                    hintText: 'you@example.com',
                  ),
                  validator: _validateEmail,
                ),
                const SizedBox(height: QzSpacing.md),

                TextFormField(
                  key: const ValueKey<String>('login-password-field'),
                  controller: _password,
                  enabled: !busy,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: '密码',
                    hintText: '至少 6 位',
                  ),
                  validator: _validatePassword,
                ),
                const SizedBox(height: QzSpacing.lg),

                QzButton(
                  key: const ValueKey<String>('login-submit'),
                  label: '登录',
                  variant: QzButtonVariant.accent,
                  expanded: true,
                  loading: _emailLoading,
                  onPressed: busy ? null : _submitEmail,
                ),
                const SizedBox(height: QzSpacing.lg),

                Row(
                  children: <Widget>[
                    Expanded(child: Divider(color: c.border, height: 1)),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: QzSpacing.sm,
                      ),
                      child: Text(
                        '或',
                        style: TextStyle(color: c.textDim, fontSize: 12),
                      ),
                    ),
                    Expanded(child: Divider(color: c.border, height: 1)),
                  ],
                ),
                const SizedBox(height: QzSpacing.lg),

                QzButton(
                  key: const ValueKey<String>('login-telegram'),
                  label: '使用 Telegram 一键登录',
                  variant: QzButtonVariant.ghost,
                  expanded: true,
                  loading: _telegramLoading,
                  onPressed: busy ? null : _submitTelegram,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

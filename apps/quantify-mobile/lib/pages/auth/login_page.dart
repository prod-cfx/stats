import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth/session_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';

/// 原型 m-screens-1 第 1 屏登录页 —— 沉浸式渐变 hero 风格。
///
/// 视觉重点：
/// - 顶部 300px 紫色径向渐变 hero + 同心圆装饰 + 白底紫色 Logo 方块（量化折线）
/// - 大标题「把交易想法 / 变成可回测的策略」 + 副标题「对话生成 · 历史回测 · API 部署」
/// - 表单：邮箱 + 密码
/// - 主按钮：渐变样式（accentGrad）；OR 分割线；Telegram ghost 按钮
/// - 底部「继续即表示同意 服务条款 与 隐私政策」（mock 跳转，仅 SnackBar 提示）
///
/// 适配深浅主题：hero 永远是深色渐变（品牌表达），表单区跟随主题；statusBar
/// 透明 + content extend，去掉 AppBar。
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
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return l10n.authLoginEmailRequired;
    if (!_emailRe.hasMatch(v)) return l10n.authLoginEmailInvalid;
    return null;
  }

  String? _validatePassword(String? v) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (v == null || v.isEmpty) return l10n.authLoginPasswordRequired;
    if (v.length < 6) return l10n.authLoginPasswordTooShort;
    return null;
  }

  Future<void> _submitEmail() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _emailLoading = true);
    try {
      await ref
          .read(sessionControllerProvider.notifier)
          .loginEmail(email: _email.text.trim(), password: _password.text);
      if (!mounted) return;
      context.go('/ai');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${AppLocalizations.of(context).authLoginFailedPrefix}$e',
          ),
        ),
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
        SnackBar(
          content: Text(
            '${AppLocalizations.of(context).authTelegramLoginFailedPrefix}$e',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _telegramLoading = false);
    }
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
    final bool busy = _emailLoading || _telegramLoading;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // hero 永远是深色，statusBar 文字反白；底部跟随主题。
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: c.bg,
        systemNavigationBarIconBrightness: c.brightness == Brightness.dark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: c.bg,
        // 沉浸：无 AppBar，靠下方 SafeArea(top: false) 让内容自然延伸到 statusBar。
        body: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _Hero(key: const ValueKey<String>('login-hero'), l10n: l10n),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    QzSpacing.lg,
                    QzSpacing.lg,
                    QzSpacing.lg,
                    QzSpacing.lg,
                  ),
                  child: _LoginForm(
                    formKey: _formKey,
                    email: _email,
                    password: _password,
                    busy: busy,
                    emailLoading: _emailLoading,
                    telegramLoading: _telegramLoading,
                    validateEmail: _validateEmail,
                    validatePassword: _validatePassword,
                    onSubmitEmail: _submitEmail,
                    onSubmitTelegram: _submitTelegram,
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
    );
  }
}

/// 顶部 300px 渐变 hero —— 视觉是固定深色，不跟随主题切换。
class _Hero extends StatelessWidget {
  const _Hero({super.key, required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 300,
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          // 渐变背景：线性底色 + 两个紫色径向高光。
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-0.5, -1.0), // ≈ 160deg
                end: Alignment(0.5, 1.0),
                colors: <Color>[
                  Color(0xFF0F0B22),
                  Color(0xFF1A1240),
                  Color(0xFF271A66),
                ],
                stops: <double>[0.0, 0.6, 1.0],
              ),
            ),
          ),
          // 同心圆装饰：右上角发散，淡紫透明描边。
          const Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(painter: _ConcentricRingsPainter()),
            ),
          ),
          // 右上方径向高光 1
          Positioned(
            top: -160,
            right: -120,
            child: Container(
              width: 420,
              height: 420,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: <Color>[
                    const Color(0xFFA78BFA).withValues(alpha: 0.35),
                    const Color(0xFFA78BFA).withValues(alpha: 0.0),
                  ],
                  stops: const <double>[0.0, 0.6],
                ),
              ),
            ),
          ),
          // 左下方径向高光 2
          Positioned(
            bottom: -120,
            left: -100,
            child: Container(
              width: 360,
              height: 360,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: <Color>[
                    const Color(0xFF7C5CFF).withValues(alpha: 0.30),
                    const Color(0xFF7C5CFF).withValues(alpha: 0.0),
                  ],
                  stops: const <double>[0.0, 0.6],
                ),
              ),
            ),
          ),
          // 内容层：Logo + 标题 + 副标题
          Positioned(
            left: QzSpacing.lg,
            right: QzSpacing.lg,
            top: 62,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    _BrandLogoMark(key: const ValueKey<String>('login-brand')),
                    const SizedBox(width: QzSpacing.sm),
                    const Text(
                      'Quantify',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 64),
                Text(
                  l10n.authLoginHeroTitleLine1,
                  key: const ValueKey<String>('login-hero-title-1'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                    letterSpacing: -0.4,
                  ),
                ),
                Text(
                  l10n.authLoginHeroTitleLine2,
                  key: const ValueKey<String>('login-hero-title-2'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.authLoginHeroSubtitle,
                  key: const ValueKey<String>('login-hero-subtitle'),
                  style: const TextStyle(
                    color: Color(0xFFC7C0EE),
                    fontSize: 13,
                    height: 1.6,
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

/// 32x32 Logo 方块：白渐底 + 紫色折线图标（量化折线，非单字母）。
/// 折线坐标对应原型 SVG path：M4 14 l5 -5 l4 4 l7 -7 + 右上角箭头 M14 6 h6 v6。
class _BrandLogoMark extends StatelessWidget {
  const _BrandLogoMark({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(9),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[Color(0xFFFFFFFF), Color(0xFFDDD6FE)],
        ),
      ),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 16,
        height: 16,
        child: CustomPaint(painter: _LogoChartPainter()),
      ),
    );
  }
}

class _LogoChartPainter extends CustomPainter {
  const _LogoChartPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final Paint p = Paint()
      ..color = const Color(0xFF5B21B6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final double s = size.width / 24.0;
    final Path line = Path()
      ..moveTo(4 * s, 14 * s)
      ..lineTo(9 * s, 9 * s)
      ..lineTo(13 * s, 13 * s)
      ..lineTo(20 * s, 6 * s);
    canvas.drawPath(line, p);
    final Path arrow = Path()
      ..moveTo(14 * s, 6 * s)
      ..lineTo(20 * s, 6 * s)
      ..lineTo(20 * s, 12 * s);
    canvas.drawPath(arrow, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// 同心圆装饰：右上角发散，5 圈，渐变描边。
class _ConcentricRingsPainter extends CustomPainter {
  const _ConcentricRingsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // 视口 viewBox 402x300，将圆心 (320, 40) 等比映射到当前尺寸。
    final double sx = size.width / 402.0;
    final double sy = size.height / 300.0;
    final Offset center = Offset(320 * sx, 40 * sy);
    // 不使用 shader：Skia 中 shader 优先级高于 color，逐圈 alpha 会失效。
    // 改为纯紫描边 + 逐圈降低 alpha 实现"由内向外渐隐"。
    const Color base = Color(0xFFA78BFA);
    const List<double> radii = <double>[60, 110, 170, 240, 310];
    for (int i = 0; i < radii.length; i++) {
      // i=0 → 0.40，i=4 → 0.08，线性衰减。
      final double alpha = 0.40 - i * 0.08;
      final Paint p = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = base.withValues(alpha: alpha);
      canvas.drawCircle(center, radii[i] * sx, p);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// 拆出表单子组件，避免主 build 嵌套过深。
class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.formKey,
    required this.email,
    required this.password,
    required this.busy,
    required this.emailLoading,
    required this.telegramLoading,
    required this.validateEmail,
    required this.validatePassword,
    required this.onSubmitEmail,
    required this.onSubmitTelegram,
    required this.onTermsTap,
    required this.onPrivacyTap,
    required this.colors,
    required this.l10n,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController email;
  final TextEditingController password;
  final bool busy;
  final bool emailLoading;
  final bool telegramLoading;
  final FormFieldValidator<String> validateEmail;
  final FormFieldValidator<String> validatePassword;
  final VoidCallback onSubmitEmail;
  final VoidCallback onSubmitTelegram;
  final VoidCallback onTermsTap;
  final VoidCallback onPrivacyTap;
  final QzColorScheme colors;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = colors;
    return Form(
      key: formKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 欢迎语
          Text(
            l10n.authLoginWelcome,
            key: const ValueKey<String>('login-welcome-title'),
            style: TextStyle(
              color: c.text,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            l10n.authLoginWelcomeSubtitle,
            key: const ValueKey<String>('login-welcome-subtitle'),
            style: TextStyle(color: c.textDim, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: QzSpacing.lg),
          TextFormField(
            key: const ValueKey<String>('login-email-field'),
            controller: email,
            enabled: !busy,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: l10n.authLoginEmailLabel,
              hintText: 'you@example.com',
            ),
            validator: validateEmail,
          ),
          const SizedBox(height: QzSpacing.md),
          TextFormField(
            key: const ValueKey<String>('login-password-field'),
            controller: password,
            enabled: !busy,
            obscureText: true,
            decoration: InputDecoration(
              labelText: l10n.authLoginPasswordLabel,
              hintText: l10n.authLoginPasswordHint,
            ),
            validator: validatePassword,
          ),
          const SizedBox(height: QzSpacing.lg),

          // 渐变主按钮 —— 走原生 Material InkWell + Ink 渲染，避免 QzButton
          // 默认 accent variant 是纯色填充。
          _GradientPrimaryButton(
            key: const ValueKey<String>('login-submit'),
            label: l10n.authLoginButton,
            loading: emailLoading,
            onPressed: busy ? null : onSubmitEmail,
            colors: c,
          ),
          const SizedBox(height: QzSpacing.md),

          // OR 分割线
          Row(
            children: <Widget>[
              Expanded(child: Divider(color: c.border, height: 1)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
                child: Text(
                  l10n.authLoginOr,
                  style: TextStyle(color: c.textDim, fontSize: 12),
                ),
              ),
              Expanded(child: Divider(color: c.border, height: 1)),
            ],
          ),
          const SizedBox(height: QzSpacing.md),

          // Telegram 一键登录（保留）
          _GhostButton(
            key: const ValueKey<String>('login-telegram'),
            label: l10n.authLoginTelegramButton,
            loading: telegramLoading,
            onPressed: busy ? null : onSubmitTelegram,
            colors: c,
          ),
          const SizedBox(height: QzSpacing.sm),

          // 服务条款 / 隐私政策（mock 跳转）
          _TermsLine(
            key: const ValueKey<String>('login-terms'),
            onTermsTap: onTermsTap,
            onPrivacyTap: onPrivacyTap,
            colors: c,
            l10n: l10n,
          ),
        ],
      ),
    );
  }
}

/// 渐变主按钮 —— 用 InkWell 包 Ink + DecoratedBox 实现，按下也有 ripple。
class _GradientPrimaryButton extends StatelessWidget {
  const _GradientPrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    required this.colors,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;
  final QzColorScheme colors;

  @override
  Widget build(BuildContext context) {
    final bool disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.6 : 1.0,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: 50,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: colors.accentGrad,
            boxShadow: <BoxShadow>[colors.accentShadow],
          ),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(14),
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GhostButton extends StatelessWidget {
  const _GhostButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    required this.colors,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;
  final QzColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: colors.bgElev,
          side: BorderSide(color: colors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          foregroundColor: colors.text,
        ),
        child: loading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(colors.text),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(Icons.send, size: 16, color: const Color(0xFF2AABEE)),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// 服务条款 / 隐私政策行 —— 使用 TapGestureRecognizer 让 TextSpan 内可点击。
/// stateful 是为了拿到 recognizer 的生命周期：随 widget dispose 一并释放。
class _TermsLine extends StatefulWidget {
  const _TermsLine({
    super.key,
    required this.onTermsTap,
    required this.onPrivacyTap,
    required this.colors,
    required this.l10n,
  });

  final VoidCallback onTermsTap;
  final VoidCallback onPrivacyTap;
  final QzColorScheme colors;
  final AppLocalizations l10n;

  @override
  State<_TermsLine> createState() => _TermsLineState();
}

class _TermsLineState extends State<_TermsLine> {
  late final TapGestureRecognizer _termsTap = TapGestureRecognizer()
    ..onTap = () => widget.onTermsTap();
  late final TapGestureRecognizer _privacyTap = TapGestureRecognizer()
    ..onTap = () => widget.onPrivacyTap();

  @override
  void dispose() {
    _termsTap.dispose();
    _privacyTap.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final TextStyle linkStyle = TextStyle(
      color: widget.colors.accent,
      fontSize: 11,
      height: 1.6,
    );
    final TextStyle baseStyle = TextStyle(
      color: widget.colors.textDim,
      fontSize: 11,
      height: 1.6,
    );
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text.rich(
        TextSpan(
          children: <InlineSpan>[
            TextSpan(text: widget.l10n.authLoginTermsPrefix, style: baseStyle),
            TextSpan(
              text: widget.l10n.authLoginTermsLink,
              style: linkStyle,
              recognizer: _termsTap,
            ),
            TextSpan(text: widget.l10n.authLoginTermsAnd, style: baseStyle),
            TextSpan(
              text: widget.l10n.authLoginPrivacyLink,
              style: linkStyle,
              recognizer: _privacyTap,
            ),
          ],
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

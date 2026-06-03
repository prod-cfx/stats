import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/tokens.dart';

class LoginLogoMark extends StatelessWidget {
  const LoginLogoMark({super.key, this.size = 34, this.radius = 10});

  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('login-brand'),
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFFA78BFA), Color(0xFF06B6D4)],
        ),
      ),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 16,
        height: 16,
        child: CustomPaint(painter: LoginLogoChartPainter()),
      ),
    );
  }
}

class LoginLogoChartPainter extends CustomPainter {
  const LoginLogoChartPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final Paint p = Paint()
      ..color = Colors.white
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
    final Path arrow = Path()
      ..moveTo(14 * s, 6 * s)
      ..lineTo(20 * s, 6 * s)
      ..lineTo(20 * s, 12 * s);
    canvas.drawPath(line, p);
    canvas.drawPath(arrow, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class LoginTextField extends StatelessWidget {
  const LoginTextField({
    super.key,
    required this.fieldKey,
    required this.shellKey,
    required this.labelKey,
    required this.controller,
    required this.enabled,
    required this.label,
    required this.hintText,
    required this.validator,
    required this.colors,
    this.keyboardType,
    this.suffix,
  });

  final Key fieldKey;
  final Key shellKey;
  final Key labelKey;
  final TextEditingController controller;
  final bool enabled;
  final String label;
  final String hintText;
  final FormFieldValidator<String> validator;
  final QzColorScheme colors;
  final TextInputType? keyboardType;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          key: labelKey,
          style: TextStyle(
            color: colors.textMid,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          key: shellKey,
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: colors.bgSoft,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: colors.borderSoft),
          ),
          alignment: Alignment.center,
          child: Row(
            children: <Widget>[
              Expanded(
                child: TextFormField(
                  key: fieldKey,
                  controller: controller,
                  enabled: enabled,
                  keyboardType: keyboardType,
                  autocorrect: false,
                  style: TextStyle(color: colors.text, fontSize: 14),
                  decoration: InputDecoration(
                    filled: false,
                    fillColor: Colors.transparent,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    hintText: hintText,
                    hintStyle: TextStyle(color: colors.textFaint, fontSize: 14),
                  ),
                  validator: validator,
                ),
              ),
              if (suffix != null) ...<Widget>[
                const SizedBox(width: 10),
                suffix!,
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class SendCodeButton extends StatelessWidget {
  const SendCodeButton({
    super.key,
    required this.label,
    required this.loading,
    required this.enabled,
    required this.onPressed,
    required this.colors,
  });

  final String label;
  final bool loading;
  final bool enabled;
  final VoidCallback onPressed;
  final QzColorScheme colors;

  @override
  Widget build(BuildContext context) {
    final bool disabled = !enabled || loading;
    return SizedBox(
      height: 32,
      child: OutlinedButton(
        onPressed: disabled ? null : onPressed,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          minimumSize: const Size(0, 32),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          backgroundColor: disabled ? Colors.transparent : colors.accentSoft,
          foregroundColor: disabled ? colors.textFaint : colors.accent,
          side: BorderSide(color: colors.borderSoft),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: loading
            ? SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(colors.accent),
                ),
              )
            : Text(
                label,
                style: TextStyle(
                  color: disabled ? colors.textFaint : colors.accent,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  fontFamily: QzFont.mono,
                ),
                maxLines: 1,
                overflow: TextOverflow.clip,
              ),
      ),
    );
  }
}

class GradientPrimaryButton extends StatelessWidget {
  const GradientPrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    required this.colors,
    this.height = 48,
    this.radius = 12,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;
  final QzColorScheme colors;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final bool disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.6 : 1.0,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(radius),
        child: Ink(
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: colors.accentGrad,
            boxShadow: <BoxShadow>[colors.accentShadow],
          ),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(radius),
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

class TelegramGhostButton extends StatelessWidget {
  const TelegramGhostButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    required this.colors,
    this.height = 44,
    this.radius = 12,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;
  final QzColorScheme colors;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: colors.bgElev,
          side: BorderSide(color: colors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
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
                  const SizedBox(
                    key: Key('login-telegram-logo'),
                    width: 20,
                    height: 20,
                    child: CustomPaint(painter: TelegramLogoPainter()),
                  ),
                  const SizedBox(width: 10),
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

class TelegramLogoPainter extends CustomPainter {
  const TelegramLogoPainter();

  static const Color _brand = Color(0xFF2AABEE);

  @override
  void paint(Canvas canvas, Size size) {
    final double s = size.width / 24.0;
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      size.width / 2,
      Paint()..color = _brand,
    );
    final Path mark = Path()
      ..moveTo(17.6 * s, 8.2 * s)
      ..lineTo(15.7 * s, 17.0 * s)
      ..cubicTo(15.6 * s, 17.6 * s, 15.2 * s, 17.8 * s, 14.7 * s, 17.5 * s)
      ..lineTo(11.9 * s, 15.4 * s)
      ..lineTo(10.5 * s, 16.7 * s)
      ..cubicTo(10.3 * s, 16.9 * s, 10.2 * s, 17.0 * s, 9.9 * s, 17.0 * s)
      ..lineTo(10.1 * s, 14.1 * s)
      ..lineTo(15.4 * s, 9.3 * s)
      ..cubicTo(15.6 * s, 9.1 * s, 15.4 * s, 9.0 * s, 15.1 * s, 9.2 * s)
      ..lineTo(8.5 * s, 13.3 * s)
      ..lineTo(5.6 * s, 12.4 * s)
      ..cubicTo(5.0 * s, 12.2 * s, 5.0 * s, 11.8 * s, 5.7 * s, 11.5 * s)
      ..lineTo(17.1 * s, 7.1 * s)
      ..cubicTo(17.6 * s, 6.9 * s, 18.1 * s, 7.2 * s, 17.6 * s, 8.2 * s)
      ..close();
    canvas.drawPath(mark, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class TermsLine extends StatefulWidget {
  const TermsLine({
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
  State<TermsLine> createState() => _TermsLineState();
}

class _TermsLineState extends State<TermsLine> {
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
    final TextStyle baseStyle = TextStyle(
      color: widget.colors.textDim,
      fontSize: 11,
      height: 1.6,
    );
    final TextStyle linkStyle = baseStyle.copyWith(
      color: widget.colors.accent,
      fontWeight: FontWeight.w500,
    );
    return Text.rich(
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
      key: const Key('login-terms'),
      textAlign: TextAlign.center,
    );
  }
}

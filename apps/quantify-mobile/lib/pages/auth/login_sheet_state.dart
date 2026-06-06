import 'package:flutter/foundation.dart';

/// 登录失败的来源，决定 widget 选哪条前缀文案
/// （`authLoginFailedPrefix` / `authTelegramLoginFailedPrefix` /
/// `authRegisterFailedPrefix`）。
enum LoginErrorKind { login, telegram, register }

/// 登录面板当前模式：邮箱验证码登录 / 邮箱密码注册。
enum AuthSheetMode { login, register }

/// `login_sheet` 的不可变流程/异步态（issue #2187 三件套 + #2260 注册）。
///
/// 承载表单模式与异步 loading：发码/邮箱登录/Telegram 登录/注册的 loading、
/// 验证码已发标记与倒计时秒数，以及一次性错误信号。`TextEditingController` /
/// `GlobalKey<FormState>` 等输入控制器按范式留在 widget。
///
/// 错误以「epoch 计数 + message + kind」三元组承载：controller 落错时
/// [errorEpoch] 自增，widget `ref.listen(select(errorEpoch))` 触发一次 toast，
/// 避免重建重弹。
@immutable
class LoginSheetState {
  const LoginSheetState({
    this.mode = AuthSheetMode.login,
    this.emailLoading = false,
    this.codeLoading = false,
    this.telegramLoading = false,
    this.registerLoading = false,
    this.codeSent = false,
    this.codeCountdown = 0,
    this.errorMessage,
    this.errorPrefixKind = LoginErrorKind.login,
    this.errorEpoch = 0,
  });

  /// 当前面板模式（登录 / 注册）。
  final AuthSheetMode mode;

  final bool emailLoading;
  final bool codeLoading;
  final bool telegramLoading;
  final bool registerLoading;
  final bool codeSent;
  final int codeCountdown;

  /// 最近一次错误的展示文案（已经 `ErrorRouter.normalize`）；null = 无错。
  final String? errorMessage;

  /// 最近一次错误的来源，决定 widget 前缀文案。
  final LoginErrorKind errorPrefixKind;

  /// 错误信号计数：每落一次错自增，供 widget `select` 去重消费。
  final int errorEpoch;

  /// 任一异步动作进行中——widget 据此禁用全部按钮/输入。
  bool get busy =>
      emailLoading || codeLoading || telegramLoading || registerLoading;

  LoginSheetState copyWith({
    AuthSheetMode? mode,
    bool? emailLoading,
    bool? codeLoading,
    bool? telegramLoading,
    bool? registerLoading,
    bool? codeSent,
    int? codeCountdown,
    String? errorMessage,
    LoginErrorKind? errorPrefixKind,
    int? errorEpoch,
  }) {
    return LoginSheetState(
      mode: mode ?? this.mode,
      emailLoading: emailLoading ?? this.emailLoading,
      codeLoading: codeLoading ?? this.codeLoading,
      telegramLoading: telegramLoading ?? this.telegramLoading,
      registerLoading: registerLoading ?? this.registerLoading,
      codeSent: codeSent ?? this.codeSent,
      codeCountdown: codeCountdown ?? this.codeCountdown,
      errorMessage: errorMessage ?? this.errorMessage,
      errorPrefixKind: errorPrefixKind ?? this.errorPrefixKind,
      errorEpoch: errorEpoch ?? this.errorEpoch,
    );
  }
}

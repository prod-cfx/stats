import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';

import '../../data/auth/session_controller.dart';
import '../../data/models/account_models.dart';
import '../../data/models/api_key_models.dart';
import '../../domain/models/live_strategy_models.dart';
import '../../domain/use_cases/live_strategy_use_cases.dart';
import '../../data/providers.dart';
import '../../data/services/api_client.dart';
import '../../data/utils/mask_helpers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_grab_handle.dart';
import '../../widgets/qz_toast.dart';
import '../live/widgets/live_status_style.dart';
import 'api_form_sheet.dart';
import 'widgets/qz_account_header.dart';
import 'widgets/qz_exchange_logo.dart';
import 'widgets/qz_section_title.dart';
import 'widgets/qz_settings_row.dart';
part 'me_home_page.content.part.dart';
part 'me_home_page.settings.part.dart';

/// 「我的」页（原型 `m-screens-4.jsx` 第 9 屏）。
///
/// 结构：紫色 header → 三栏统计卡 → 账户分组 → 交易所 API 摘要
/// → 偏好（语言/主题/通知）→ 退出登录 → 版本号。
///
/// 退出登录依赖 `sessionControllerProvider.logout()` 把 session 置 null。
/// 入口收口在 app router/shell：匿名回到策略 guest 态，关键入口弹 LoginSheet。
class MeHomePage extends ConsumerWidget {
  const MeHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<AccountInfo> info = ref.watch(accountInfoProvider);
    final AsyncValue<List<ExchangeApiKey>> keys = ref.watch(apiKeysProvider);

    return Scaffold(
      backgroundColor: c.bg,
      body: _Content(info: info, apiKeys: keys),
    );
  }
}

String _safeLoadErrorMessage(Object error) {
  if (error is ApiException) return error.message;
  if (error is DioException) {
    final Object? inner = error.error;
    if (inner is ApiException) return inner.message;
    return ApiException.fromDio(error).message;
  }
  final String text = error.toString();
  return _looksUnsafeForUi(text) ? '请求失败，请稍后重试' : text;
}

bool _looksUnsafeForUi(String text) {
  final String lower = text.toLowerCase();
  return text.length > 160 ||
      lower.contains('<!doctype html') ||
      lower.contains('<html') ||
      lower.contains('<body') ||
      lower.contains('<script');
}

/// 统计卡相对于 header 的垂直叠加偏移（原型 `m-screens-4.jsx:992` `marginTop:-26`）。
const double _statsCardOverlap = -26;

/// 偏好分组「语言」行选中值的轻量 Notifier（替代 3.0 legacy `StateProvider`）。
/// 仅承载选中值，行为对外零变化：消费方 watch 值、`set` 写入。
class LanguageNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? value) => state = value;
}

/// 偏好分组「语言」行的选中值（UI 会话态）。
///
/// 当前 app locale 在 `main.dart` 硬锁 `Locale('zh')`，无应用级语言切换基建
/// （tracking #1515 follow-up）。本 provider 仅承载抽屉选中值回显，**不实际
/// 切换 locale**；待 locale 基建接通后改为驱动真实 `localeProvider`。
/// 默认值在 widget 内由 `meSettingsLanguageOptionZh` 回填（避免在此硬编码文案）。
final NotifierProvider<LanguageNotifier, String?> selectedLanguageProvider =
    NotifierProvider<LanguageNotifier, String?>(LanguageNotifier.new);

/// 弹出语言底部抽屉（简体中文 / English 单选 + 勾选态 + 取消），结构对齐
/// 设计稿 `m-screens-4.jsx:2640-2730`。返回所选项；点取消 / 点遮罩返回 null。
Future<void> showLanguageSheet(BuildContext context, WidgetRef ref) async {
  final AppLocalizations l10n = AppLocalizations.of(context);
  final QzColorScheme c = context.qzScheme;
  final String current =
      ref.read(selectedLanguageProvider) ?? l10n.meSettingsLanguageOptionZh;
  final List<String> options = <String>[
    l10n.meSettingsLanguageOptionZh,
    l10n.meSettingsLanguageOptionEn,
  ];

  final String? picked = await showModalBottomSheet<String>(
    context: context,
    useRootNavigator: true,
    backgroundColor: c.bgElev,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (BuildContext sheetCtx) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const QzGrabHandle(margin: EdgeInsets.fromLTRB(0, 10, 0, 0)),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                12,
                QzSpacing.lg,
                6,
              ),
              child: Text(
                l10n.meSettingsLanguageSheetTitle,
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            for (final String o in options)
              _LanguageOptionRow(
                label: o,
                selected: o == current,
                onTap: () => Navigator.of(sheetCtx).pop(o),
                c: c,
              ),
            Divider(height: 1, color: c.borderSoft),
            TextButton(
              onPressed: () => Navigator.of(sheetCtx).pop(),
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                foregroundColor: c.text,
              ),
              child: Text(
                l10n.commonCancel,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    },
  );

  // await 后用户可能已导航离开（router redirect / 返回手势），widget 已
  // dispose；缺 mounted 检查时写 ref 会触发 `Cannot use "ref" after the
  // widget was disposed` StateError。与同文件 `_openSheet` 的守卫一致。
  if (picked != null && context.mounted) {
    ref.read(selectedLanguageProvider.notifier).set(picked);
  }
}

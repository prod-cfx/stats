import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth/session_controller.dart';
import '../../data/models/account_models.dart';
import '../../data/models/api_key_models.dart';
import '../../data/providers.dart';
import '../../data/utils/mask_helpers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
import 'api_form_sheet.dart';
import 'widgets/qz_account_header.dart';
import 'widgets/qz_section_title.dart';
import 'widgets/qz_settings_row.dart';

/// 「我的」页（原型 `m-screens-4.jsx` 第 9 屏）。
///
/// 结构：紫色 header → 三栏统计卡 → 账户分组 → 交易所 API 摘要
/// → 偏好（语言/主题/通知）→ 退出登录 → 版本号。
///
/// 退出登录依赖 `sessionControllerProvider.logout()` 把 session 置 null，
/// router 的 `kAuthProtectedPrefixes = ['/me']` redirect 会自动跳 `/login`。
/// **不在按钮里写 `context.go('/login')`** —— 保持单一来源（router redirect）。
class MeHomePage extends ConsumerWidget {
  const MeHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<AccountInfo> info = ref.watch(accountInfoProvider);
    final AsyncValue<List<ExchangeApiKey>> keys = ref.watch(apiKeysProvider);

    return Scaffold(
      backgroundColor: c.bg,
      body: info.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, StackTrace st) => Center(
          child: Text(
            '${AppLocalizations.of(context).meHomeLoadErrorPrefix}$e',
            style: TextStyle(color: c.statusDanger),
          ),
        ),
        data: (AccountInfo data) => _Content(info: data, apiKeys: keys),
      ),
    );
  }
}

/// 统计卡相对于 header 的垂直叠加偏移（原型 `m-screens-4.jsx:992` `marginTop:-26`）。
const double _statsCardOverlap = -26;

class _Content extends ConsumerWidget {
  const _Content({required this.info, required this.apiKeys});
  final AccountInfo info;
  final AsyncValue<List<ExchangeApiKey>> apiKeys;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // header chip 状态从真实数据派生：binance 由 apiKeys 中是否有 Binance
    // 凭据决定；telegram 当前 mobile 端无 binding 字段，按 mock fixture 的
    // `meSettingsTelegramUnbound` 一致策略，渲染 chip 仅当 binding 字段
    // 被填充。这里先以 `meSettingsTelegram` 是否非占位判断（mock 永远占位
    // → false）；待 `AccountInfo.bindings` 真接通后切换。
    final bool binanceConnected = apiKeys.maybeWhen(
      data: (List<ExchangeApiKey> list) => list.any(
        (ExchangeApiKey k) => k.exchange.toLowerCase() == 'binance',
      ),
      orElse: () => false,
    );
    // 当前 mock 已绑定 Telegram（原型 m-screens-4 第 9 屏 chip + 列表
    // `@victor_qf`）；UI 直接读 fixture 模拟值，等真接口后改读 binding。
    const bool telegramBound = true;

    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        QzAccountHeader(
          maskedEmail: maskEmail(info.email),
          uid: info.uid,
          binanceConnected: binanceConnected,
          telegramBound: telegramBound,
        ),
        Transform.translate(
          offset: const Offset(0, _statsCardOverlap),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
            child: const _StatsCard(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            QzSpacing.xxl * 4,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              QzSectionTitle(text: l10n.meSectionAccount),
              _SettingsGroup(
                children: <Widget>[
                  QzSettingsRow(label: l10n.authLoginEmailLabel, value: info.email),
                  QzSettingsRow(label: 'UID', value: info.uid, mono: true),
                  QzSettingsRow(
                    label: l10n.meSettingsTelegram,
                    // mobile 端 `AccountInfo` 未携带 telegram handle，本迭代
                    // 显示占位；后续 Issue 引入 `AccountInfo.bindings` 后切换。
                    value: l10n.meSettingsTelegramUnbound,
                    tone: QzSettingsRowTone.warn,
                    trailing: const QzSettingsCaret(),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsSecurity,
                    value: l10n.commonView,
                    trailing: const QzSettingsCaret(),
                    last: true,
                  ),
                ],
              ),
              QzSectionTitle(text: l10n.meSectionApi),
              _ApiExchangesGroup(apiKeys: apiKeys),
              QzSectionTitle(text: l10n.meSectionPreferences),
              _SettingsGroup(
                children: <Widget>[
                  QzSettingsRow(
                    label: l10n.meSettingsLanguage,
                    value: l10n.meSettingsLanguageValue,
                    trailing: const QzSettingsCaret(),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsTheme,
                    value: l10n.meSettingsThemeValue,
                    trailing: const QzSettingsCaret(),
                    onTap: () => context.push('/me/theme'),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsNotifications,
                    value: l10n.commonView,
                    trailing: const QzSettingsCaret(),
                    last: true,
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.xl),
              _LogoutButton(
                onPressed: () async {
                  await ref
                      .read(sessionControllerProvider.notifier)
                      .logout();
                  // 不显式跳转：router redirect 会因 session=null + `/me`
                  // 自动把当前位置改为 `/login`。
                },
              ),
              const SizedBox(height: 18),
              Center(
                child: Text(
                  'Quantify v1.2.4 · build 2026.05',
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 10,
                    fontFamilyFallback: const <String>[
                      'ui-monospace',
                      'monospace',
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatsCard extends StatelessWidget {
  // 三栏当前按原型 m-screens-4 第 9 屏使用 mock 字面量（活跃策略 / 累计收益
  // / 胜率），不读 AccountInfo；待 strategy 维度真实数据接通后再注入。
  const _StatsCard();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 14,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x1A0F1623),
            offset: Offset(0, 12),
            blurRadius: 40,
          ),
        ],
      ),
      // 三栏统计：主视图按原型 m-screens-4 第 9 屏「活跃策略 / 累计收益
      // / 胜率」展示。本迭代用 mock 值（与原型常量一致），后续 issue 接通
      // strategy 维度真实数据后切换；AccountInfo 财务字段保留供副视图复用。
      child: Row(
        children: <Widget>[
          _Stat(
            label: l10n.meStatsActiveStrategies,
            value: '3',
            color: c.text,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: l10n.meStatsCumulativeReturn,
            value: '+\$8,420',
            color: c.statusOk,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: l10n.meStatsWinRate,
            value: '62.4%',
            color: c.text,
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Expanded(
      child: Column(
        children: <Widget>[
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              fontFamilyFallback: const <String>[
                'ui-monospace',
                'monospace',
              ],
            ),
          ),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
        ],
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 32, color: color);
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(children: children),
    );
  }
}

/// 「我的」首页内联展开的三家交易所凭据列表，对应原型 m-screens-4 第 9
/// 屏「交易所 API」卡片：每家交易所一行 + 状态 + 「管理/连接」按钮。
/// 点击「管理」/「连接」直接打开 `api_form_sheet` 并预填 exchange。
const List<String> _meExchanges = <String>['Binance', 'OKX', 'Hyperliquid'];

class _ApiExchangesGroup extends ConsumerWidget {
  const _ApiExchangesGroup({required this.apiKeys});
  final AsyncValue<List<ExchangeApiKey>> apiKeys;

  Future<void> _openSheet(
    BuildContext context,
    WidgetRef ref,
    String exchange,
  ) async {
    final bool? saved =
        await showApiFormSheet(context, exchange: exchange);
    // await 后 widget 可能已 dispose（用户在 sheet 打开时导航离开）；
    // 缺 mounted 检查会触发 `Ref was disposed` StateError（debug）
    // 或 release 模式下未定义行为。
    if (saved == true && context.mounted) {
      ref.invalidate(apiKeysProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<ExchangeApiKey> list = apiKeys.maybeWhen(
      data: (List<ExchangeApiKey> l) => l,
      orElse: () => const <ExchangeApiKey>[],
    );
    ExchangeApiKey? findKey(String ex) {
      for (final ExchangeApiKey k in list) {
        if (k.exchange.toLowerCase() == ex.toLowerCase()) return k;
      }
      return null;
    }

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        children: <Widget>[
          for (int i = 0; i < _meExchanges.length; i++)
            _ApiExchangeRow(
              exchange: _meExchanges[i],
              existingKey: findKey(_meExchanges[i]),
              last: i == _meExchanges.length - 1,
              onTap: () => _openSheet(context, ref, _meExchanges[i]),
              l10n: l10n,
            ),
        ],
      ),
    );
  }
}

class _ApiExchangeRow extends StatelessWidget {
  const _ApiExchangeRow({
    required this.exchange,
    required this.existingKey,
    required this.last,
    required this.onTap,
    required this.l10n,
  });

  final String exchange;
  final ExchangeApiKey? existingKey;
  final bool last;
  final VoidCallback onTap;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool configured = existingKey != null;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 14,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: last ? Colors.transparent : c.borderSoft,
          ),
        ),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: c.bgSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(
              exchange.substring(0, 1),
              style: TextStyle(
                color: c.text,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  exchange,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  configured ? l10n.meApiConnected : l10n.meApiNotConfigured,
                  style: TextStyle(
                    color: configured ? c.statusOk : c.statusWarn,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 30,
            child: TextButton(
              onPressed: onTap,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                backgroundColor:
                    configured ? c.bgSoft : c.accent.withValues(alpha: 0.16),
                foregroundColor: configured ? c.textMid : c.accent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text(configured ? l10n.meApiManage : l10n.meApiConnect),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: c.bgElev,
      borderRadius: BorderRadius.circular(QzRadii.input + 2),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(QzRadii.input + 2),
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.input + 2),
          ),
          child: Text(
            l10n.meLogout,
            style: TextStyle(
              color: c.statusDanger,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

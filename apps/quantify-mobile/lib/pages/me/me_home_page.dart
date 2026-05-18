import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth/session_controller.dart';
import '../../data/models/account_models.dart';
import '../../data/models/api_key_models.dart';
import '../../data/providers.dart';
import '../../data/utils/mask_helpers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
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
            '加载失败：$e',
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
    final QzColorScheme c = context.qzScheme;
    final int configuredCount = apiKeys.maybeWhen(
      data: (List<ExchangeApiKey> l) => l.length,
      orElse: () => 0,
    );

    // header chip 状态从真实数据派生：binance 由 apiKeys 中是否有 Binance
    // 凭据决定；telegram 当前 mobile 端无字段（mock AccountInfo 未提供），
    // 显式置 false 等待后续 Issue 引入 `AccountInfo.bindings`。
    final bool binanceConnected = apiKeys.maybeWhen(
      data: (List<ExchangeApiKey> list) => list.any(
        (ExchangeApiKey k) => k.exchange.toLowerCase() == 'binance',
      ),
      orElse: () => false,
    );

    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        QzAccountHeader(
          maskedEmail: maskEmail(info.email),
          uid: info.uid,
          binanceConnected: binanceConnected,
          telegramBound: false,
        ),
        Transform.translate(
          offset: const Offset(0, _statsCardOverlap),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
            child: _StatsCard(info: info),
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
              const QzSectionTitle(text: '账户'),
              _SettingsGroup(
                children: <Widget>[
                  QzSettingsRow(label: '邮箱', value: info.email),
                  QzSettingsRow(label: 'UID', value: info.uid, mono: true),
                  const QzSettingsRow(
                    label: 'Telegram',
                    // mobile 端 `AccountInfo` 未携带 telegram handle，本迭代
                    // 显示占位；后续 Issue 引入 `AccountInfo.bindings` 后切换。
                    value: '未绑定',
                    tone: QzSettingsRowTone.warn,
                    trailing: QzSettingsCaret(),
                  ),
                  const QzSettingsRow(
                    label: '安全设置',
                    value: '查看',
                    trailing: QzSettingsCaret(),
                    last: true,
                  ),
                ],
              ),
              const QzSectionTitle(text: '交易所 API'),
              _SettingsGroup(
                children: <Widget>[
                  QzSettingsRow(
                    label: '管理交易所凭据',
                    value: configuredCount > 0
                        ? '$configuredCount 个已配置'
                        : '未配置',
                    tone: configuredCount > 0
                        ? QzSettingsRowTone.ok
                        : QzSettingsRowTone.warn,
                    trailing: const QzSettingsCaret(),
                    onTap: () => context.push('/me/api'),
                    last: true,
                  ),
                ],
              ),
              const QzSectionTitle(text: '偏好'),
              _SettingsGroup(
                children: <Widget>[
                  const QzSettingsRow(
                    label: '语言',
                    value: '简体中文',
                    trailing: QzSettingsCaret(),
                  ),
                  QzSettingsRow(
                    label: '主题',
                    value: '跟随系统',
                    trailing: const QzSettingsCaret(),
                    onTap: () => context.push('/me/theme'),
                  ),
                  const QzSettingsRow(
                    label: '推送通知',
                    value: '查看',
                    trailing: QzSettingsCaret(),
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
  const _StatsCard({required this.info});
  final AccountInfo info;

  @override
  Widget build(BuildContext context) {
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
      // 三栏统计：直接渲染 AccountInfo 真字段（总权益 / 可用余额 /
      // 未实现盈亏），避免硬编码「活跃策略=3」「胜率=62.4%」这类 mock
      // 数据上生产后误导用户（critic C1）。
      child: Row(
        children: <Widget>[
          _Stat(
            label: '总权益',
            value: '\$${info.totalEquityUsd.toStringAsFixed(0)}',
            color: c.text,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: '可用余额',
            value: '\$${info.availableBalanceUsd.toStringAsFixed(0)}',
            color: c.text,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: '未实现盈亏',
            value:
                '${info.unrealizedPnlUsd >= 0 ? '+' : ''}\$${info.unrealizedPnlUsd.toStringAsFixed(0)}',
            color: info.unrealizedPnlUsd >= 0 ? c.statusOk : c.statusDanger,
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

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
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
            '退出登录',
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

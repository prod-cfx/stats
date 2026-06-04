import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/auth/session_controller.dart';
import '../../data/models/account_models.dart';
import '../../data/models/api_key_models.dart';
import '../../domain/models/live_strategy_models.dart';
import '../../domain/use_cases/live_strategy_use_cases.dart';
import '../../data/providers.dart';
import '../../data/utils/mask_helpers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_grab_handle.dart';
import '../../widgets/qz_spinner.dart';
import '../live/widgets/live_status_style.dart';
import 'api_form_sheet.dart';
import 'widgets/qz_account_header.dart';
import 'widgets/qz_exchange_logo.dart';
import 'widgets/qz_section_title.dart';
import 'widgets/qz_settings_row.dart';

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

/// 语言抽屉单个选项行：左侧文案 + 右侧单选勾选圆点，对齐设计稿。
class _LanguageOptionRow extends StatelessWidget {
  const _LanguageOptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.c,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final QzColorScheme c;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.lg,
          vertical: 12,
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? c.accent : c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? c.accent : Colors.transparent,
                border: Border.all(
                  color: selected ? c.accent : c.border,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check, size: 12, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

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
      data: (List<ExchangeApiKey> list) =>
          list.any((ExchangeApiKey k) => k.exchange.toLowerCase() == 'binance'),
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
              // 实盘策略入口（#1792）：对齐设计稿 `m-screens-4.jsx:2516-2563`，
              // header 下首位大卡，展示运行中策略计数，点击进入 `/me/live`。
              QzSectionTitle(text: l10n.liveStrategyEntryTitle),
              const _LiveStrategiesHeroCard(),
              QzSectionTitle(text: l10n.meSectionAccount),
              _SettingsGroup(
                children: <Widget>[
                  QzSettingsRow(
                    label: l10n.authLoginEmailLabel,
                    value: info.email,
                  ),
                  QzSettingsRow(label: 'UID', value: info.uid, mono: true),
                  QzSettingsRow(
                    label: l10n.meSettingsTelegram,
                    // mock 阶段对齐设计稿 `m-screens-4.jsx:1009`：直接显示
                    // handle + ok tone（与上方 `telegramBound=true` 同源）。
                    // 接通 `AccountInfo.bindings` 后改为按真实状态分支。
                    value: l10n.meSettingsTelegramHandle,
                    tone: QzSettingsRowTone.ok,
                    trailing: const QzSettingsCaret(),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsSecurity,
                    // 对齐设计稿 `m-screens-4.jsx:1010` 「双重认证 · 已开启」；
                    // 真实安全状态接通后改读 `AccountInfo.security`。
                    value: l10n.meSettingsSecurityValue,
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
                    // 选中值回显（会话态）；未选择时退回默认 简体中文。
                    value:
                        ref.watch(selectedLanguageProvider) ??
                        l10n.meSettingsLanguageValue,
                    trailing: const QzSettingsCaret(),
                    onTap: () => showLanguageSheet(context, ref),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsTheme,
                    value: l10n.meSettingsThemeValue,
                    trailing: const QzSettingsCaret(),
                    onTap: () => context.push('/me/theme'),
                  ),
                  QzSettingsRow(
                    label: l10n.meSettingsNotifications,
                    // 对齐设计稿 `m-screens-4.jsx:2556`：value=「Telegram · 开启」
                    // 并用 ok 绿色 tone。
                    value: l10n.meSettingsNotificationsValue,
                    tone: QzSettingsRowTone.ok,
                    trailing: const QzSettingsCaret(),
                    last: true,
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.xl),
              _LogoutButton(
                onPressed: () async {
                  await ref.read(sessionControllerProvider.notifier).logout();
                  if (!context.mounted) return;
                  context.go('/strategy');
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

class _StatsCard extends ConsumerWidget {
  // 三栏（活跃策略 / 累计收益 / 胜率）派生自 `liveStrategySummaryProvider`，
  // 与同页大卡同源（#1902）。加载/错误态退化为 0：count=0 / +$0 / 0.0%，
  // 整卡始终可见，不崩。待后端实例接口接通后随 provider 自动切真实数据。
  const _StatsCard();

  /// 累计收益展示串，口径对齐 live 列表页 `_money`：`+$8,420` / `-$1,200`。
  /// 千分位分组，无小数（统计卡为概览，精度交详情页）。
  static String _formatPnl(double v) {
    final String sign = v >= 0 ? '+\$' : '-\$';
    final String digits = v.abs().round().toString();
    final StringBuffer grouped = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) grouped.write(',');
      grouped.write(digits[i]);
    }
    return '$sign$grouped';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 加载/错误态退化为全 0 摘要，整卡照常渲染（不闪 spinner / 不抛错）。
    final LiveStrategySummary s = ref
        .watch(liveStrategySummaryProvider)
        .maybeWhen(
          data: (LiveStrategySummary v) => v,
          orElse: () => const LiveStrategySummary(
            totalAssets: 0,
            totalCapital: 0,
            todayPnl: 0,
            totalPnl: 0,
            runningCount: 0,
            warningCount: 0,
            pausedCount: 0,
            stoppedCount: 0,
          ),
        );
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
      // 三栏统计：活跃策略数 / 累计收益 / 综合胜率，均派生自 summary。
      // 累计收益正负分别用 ok / danger tone（0 视为非负，走 ok）。
      child: Row(
        children: <Widget>[
          _Stat(
            label: l10n.meStatsActiveStrategies,
            value: '${s.activeCount}',
            color: c.text,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: l10n.meStatsCumulativeReturn,
            value: _formatPnl(s.totalPnl),
            color: s.totalPnl >= 0 ? c.statusOk : c.statusDanger,
          ),
          _StatDivider(color: c.borderSoft),
          _Stat(
            label: l10n.meStatsWinRate,
            value: '${s.winRate.toStringAsFixed(1)}%',
            color: c.text,
          ),
        ],
      ),
    );
  }
}

/// 实盘策略入口大卡（#1792），对齐设计稿 `m-screens-4.jsx:2516-2563`：
/// 图标 + 标题 + 活跃计数 badge + 「N 运行中」状态行。计数来自
/// `liveStrategySummaryProvider`（mock fixture 派生）；加载/错误态退化为
/// 0 计数，整卡始终可点进入 `/me/live`。
class _LiveStrategiesHeroCard extends ConsumerWidget {
  const _LiveStrategiesHeroCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<LiveStrategySummary> summary = ref.watch(
      liveStrategySummaryProvider,
    );
    // 加载/错误态退化为 0 计数；整卡始终可点。
    final LiveStrategySummary s = summary.maybeWhen(
      data: (LiveStrategySummary v) => v,
      orElse: () => const LiveStrategySummary(
        totalAssets: 0,
        totalCapital: 0,
        todayPnl: 0,
        totalPnl: 0,
        runningCount: 0,
        warningCount: 0,
        pausedCount: 0,
        stoppedCount: 0,
      ),
    );

    return Material(
      color: c.bgElev,
      borderRadius: BorderRadius.circular(QzRadii.card),
      child: InkWell(
        key: const Key('me-live-strategies-entry'),
        onTap: () => context.push('/me/live'),
        borderRadius: BorderRadius.circular(QzRadii.card),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: 14,
          ),
          decoration: BoxDecoration(
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(Icons.auto_graph, size: 20, color: c.accent),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            l10n.liveStrategyEntryTitle,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        _ActiveCountBadge(count: s.activeCount, c: c),
                      ],
                    ),
                    const SizedBox(height: 3),
                    _LiveStatusBreakdown(summary: s, l10n: l10n, c: c),
                  ],
                ),
              ),
              const QzSettingsCaret(),
            ],
          ),
        ),
      ),
    );
  }
}

/// 标题旁的活跃计数 pill（紫底），对齐设计稿 `m-screens-4.jsx:2546-2551`。
class _ActiveCountBadge extends StatelessWidget {
  const _ActiveCountBadge({required this.count, required this.c});
  final int count;
  final QzColorScheme c;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          color: c.accent,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          fontFamilyFallback: const <String>['ui-monospace', 'monospace'],
        ),
      ),
    );
  }
}

/// 多状态明细行：`N 运行中 · N 需关注 · N 已暂停 · N 已停止`，对齐设计稿
/// `m-screens-4.jsx:2556-2589`。计数为 0 的状态不渲染；首项带状态圆点。
class _LiveStatusBreakdown extends StatelessWidget {
  const _LiveStatusBreakdown({
    required this.summary,
    required this.l10n,
    required this.c,
  });
  final LiveStrategySummary summary;
  final AppLocalizations l10n;
  final QzColorScheme c;

  @override
  Widget build(BuildContext context) {
    final List<(LiveStrategyStatus, int)> entries = liveStatusBreakdown(summary);

    if (entries.isEmpty) {
      return Text(
        l10n.liveStrategyEntrySubtitle,
        style: TextStyle(color: c.textMid, fontSize: 11),
      );
    }

    final List<Widget> children = <Widget>[];
    for (int i = 0; i < entries.length; i++) {
      if (i > 0) {
        children.add(
          Text('·', style: TextStyle(color: c.textDim, fontSize: 11)),
        );
      }
      final (LiveStrategyStatus status, int count) = entries[i];
      children.add(
        _StatusChip(
          status: status,
          count: count,
          showDot: i == 0,
          c: c,
          l10n: l10n,
        ),
      );
    }

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: children,
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.status,
    required this.count,
    required this.showDot,
    required this.c,
    required this.l10n,
  });
  final LiveStrategyStatus status;
  final int count;
  final bool showDot;
  final QzColorScheme c;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final LiveStatusStyle style = liveStatusStyle(status, c, l10n);
    // stopped/paused 按设计稿走 dim 灰；running/warning 用其 tone 色。
    final Color tone = switch (status) {
      LiveStrategyStatus.running => c.statusOk,
      LiveStrategyStatus.warning => c.statusWarn,
      LiveStrategyStatus.paused => c.textDim,
      LiveStrategyStatus.stopped => c.textDim,
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (showDot) ...<Widget>[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
        ],
        Text(
          '$count ${style.label}',
          style: TextStyle(
            color: tone,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
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
              fontFamilyFallback: const <String>['ui-monospace', 'monospace'],
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
    final bool? saved = await showApiFormSheet(context, exchange: exchange);
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
          bottom: BorderSide(color: last ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          QzExchangeLogo(exchange: exchange, size: 36),
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
                backgroundColor: configured
                    ? c.bgSoft
                    : c.accent.withValues(alpha: 0.16),
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
        key: const Key('me-logout-button'),
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

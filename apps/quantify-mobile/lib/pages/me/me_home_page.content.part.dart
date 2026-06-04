part of 'me_home_page.dart';
// ignore_for_file: unused_element

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

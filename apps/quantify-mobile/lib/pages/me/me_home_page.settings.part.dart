part of 'me_home_page.dart';
// ignore_for_file: unused_element

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

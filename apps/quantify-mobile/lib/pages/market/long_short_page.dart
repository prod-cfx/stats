import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/tickers.dart';
import '../../data/models/exchange_long_short_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_sheet.dart';
import '../../widgets/qz_spinner.dart';
import 'long_short_controller.dart';
import 'long_short_state.dart';
import 'widgets/exchange_long_short_tile.dart';
import 'widgets/long_short_hero_card.dart';
import 'widgets/long_short_search_overlay.dart';

/// 多空比 hub 子屏。页面级状态（symbol/period/snapshot/loading/error）由
/// [LongShortController] 持有（issue #2184）。
class LongShortBody extends ConsumerWidget {
  const LongShortBody({super.key});

  static const List<String> _periods = <String>['15分钟', '1小时', '4小时', '12小时'];

  Future<void> _pickPeriod(BuildContext context, WidgetRef ref) async {
    final LongShortState s = ref.read(longShortControllerProvider);
    final String? picked = await QzSheet.show<String>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext context) =>
          _PeriodSheet(selected: s.period, periods: _periods),
    );
    if (picked == null) return;
    ref.read(longShortControllerProvider.notifier).changePeriod(picked);
  }

  /// 打开全屏币种搜索（设计稿 `LSCoinTabs` 搜索按钮 → `SearchOverlay`）。
  Future<void> _openSearch(
    BuildContext context,
    WidgetRef ref,
    List<String> symbols,
  ) async {
    final String? picked = await Navigator.of(
      context,
      rootNavigator: true,
    ).push<String>(
      MaterialPageRoute<String>(
        fullscreenDialog: true,
        builder: (BuildContext context) =>
            LongShortSearchOverlay(symbols: symbols),
      ),
    );
    if (picked != null) {
      ref.read(longShortControllerProvider.notifier).changeSymbol(picked);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final LongShortState s = ref.watch(longShortControllerProvider);
    final List<String> symbols = mockTickers
        .map((ticker) => ticker.symbol)
        .take(8)
        .toList();
    // coin tabs 固定在顶部（设计稿 LSCoinTabs 为 sticky 头），仅下方内容滚动。
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _CoinTabs(
          symbols: symbols,
          selected: s.symbol,
          onChanged: (String value) => ref
              .read(longShortControllerProvider.notifier)
              .changeSymbol(value),
          onSearch: () => _openSearch(context, ref, symbols),
        ),
        Expanded(child: _buildScrollBody(context, ref, s)),
      ],
    );
  }

  Widget _buildScrollBody(BuildContext context, WidgetRef ref, LongShortState s) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const SizedBox(height: QzSpacing.md),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
            child: _ChartTitleRow(
              period: s.period,
              onTapPeriod: () => _pickPeriod(context, ref),
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          if (s.loading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: QzSpacing.md),
              child: QzCard(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: QzSpinner()),
              ),
            )
          else if (s.error != null || s.snapshot == null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
              child: QzCard(
                child: QzEmptyState(title: l10n.marketLongShortLoadError),
              ),
            )
          else ...<Widget>[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
              child: LongShortHeroCard(snapshot: s.snapshot!),
            ),
            const SizedBox(height: QzSpacing.md),
            const _ExchangeSectionHeader(),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
              child: _ExchangeList(exchanges: s.snapshot!.exchanges),
            ),
          ],
        ],
      ),
    );
  }
}

class _CoinTabs extends StatelessWidget {
  const _CoinTabs({
    required this.symbols,
    required this.selected,
    required this.onChanged,
    required this.onSearch,
  });

  final List<String> symbols;
  final String selected;
  final ValueChanged<String> onChanged;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      height: 44,
      child: Stack(
        children: <Widget>[
          ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 6, 54, 6),
            itemCount: symbols.length,
            separatorBuilder: (BuildContext context, int index) =>
                const SizedBox(width: QzSpacing.sm),
            itemBuilder: (BuildContext context, int index) {
              final String symbol = symbols[index];
              final bool active = symbol == selected;
              return InkWell(
                key: Key('long-short-symbol-chip-$symbol'),
                borderRadius: BorderRadius.circular(8),
                onTap: () => onChanged(symbol),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? c.accentSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: active ? c.accent : Colors.transparent,
                    ),
                  ),
                  child: Text(
                    symbol.replaceAll('USDT', ''),
                    style: TextStyle(
                      color: active ? c.accent : c.textMid,
                      fontSize: 13,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      letterSpacing: 0.3,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            child: Container(
              width: 54,
              padding: const EdgeInsets.only(right: 12),
              alignment: Alignment.centerRight,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
                ),
              ),
              child: _SearchButton(colorScheme: c, onPressed: onSearch),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchButton extends StatelessWidget {
  const _SearchButton({required this.colorScheme, required this.onPressed});

  final QzColorScheme colorScheme;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      height: 32,
      child: IconButton(
        key: const Key('long-short-coin-search'),
        padding: EdgeInsets.zero,
        icon: const Icon(Icons.search, size: 17),
        color: colorScheme.textMid,
        style: IconButton.styleFrom(
          backgroundColor: colorScheme.bgElev,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(color: colorScheme.borderSoft),
          ),
        ),
        onPressed: onPressed,
      ),
    );
  }
}

class _ChartTitleRow extends StatelessWidget {
  const _ChartTitleRow({required this.period, required this.onTapPeriod});

  final String period;
  final VoidCallback onTapPeriod;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          '交易所 多空比图表',
          style: TextStyle(
            color: c.text,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: c.borderStrong),
          ),
          alignment: Alignment.center,
          child: Text(
            'i',
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const Spacer(),
        InkWell(
          key: const Key('long-short-period-button'),
          borderRadius: BorderRadius.circular(8),
          onTap: onTapPeriod,
          child: Container(
            height: 30,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: c.bgElev,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: c.borderSoft),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  period,
                  style: TextStyle(
                    color: c.textMid,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.keyboard_arrow_down, size: 16, color: c.textDim),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ExchangeSectionHeader extends StatelessWidget {
  const _ExchangeSectionHeader();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextStyle style = TextStyle(
      color: c.textDim,
      fontSize: 11,
      fontWeight: FontWeight.w500,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 6),
      child: Row(
        children: <Widget>[
          Text('交易所', style: style),
          const Spacer(),
          Text('持仓占比 (多 VS 空)', style: style),
        ],
      ),
    );
  }
}

class _ExchangeList extends StatelessWidget {
  const _ExchangeList({required this.exchanges});

  final List<ExchangeLongShort> exchanges;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.borderSoft),
      ),
      child: Column(
        children: <Widget>[
          for (int i = 0; i < exchanges.length; i++)
            ExchangeLongShortTile(
              rank: i + 1,
              item: exchanges[i],
              showDivider: i < exchanges.length - 1,
            ),
        ],
      ),
    );
  }
}

class _PeriodSheet extends StatelessWidget {
  const _PeriodSheet({required this.selected, required this.periods});

  final String selected;
  final List<String> periods;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('long-short-period-sheet'),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final String period in periods)
            InkWell(
              onTap: () => Navigator.of(context).pop(period),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 13),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        period,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Icon(
                      period == selected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_unchecked,
                      color: period == selected ? c.accent : c.textDim,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

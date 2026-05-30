import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'agg_coin_search_sheet.dart';

/// 币种 chips 横滑条 + 右侧搜索按钮（持仓量 / 成交量 tab 共用）。
///
/// 设计稿 `CoinFilterChips`(:1068)：选中 chip accent 描边 + soft 底；右侧粘性
/// 搜索按钮打开 [showAggCoinSearch] 全屏 overlay。
class AggCoinChips extends StatelessWidget {
  const AggCoinChips({
    super.key,
    required this.coins,
    required this.value,
    required this.onChanged,
  });

  final List<String> coins;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
            child: Row(
              children: <Widget>[
                for (final String coin in coins)
                  _Chip(
                    key: Key('agg-coin-chip-$coin'),
                    label: coin,
                    selected: coin == value,
                    onTap: () => onChanged(coin),
                  ),
              ],
            ),
          ),
        ),
        IconButton(
          key: const Key('agg-coin-search-button'),
          icon: Icon(Icons.search, size: 18, color: c.textMid),
          onPressed: () async {
            final String? picked =
                await showAggCoinSearch(context, coins: coins);
            if (picked != null) onChanged(picked);
          },
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(right: QzSpacing.xs),
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(QzRadii.input),
          border: Border.all(
            color: selected ? c.accent : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.accent : c.textMid,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ),
    );
  }
}

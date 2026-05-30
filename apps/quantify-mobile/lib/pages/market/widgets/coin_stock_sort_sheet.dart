import 'package:flutter/material.dart';

import '../../../data/models/coin_stock_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 排序选择结果：指标 + 方向（[dir] 为 null 表示不排序）。
class CoinStockSortResult {
  const CoinStockSortResult(this.sort, this.dir);

  final CoinStockSort sort;
  final SortDir? dir;
}

/// 「筛选 & 排序」bottom sheet（设计稿 `:2058`）。
///
/// 指标 pills（市值/持币价值/持币量/股价/MNAV/24h 涨跌）+ 排序方式三选
/// （升序/降序/不排序）。点「查看 N 个结果」回传当前选择。sheet 内本地维护
/// 选择，关闭时通过 [show] 的返回值交给调用方。
class CoinStockSortSheet extends StatefulWidget {
  const CoinStockSortSheet({
    super.key,
    required this.sort,
    required this.dir,
    required this.resultCount,
  });

  final CoinStockSort sort;
  final SortDir? dir;
  final int resultCount;

  static Future<CoinStockSortResult?> show(
    BuildContext context, {
    required CoinStockSort sort,
    required SortDir? dir,
    required int resultCount,
  }) {
    return showModalBottomSheet<CoinStockSortResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CoinStockSortSheet(
        sort: sort,
        dir: dir,
        resultCount: resultCount,
      ),
    );
  }

  @override
  State<CoinStockSortSheet> createState() => _CoinStockSortSheetState();
}

class _CoinStockSortSheetState extends State<CoinStockSortSheet> {
  late CoinStockSort _sort = widget.sort;
  late SortDir? _dir = widget.dir;

  String _sortLabel(AppLocalizations l10n, CoinStockSort s) {
    switch (s) {
      case CoinStockSort.mcap:
        return l10n.coinStockStatMcap;
      case CoinStockSort.holdV:
        return l10n.coinStockStatHoldValue;
      case CoinStockSort.holdQ:
        return l10n.coinStockStatHoldQty;
      case CoinStockSort.px:
        return l10n.coinStockSortPrice;
      case CoinStockSort.mnav:
        return l10n.coinStockStatMnav;
      case CoinStockSort.ch:
        return l10n.coinStockSortChange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      key: const Key('coin-stock-sort-sheet'),
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        28 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Center(
            child: Container(
              width: 42,
              height: 4,
              margin: const EdgeInsets.fromLTRB(0, 10, 0, 14),
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            l10n.coinStockSortTitle,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(height: 12),
          Text(l10n.coinStockSortMetricLabel,
              style: TextStyle(fontSize: 11, color: c.textMid)),
          const SizedBox(height: 6),
          _metricPills(c, l10n),
          const SizedBox(height: 16),
          Text(l10n.coinStockSortDirectionLabel,
              style: TextStyle(fontSize: 11, color: c.textMid)),
          const SizedBox(height: 6),
          _directionRow(c, l10n),
          const SizedBox(height: 16),
          _confirmButton(c, l10n),
        ],
      ),
    );
  }

  Widget _metricPills(QzColorScheme c, AppLocalizations l10n) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: <Widget>[
        for (final CoinStockSort s in CoinStockSort.values)
          _pill(
            key: Key('coin-stock-sort-metric-${s.name}'),
            label: _sortLabel(l10n, s),
            selected: s == _sort,
            onTap: () => setState(() {
              _sort = s;
              // 选指标时若当前为不排序则回填降序（设计稿 :2061）。
              _dir ??= SortDir.desc;
            }),
            c: c,
          ),
      ],
    );
  }

  Widget _pill({
    required Key key,
    required String label,
    required bool selected,
    required VoidCallback onTap,
    required QzColorScheme c,
  }) {
    return GestureDetector(
      key: key,
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? c.accentOn : c.text,
          ),
        ),
      ),
    );
  }

  Widget _directionRow(QzColorScheme c, AppLocalizations l10n) {
    final List<(SortDir?, String, String)> opts = <(SortDir?, String, String)>[
      (SortDir.asc, l10n.coinStockSortAsc, '↑'),
      (SortDir.desc, l10n.coinStockSortDesc, '↓'),
      (null, l10n.coinStockSortNone, ''),
    ];
    return Row(
      children: <Widget>[
        for (int i = 0; i < opts.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: 6),
          Expanded(child: _dirButton(c, opts[i])),
        ],
      ],
    );
  }

  Widget _dirButton(QzColorScheme c, (SortDir?, String, String) opt) {
    final bool selected = _dir == opt.$1;
    return GestureDetector(
      key: Key('coin-stock-sort-dir-${opt.$1?.name ?? 'none'}'),
      onTap: () => setState(() => _dir = opt.$1),
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : c.bgSoft,
          border: Border.all(
            color: selected ? c.accent : Colors.transparent,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              opt.$2,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: selected ? c.accent : c.text,
              ),
            ),
            if (opt.$3.isNotEmpty) ...<Widget>[
              const SizedBox(width: 5),
              Text(
                opt.$3,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? c.accent : c.text,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _confirmButton(QzColorScheme c, AppLocalizations l10n) {
    return SizedBox(
      width: double.infinity,
      height: 46,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: c.accentGrad,
          borderRadius: BorderRadius.circular(12),
        ),
        child: TextButton(
          key: const Key('coin-stock-sort-confirm'),
          style: TextButton.styleFrom(
            foregroundColor: c.accentOn,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          onPressed: () => Navigator.of(context)
              .pop(CoinStockSortResult(_sort, _dir)),
          child: Text(
            l10n.coinStockSortApply(widget.resultCount),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}

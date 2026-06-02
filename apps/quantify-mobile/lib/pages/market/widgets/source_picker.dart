import 'package:flutter/material.dart';

import '../../../data/models/market_source.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 周期 tab 行右侧的「数据来源」picker（#2099）。
///
/// 对齐设计稿 `m-screens-3.jsx` SourcePicker：聚合态用渐变填充 pill，
/// 单一交易所用描边 pill；点击弹出 [DataSourceSheet] 单选。
class SourcePicker extends StatelessWidget {
  const SourcePicker({
    super.key,
    required this.source,
    required this.onChanged,
  });

  final MarketSource source;
  final ValueChanged<MarketSource> onChanged;

  Future<void> _openSheet(BuildContext context) async {
    final MarketSource? next = await QzSheet.show<MarketSource>(
      context: context,
      builder: (BuildContext ctx) => DataSourceSheet(current: source),
    );
    if (next != null && next != source) onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool agg = source.isAggregated;
    final String label =
        agg ? l10n.marketDetailSourceAggregated : source.exchangeName!;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: const Key('market-detail-source-picker'),
        onTap: () => _openSheet(context),
        borderRadius: BorderRadius.circular(QzRadii.pill),
        child: Container(
          height: 26,
          padding: const EdgeInsets.fromLTRB(10, 0, 6, 0),
          decoration: BoxDecoration(
            gradient: agg ? c.accentGrad : null,
            color: agg ? null : c.bgElev,
            border: agg ? null : Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: agg ? Colors.white : c.text,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  height: 1.0,
                ),
              ),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 14,
                color: agg ? Colors.white70 : c.textMid,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 底部「数据来源」抽屉：聚合所有交易所 / Binance / OKX 单选（#2099）。
///
/// 选中项返回 [MarketSource]；取消返回 null。
class DataSourceSheet extends StatelessWidget {
  const DataSourceSheet({super.key, required this.current});

  final MarketSource current;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            QzSpacing.sm,
          ),
          child: Text(
            l10n.marketDetailSourceSheetTitle,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        for (final MarketSource option in MarketSource.options)
          _SourceTile(
            source: option,
            label: option.isAggregated
                ? l10n.marketDetailSourceAggregatedFull
                : option.exchangeName!,
            selected: option == current,
            onTap: () => Navigator.of(context).pop(option),
          ),
      ],
    );
  }
}

class _SourceTile extends StatelessWidget {
  const _SourceTile({
    required this.source,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final MarketSource source;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return ListTile(
      key: Key('market-detail-source-option-${source.name}'),
      onTap: onTap,
      title: Text(
        label,
        style: TextStyle(
          color: selected ? c.accent : c.text,
          fontSize: 14,
          fontWeight: source.isAggregated ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
      trailing: Container(
        width: 20,
        height: 20,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? c.accent : Colors.transparent,
          border: Border.all(color: selected ? c.accent : c.border, width: 1.5),
        ),
        child: selected
            ? const Icon(Icons.check_rounded, size: 13, color: Colors.white)
            : null,
      ),
    );
  }
}

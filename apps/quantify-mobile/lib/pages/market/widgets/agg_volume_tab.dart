import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/agg_orders.dart';
import '../../../data/models/agg_orders_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'agg_coin_chips.dart';
import 'agg_format.dart';

/// 聚合成交量 tab（设计稿 `AggVolumeTab`:1421）。
///
/// 币种 chips + 单卡片：总计行（100% 条）+ 各所横向占比条（各所配色）。
class AggVolumeTab extends StatefulWidget {
  const AggVolumeTab({super.key});

  @override
  State<AggVolumeTab> createState() => _AggVolumeTabState();
}

class _AggVolumeTabState extends State<AggVolumeTab> {
  String _coin = 'BTC';

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final VolSnapshot? data = kVolData[_coin];

    return ListView(
      key: const Key('agg-volume-list'),
      padding: const EdgeInsets.only(top: QzSpacing.md, bottom: QzSpacing.xxl),
      children: <Widget>[
        AggCoinChips(
          coins: kVolCoins,
          value: _coin,
          onChanged: (String v) => setState(() => _coin = v),
        ),
        const SizedBox(height: QzSpacing.md),
        if (data == null)
          _empty(c, l10n)
        else
          Container(
            margin: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
            decoration: BoxDecoration(
              color: c.bgElev,
              borderRadius: BorderRadius.circular(QzRadii.card),
              border: Border.all(color: c.borderSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: <Widget>[
                _VolumeRow(
                  name: l10n.aggVolumeTotal,
                  value: data.total,
                  total: data.total,
                  color: kVolColor['TOTAL']!,
                  isTotal: true,
                ),
                for (final VolRow r in data.rows)
                  _VolumeRow(
                    name: kVolExchangeName[r.exchange] ?? r.exchange,
                    value: r.value,
                    total: data.total,
                    color: kVolColor[r.exchange] ?? c.accent,
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _empty(QzColorScheme c, AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: <Widget>[
          Text(_coin, style: TextStyle(color: c.textDim, fontSize: 13)),
          const SizedBox(height: QzSpacing.xs),
          Text(l10n.aggNoData,
              style: TextStyle(color: c.textFaint, fontSize: 11)),
        ],
      ),
    );
  }
}

class _VolumeRow extends StatelessWidget {
  const _VolumeRow({
    required this.name,
    required this.value,
    required this.total,
    required this.color,
    this.isTotal = false,
  });

  final String name;
  final double value;
  final double total;
  final Color color;
  final bool isTotal;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final double pct =
        total > 0 ? (value / total).clamp(0, 1).toDouble() : 0;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: QzSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 78,
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isTotal ? c.text : c.textMid,
                fontSize: 12,
                fontWeight: isTotal ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm + 2),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: Stack(
                children: <Widget>[
                  Container(height: 6, color: c.bgSoft),
                  FractionallySizedBox(
                    widthFactor: pct,
                    child: Container(height: 6, color: color),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm + 2),
          SizedBox(
            width: 64,
            child: Text(
              fmtVolUsd(value),
              textAlign: TextAlign.right,
              style: TextStyle(
                color: c.text,
                fontSize: 12,
                fontWeight: isTotal ? FontWeight.w700 : FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

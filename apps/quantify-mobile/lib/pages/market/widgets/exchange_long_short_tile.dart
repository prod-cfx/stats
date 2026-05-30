import 'package:flutter/material.dart';

import '../../../data/models/exchange_long_short_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 单家交易所多空分布行。
///
/// 参考 `design/project/mobile/m-screens-3.jsx:381-407`：rank + 24x24 色块 + 名称 +
/// 多/空金额，下方 8px 双段进度条 + 多/空百分比文字。
class ExchangeLongShortTile extends StatelessWidget {
  const ExchangeLongShortTile({
    super.key,
    required this.rank,
    required this.item,
    this.showDivider = true,
  });

  final int rank;
  final ExchangeLongShort item;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final double l = item.longPct.clamp(0.0, 100.0);
    final double s = item.shortPct.clamp(0.0, 100.0);
    final double total = l + s;
    final double ln = total > 0 ? l / total : 0.5;
    final double sn = total > 0 ? s / total : 0.5;
    final int longFlex = (ln * 1000).round().clamp(1, 999);
    final int shortFlex = (sn * 1000).round().clamp(1, 999);
    final Color glyphFg = ThemeData.estimateBrightnessForColor(item.color) ==
            Brightness.dark
        ? Colors.white
        : Colors.black;
    return Container(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md + 2,
        QzSpacing.lg,
        QzSpacing.md + 2,
      ),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(bottom: BorderSide(color: c.borderSoft))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              SizedBox(
                width: 14,
                child: Text(
                  '$rank',
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ),
              const SizedBox(width: QzSpacing.sm + 2),
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: item.color,
                  borderRadius: BorderRadius.circular(6),
                ),
                alignment: Alignment.center,
                child: Text(
                  item.glyph,
                  style: TextStyle(
                    color: glyphFg,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm + 2),
              Expanded(
                child: Text(
                  item.exchange,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                item.longAmount,
                style: TextStyle(
                  color: c.marketUp,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const SizedBox(width: 4),
              Text('/', style: TextStyle(color: c.textDim, fontSize: 10)),
              const SizedBox(width: 4),
              Text(
                item.shortAmount,
                style: TextStyle(
                  color: c.marketDown,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 8,
              child: Row(
                children: <Widget>[
                  Expanded(
                    flex: longFlex,
                    child: ColoredBox(color: c.marketUp),
                  ),
                  Expanded(
                    flex: shortFlex,
                    child: ColoredBox(color: c.marketDown),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 5),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                l10n.marketLongShortRowLongPct(l.toStringAsFixed(1)),
                style: TextStyle(
                  color: c.textMid,
                  fontSize: 10,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              Text(
                l10n.marketLongShortRowShortPct(s.toStringAsFixed(1)),
                style: TextStyle(
                  color: c.textMid,
                  fontSize: 10,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

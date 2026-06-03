import 'package:flutter/material.dart';

import '../../../data/models/pred_market_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../widgets/qz_pulse_dot.dart';

/// 预测市场详情 bottom sheet（设计稿 `PredMarketDetailSheet`:1719）。
///
/// 头部标题 + 关闭；正文 icon + 问题 + 交易量 + 状态、规则
/// （Resolution source / Event window）、创建时间。
class PredMarketDetailSheet extends StatelessWidget {
  const PredMarketDetailSheet({super.key, required this.market});

  final PredMarket market;

  /// 走 app 既有 [showModalBottomSheet] 约定（同 agg 系列抽屉）。
  static Future<void> show(BuildContext context, PredMarket market) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PredMarketDetailSheet(market: market),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String status = market.live
        ? l10n.predMarketStatusOpen
        : l10n.predMarketStatusClosed;
    final String volText =
        fmtPredVol(market.volume)?.replaceAll(' Vol.', '') ?? '\$0';
    return Container(
      key: const Key('pred-detail-sheet'),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.88,
      ),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _header(context, c, l10n),
          SizedBox(
            key: const Key('pred-detail-body'),
            height: 300,
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  _heading(c, l10n, status, volText),
                  _divider(c, top: 4, bottom: 14),
                  Text(
                    l10n.predMarketRules,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _ruleField(
                    c,
                    l10n.predMarketResolutionSource,
                    market.resolutionSource,
                  ),
                  const SizedBox(height: 10),
                  _ruleField(
                    c,
                    l10n.predMarketEventWindow,
                    '${market.eventStart} ~ ${market.eventEnd}',
                  ),
                  _divider(c, top: 14, bottom: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: <Widget>[
                      Text(
                        '${l10n.predMarketCreatedAt}:',
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        market.createdAt,
                        style: TextStyle(color: c.text, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(BuildContext context, QzColorScheme c, AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Text(
            l10n.predMarketDetailTitle,
            style: TextStyle(
              color: c.text,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          GestureDetector(
            key: const Key('pred-detail-close'),
            onTap: () => Navigator.of(context).pop(),
            child: Icon(Icons.close, size: 18, color: c.textMid),
          ),
        ],
      ),
    );
  }

  Widget _heading(
    QzColorScheme c,
    AppLocalizations l10n,
    String status,
    String volText,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: market.color,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Icon(predIconData(market.icon), size: 18, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                market.question,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13.5,
                  height: 1.45,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: <Widget>[
                  Text(
                    '${l10n.predMarketVolumeLabel}: ',
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                  Text(
                    volText,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 10),
                  if (market.live)
                    QzPulseDot(color: c.marketDown, size: 6, ringSpread: 5)
                  else
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: c.marketDown,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  const SizedBox(width: 4),
                  Text(
                    status,
                    style: TextStyle(
                      color: c.marketDown,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _ruleField(QzColorScheme c, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(color: c.text, fontSize: 11.5, height: 1.5),
        ),
      ],
    );
  }

  Widget _divider(
    QzColorScheme c, {
    required double top,
    required double bottom,
  }) {
    return Padding(
      padding: EdgeInsets.only(top: top, bottom: bottom),
      child: Container(height: 1, color: c.borderSoft),
    );
  }
}

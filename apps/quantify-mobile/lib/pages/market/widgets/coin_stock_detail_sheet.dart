import 'package:flutter/material.dart';

import '../../../data/models/coin_stock_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 公司详情 bottom sheet（设计稿 `CompanyInfoSheet`:2238）。
///
/// 头部 coin 头像 + 代码 + 名称 + 交易所 + 关闭；股价卡（按涨跌着色）；
/// 公司概况段；meta chips（业务 / HQ / 上市 / 关联币）；核心指标 2×2 网格。
class CoinStockDetailSheet extends StatelessWidget {
  const CoinStockDetailSheet({super.key, required this.stock});

  final CoinStock stock;

  /// 走 app 既有 [showModalBottomSheet] 约定（同 pred/agg 系列）。
  static Future<void> show(BuildContext context, CoinStock stock) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CoinStockDetailSheet(stock: stock),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final Color coinC = coinColor(stock.coin);
    return Container(
      key: const Key('coin-stock-detail-sheet'),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.82,
      ),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _handle(c),
          _header(context, c, coinC),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  _priceCard(c, l10n),
                  const SizedBox(height: 16),
                  _sectionLabel(c, l10n.coinStockDetailOverview),
                  const SizedBox(height: 6),
                  Text(
                    stock.intro,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.7,
                      color: c.text,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _chips(c, l10n, coinC),
                  const SizedBox(height: 16),
                  _sectionLabel(c, l10n.coinStockDetailMetrics),
                  const SizedBox(height: 8),
                  _metricsGrid(c, l10n),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _handle(QzColorScheme c) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 4),
      child: Center(
        child: Container(
          width: 38,
          height: 4,
          decoration: BoxDecoration(
            color: c.borderSoft,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context, QzColorScheme c, Color coinC) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
      child: Row(
        children: <Widget>[
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: coinC, shape: BoxShape.circle),
            child: Text(
              stock.coin == 'OTHER' ? '?' : stock.coin.substring(0, 1),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    Text(
                      stock.sym,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: c.text,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        stock.cn,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: c.text,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  stock.ex,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: c.textDim),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            key: const Key('coin-stock-detail-close'),
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.bgElev, shape: BoxShape.circle),
              child: Icon(Icons.close, size: 16, color: c.textMid),
            ),
          ),
        ],
      ),
    );
  }

  Widget _priceCard(QzColorScheme c, AppLocalizations l10n) {
    final Color tone = stock.up ? c.marketUp : c.marketDown;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.08),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: <Widget>[
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.coinStockDetailPrice,
                style: TextStyle(fontSize: 11, color: c.textDim),
              ),
              const SizedBox(height: 2),
              Text(
                '\$${stock.px}',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: c.text,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const Spacer(),
          Container(
            height: 28,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tone,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              stock.ch,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(QzColorScheme c, String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: c.textDim,
        letterSpacing: 0.4,
      ),
    );
  }

  Widget _chips(QzColorScheme c, AppLocalizations l10n, Color coinC) {
    final List<Widget> chips = <Widget>[
      if (stock.biz.isNotEmpty) _chip(c, stock.biz),
      if (stock.hq.isNotEmpty) _chip(c, 'HQ · ${stock.hq}'),
      if (stock.listed.isNotEmpty)
        _chip(c, '${l10n.coinStockChipListed} ${stock.listed}'),
      _chip(c, '${l10n.coinStockChipRelated} · ${stock.coin}', tone: coinC),
    ];
    return Wrap(spacing: 6, runSpacing: 6, children: chips);
  }

  Widget _chip(QzColorScheme c, String text, {Color? tone}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: tone != null ? tone.withValues(alpha: 0.12) : c.bgSoft,
        border: Border.all(
          color: tone != null ? tone.withValues(alpha: 0.2) : c.borderSoft,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: tone ?? c.textMid,
        ),
      ),
    );
  }

  Widget _metricsGrid(QzColorScheme c, AppLocalizations l10n) {
    return Container(
      decoration: BoxDecoration(
        color: c.borderSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Expanded(
                    child: _metric(c, l10n.coinStockStatMcap, stock.mcap,
                        suffix: 'USD')),
                const SizedBox(width: 1),
                Expanded(child: _metric(c, l10n.coinStockStatMnav, stock.mnav)),
              ],
            ),
          ),
          const SizedBox(height: 1),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Expanded(
                    child: _metric(c, l10n.coinStockStatHoldValue, stock.holdV,
                        suffix: 'USD')),
                const SizedBox(width: 1),
                Expanded(
                  child: _metric(
                    c,
                    '${l10n.coinStockStatHoldQty} · ${stock.hold}',
                    stock.holdQ,
                    suffix: stock.hold,
                    tone: stock.holdColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(QzColorScheme c, String label, String value,
      {String? suffix, Color? tone}) {
    return Container(
      color: c.bgElev,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, color: c.textDim),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: tone ?? c.text,
                  ),
                ),
              ),
              if (suffix != null) ...<Widget>[
                const SizedBox(width: 5),
                Text(
                  suffix,
                  style: TextStyle(
                    fontSize: 10,
                    color: c.textDim,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

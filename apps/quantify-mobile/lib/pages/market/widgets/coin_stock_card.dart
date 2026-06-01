import 'package:flutter/material.dart';

import '../../../data/models/coin_stock_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 币股公司卡（设计稿 `CStockCard`:2178）。
///
/// 顶行：coin 头像 + 币种 / 股票代码 + 公司名 + 交易所 / 股价 + 涨跌 badge。
/// 下方：4 项 stats 网格（MNAV / 市值 / 持币价值 / 持币量·hold）。点击整卡
/// 触发 [onTap]（打开公司详情）。
class CoinStockCard extends StatelessWidget {
  const CoinStockCard({super.key, required this.stock, required this.onTap});

  final CoinStock stock;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final Color coinC = coinColor(stock.coin);
    return GestureDetector(
      key: Key('coin-stock-card-${stock.sym}'),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _topRow(c, coinC),
            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.only(top: 10),
              child: Column(
                children: <Widget>[
                  CustomPaint(
                    key: Key('coin-stock-card-stats-dash-${stock.sym}'),
                    painter: _DashedLinePainter(color: c.borderSoft),
                    child: const SizedBox(height: 1, width: double.infinity),
                  ),
                  const SizedBox(height: 9),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        child: _stat(c, l10n.coinStockStatMnav, stock.mnav),
                      ),
                      Expanded(
                        child: _stat(
                          c,
                          l10n.coinStockStatMcap,
                          stock.mcap,
                          suffix: 'USD',
                        ),
                      ),
                      Expanded(
                        child: _stat(
                          c,
                          l10n.coinStockStatHoldValue,
                          stock.holdV,
                          suffix: 'USD',
                        ),
                      ),
                      Expanded(
                        child: _stat(
                          c,
                          '${l10n.coinStockStatHoldQty} · ${stock.hold}',
                          stock.holdQ,
                          suffix: stock.hold,
                          tone: stock.holdColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _topRow(QzColorScheme c, Color coinC) {
    final Color badge = stock.up ? c.marketUp : c.marketDown;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: <Widget>[
        Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _avatar(coinC),
            const SizedBox(height: 3),
            Text(
              stock.coin,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: coinC,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
        const SizedBox(width: 10),
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
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: c.text,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      stock.cn,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
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
                style: TextStyle(fontSize: 10.5, color: c.textDim),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              '\$${stock.px}',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: c.text,
              ),
            ),
            const SizedBox(height: 3),
            Container(
              height: 22,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: badge,
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                stock.ch,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _avatar(Color bg) {
    return Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Text(
        stock.coin == 'OTHER' ? '?' : stock.coin.substring(0, 1),
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _stat(
    QzColorScheme c,
    String label,
    String value, {
    String? suffix,
    Color? tone,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 10, color: c.textDim),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: tone ?? c.text,
          ),
        ),
        if (suffix != null) ...<Widget>[
          const SizedBox(height: 1),
          Text(
            suffix,
            style: TextStyle(fontSize: 9, color: c.textDim, letterSpacing: 0.3),
          ),
        ],
      ],
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    const double dash = 4;
    const double gap = 4;
    double x = 0;
    while (x < size.width) {
      final double end = (x + dash).clamp(0, size.width).toDouble();
      canvas.drawLine(Offset(x, 0.5), Offset(end, 0.5), paint);
      x += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_DashedLinePainter oldDelegate) =>
      oldDelegate.color != color;
}

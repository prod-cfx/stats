import 'package:flutter/material.dart';

import '../../../data/models/agg_orders_models.dart';

/// 交易所圆角字母头像（订单簿行 + 持仓量表共用）。
///
/// 设计稿 `m-screens-data.jsx` 的 `ExchangeIcon`(:286) / `OIExchangeIcon`(:1052)：
/// 圆角方块底色为交易所配色，字母用对比前景色。
class AggExchangeAvatar extends StatelessWidget {
  const AggExchangeAvatar({super.key, required this.exchange, this.size = 24});

  final AggExchange exchange;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: exchange.color,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Text(
        exchange.letter,
        style: TextStyle(
          color: exchange.fg,
          fontSize: size * 0.5,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

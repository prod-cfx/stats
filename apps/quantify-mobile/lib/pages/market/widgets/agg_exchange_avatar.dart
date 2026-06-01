import 'package:flutter/material.dart';

import '../../../data/models/agg_orders_models.dart';

enum AggExchangeAvatarShape { circle, rounded }

/// 交易所字母头像（订单簿行 / 来源抽屉 / 持仓量表共用）。
///
/// 设计稿 `m-screens-data.jsx` 的 `ExchangeIcon`(:286) / `OIExchangeIcon`(:1052)：
/// 订单簿行和来源抽屉为圆形；OI/成交量表为圆角方。
class AggExchangeAvatar extends StatelessWidget {
  const AggExchangeAvatar({
    super.key,
    required this.exchange,
    this.size = 24,
    this.shape = AggExchangeAvatarShape.rounded,
  });

  final AggExchange exchange;
  final double size;
  final AggExchangeAvatarShape shape;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: exchange.color,
        shape: shape == AggExchangeAvatarShape.circle
            ? BoxShape.circle
            : BoxShape.rectangle,
        borderRadius: shape == AggExchangeAvatarShape.rounded
            ? BorderRadius.circular(size * 0.28)
            : null,
      ),
      child: Text(
        exchange.letter,
        style: TextStyle(
          color: exchange.fg,
          fontSize:
              size * (shape == AggExchangeAvatarShape.circle ? 0.55 : 0.5),
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

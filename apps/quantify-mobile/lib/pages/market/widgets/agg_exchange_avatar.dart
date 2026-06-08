import 'package:flutter/material.dart';

import '../../../data/models/agg_orders_models.dart';
import '../../../theme/theme_context.dart';

enum AggExchangeAvatarShape { circle, rounded }

/// 交易所 logo 头像（订单簿行 / 来源抽屉 / 持仓量表共用）。
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
    final c = context.qzScheme;
    final double fontFactor = shape == AggExchangeAvatarShape.circle
        ? 0.55
        : 0.5;
    final Widget child = _LogoOrLetter(
      exchange: exchange,
      size: size,
      fontFactor: fontFactor,
    );
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.bg,
        shape: shape == AggExchangeAvatarShape.circle
            ? BoxShape.circle
            : BoxShape.rectangle,
        borderRadius: shape == AggExchangeAvatarShape.rounded
            ? BorderRadius.circular(size * 0.28)
            : null,
        border: Border.all(color: c.borderSoft),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(padding: EdgeInsets.all(size * 0.14), child: child),
    );
  }
}

class _LogoOrLetter extends StatelessWidget {
  const _LogoOrLetter({
    required this.exchange,
    required this.size,
    required this.fontFactor,
  });

  final AggExchange exchange;
  final double size;
  final double fontFactor;

  @override
  Widget build(BuildContext context) {
    final String? logoUrl = exchange.logoUrl;
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return Image.network(
        logoUrl,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) =>
            _Letter(exchange: exchange, size: size, fontFactor: fontFactor),
      );
    }
    return _Letter(exchange: exchange, size: size, fontFactor: fontFactor);
  }
}

class _Letter extends StatelessWidget {
  const _Letter({
    required this.exchange,
    required this.size,
    required this.fontFactor,
  });

  final AggExchange exchange;
  final double size;
  final double fontFactor;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        exchange.letter,
        style: TextStyle(
          color: exchange.color,
          fontSize: size * fontFactor,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

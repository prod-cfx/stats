import 'package:flutter/painting.dart';

/// 聚合挂单 / 持仓量 / 成交量屏数据模型（issue #1854）。
///
/// 纯数据类，无框架依赖（仅 [Color] 来自 painting）。设计稿
/// `m-screens-data.jsx` 的 `EXCHANGES` / `AGG_ASKS` / `OI_DATA` / `VOL_DATA`。

/// 交易所展示元数据（圆形字母头像）。
class AggExchange {
  const AggExchange({
    required this.key,
    required this.name,
    required this.letter,
    required this.color,
    required this.fg,
  });

  final String key;
  final String name;
  final String letter;
  final Color color;
  final Color fg;
}

/// 订单簿单档（聚合后带累计 [total]）。
class AggBookLevel {
  const AggBookLevel({
    required this.price,
    required this.qty,
    required this.exchange,
    this.hot = false,
    this.best = false,
    this.total = 0,
  });

  final double price;
  final double qty;
  final String exchange;

  /// 热点档（大单高亮行）。
  final bool hot;

  /// 买一/卖一最优档。
  final bool best;

  /// 由近及远的累计数量（[withCumulative] 填充）。
  final double total;

  AggBookLevel copyWith({double? price, double? qty, bool? hot, double? total}) {
    return AggBookLevel(
      price: price ?? this.price,
      qty: qty ?? this.qty,
      exchange: exchange,
      hot: hot ?? this.hot,
      best: best,
      total: total ?? this.total,
    );
  }
}

/// 持仓量单行（某交易所）。
class OiRow {
  const OiRow({
    required this.exchange,
    required this.qty,
    required this.usd,
    required this.pct,
    required this.h1,
    required this.h4,
    required this.h24,
    required this.oiVol,
  });

  final String exchange;
  final double qty;
  final double usd;
  final double pct;
  final double h1;
  final double h4;
  final double h24;
  final double oiVol;
}

/// 持仓量总计行。
class OiTotal {
  const OiTotal({
    required this.qty,
    required this.usd,
    required this.h24,
  });

  final double qty;
  final double usd;
  final double h24;
}

/// 某币种的持仓量快照（总计 + 各所行）。
class OiSnapshot {
  const OiSnapshot({required this.total, required this.rows});

  final OiTotal total;
  final List<OiRow> rows;
}

/// 成交量单行（某交易所，单位：十亿美元 B）。
class VolRow {
  const VolRow({required this.exchange, required this.value});

  final String exchange;
  final double value;
}

/// 某币种的成交量快照（总计 + 各所行）。
class VolSnapshot {
  const VolSnapshot({required this.total, required this.rows});

  final double total;
  final List<VolRow> rows;
}

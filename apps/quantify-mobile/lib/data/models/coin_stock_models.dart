import 'package:flutter/painting.dart';

/// 币股屏数据模型（issue #1856）。
///
/// 纯数据类，仅依赖 painting（[Color]）。移植设计稿 `m-screens-data.jsx` 的
/// `COIN_COLORS`(:1839) / `CSTOCK_ROWS`(:1852) / `CSTOCK_SORTS`(:1891) /
/// `parseNum`(:1900)。

/// 币种 → 头像/强调色（设计稿 `COIN_COLORS`:1839）。
const Map<String, Color> _coinColors = <String, Color>{
  'BTC': Color(0xFFF7931A),
  'ETH': Color(0xFF627EEA),
  'SOL': Color(0xFF9945FF),
  'DOGE': Color(0xFFC2A633),
  'TC': Color(0xFF7C5CFF),
  'OTHER': Color(0xFF9B9BAB),
};

/// 币种取色，缺省回退 OTHER 灰。
Color coinColor(String coin) =>
    _coinColors[coin] ?? _coinColors['OTHER']!;

/// 单个币股（加密相关上市公司）。
class CoinStock {
  const CoinStock({
    required this.coin,
    required this.sym,
    required this.cn,
    required this.ex,
    required this.mnav,
    required this.mcap,
    required this.holdV,
    required this.holdQ,
    required this.hold,
    required this.px,
    required this.ch,
    required this.up,
    required this.biz,
    required this.hq,
    required this.listed,
    required this.intro,
  });

  /// 关联币种（BTC/ETH/DOGE/...，用于类型 tab 过滤与头像取色）。
  final String coin;

  /// 股票代码（如 `MSTR`）。
  final String sym;

  /// 公司中文/展示名。
  final String cn;

  /// 交易所标识（如 `MSTR 美股-NASDAQ`）。
  final String ex;

  /// 以下 5 个为展示用已格式化字符串（含千分位与 B/M/K 单位）。
  final String mnav;
  final String mcap;
  final String holdV;
  final String holdQ;

  /// 持币币种（BTC/TC 等，与 [coin] 可能不同，决定持币量配色）。
  final String hold;

  /// 当前股价（USD，已格式化字符串）。
  final String px;

  /// 24h 涨跌（带符号百分比文案，如 `+1.68%`）。
  final String ch;

  /// 是否上涨（涨跌 badge / 股价卡配色真值来源）。
  final bool up;

  final String biz;
  final String hq;
  final String listed;
  final String intro;

  /// 持币币种取色。
  Color get holdColor => coinColor(hold);
}

/// 排序指标（设计稿 `CSTOCK_SORTS`:1891）。
enum CoinStockSort { mcap, holdV, holdQ, px, mnav, ch }

/// 排序方向。null = 不排序（保持原始顺序）。
enum SortDir { asc, desc }

extension CoinStockSortX on CoinStockSort {
  /// 取排序数值：[ch] 走带符号百分比（`parseFloat`），其余走 [parseStockNum]。
  double valueOf(CoinStock r) {
    switch (this) {
      case CoinStockSort.mcap:
        return parseStockNum(r.mcap);
      case CoinStockSort.holdV:
        return parseStockNum(r.holdV);
      case CoinStockSort.holdQ:
        return parseStockNum(r.holdQ);
      case CoinStockSort.px:
        return parseStockNum(r.px);
      case CoinStockSort.mnav:
        return parseStockNum(r.mnav);
      case CoinStockSort.ch:
        return double.tryParse(
              r.ch.replaceAll('%', '').replaceAll('+', '').trim(),
            ) ??
            0;
    }
  }
}

/// 解析含千分位与 B/M/K 单位的展示串为数值（设计稿 `parseNum`:1900）。
///
/// 例：`2,370.17 B` → 2.37017e12；`570 B` → 5.7e11；`296.00` → 296。
/// 无法解析返回 0。
double parseStockNum(String s) {
  final String cleaned = s.trim().replaceAll(',', '');
  final RegExpMatch? m =
      RegExp(r'^(-?\d+\.?\d*)\s*([BMK]?)', caseSensitive: false)
          .firstMatch(cleaned);
  if (m == null) return 0;
  final double n = double.tryParse(m.group(1) ?? '') ?? 0;
  final String u = (m.group(2) ?? '').toUpperCase();
  final double mult = u == 'B'
      ? 1e9
      : u == 'M'
          ? 1e6
          : u == 'K'
              ? 1e3
              : 1;
  return n * mult;
}

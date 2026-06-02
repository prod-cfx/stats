/// 交易详情页「数据来源」选择（#2099）。
///
/// 对齐设计稿 `m-screens-3.jsx` 的 SourcePicker / 数据来源抽屉：
/// `aggregated` 为「聚合所有交易所」，其余为单一交易所。
enum MarketSource {
  aggregated,
  binance,
  okx;

  /// 是否为聚合态。聚合驱动 SourcePicker 渐变样式与 `永续 · 聚合` 副标题。
  bool get isAggregated => this == MarketSource.aggregated;

  /// 单一交易所显示名（聚合态无交易所名，返回 null）。
  ///
  /// 交易所名为品牌专名，不随 locale 变化，故直接内联而非走 l10n。
  String? get exchangeName {
    switch (this) {
      case MarketSource.aggregated:
        return null;
      case MarketSource.binance:
        return 'Binance';
      case MarketSource.okx:
        return 'OKX';
    }
  }

  /// 抽屉单选项顺序：聚合在首，其后为各交易所。
  static const List<MarketSource> options = <MarketSource>[
    MarketSource.aggregated,
    MarketSource.binance,
    MarketSource.okx,
  ];
}

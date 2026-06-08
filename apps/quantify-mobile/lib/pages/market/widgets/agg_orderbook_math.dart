import '../../../data/models/agg_orders_models.dart';

/// 聚合挂单派生纯函数（issue #2216 自 `test/fixtures/fixture/fixtures/agg_orders.dart`
/// 迁出，使 widget 不再 import fixtures；派生暂留 widget 层，C4 #2218 由
/// Controller 收口上移）。

/// 按价格桶聚合（`bucket > 1`真实 API 模式使用）。ask 向上取整、bid 向下取整，
/// 桶边界落在 mid 两侧不重叠。结果按价格降序（与展示顺序一致）。纯函数。
List<AggBookLevel> aggregateLevels(
  List<AggBookLevel> rows,
  int bucket,
  bool isAsk,
) {
  if (bucket <= 1 || rows.isEmpty) return rows;
  final Map<double, AggBookLevel> map = <double, AggBookLevel>{};
  for (final AggBookLevel r in rows) {
    final double key = isAsk
        ? (r.price / bucket).ceilToDouble() * bucket
        : (r.price / bucket).floorToDouble() * bucket;
    final AggBookLevel? existing = map[key];
    if (existing == null) {
      map[key] = r.copyWith(price: key);
    } else {
      map[key] = existing.copyWith(
        qty: existing.qty + r.qty,
        hot: existing.hot || r.hot,
      );
    }
  }
  return map.values.toList()
    ..sort((AggBookLevel a, AggBookLevel b) => b.price.compareTo(a.price));
}

/// 填充累计数量。ask 从近 mid（列表末）向外累加；bid 从高价（列表首）向下累加。
/// 返回顺序与输入一致（高价在前）。纯函数。
List<AggBookLevel> withCumulative(List<AggBookLevel> rows, bool isAsk) {
  if (rows.isEmpty) return rows;
  if (isAsk) {
    double acc = 0;
    final List<AggBookLevel> out = <AggBookLevel>[];
    for (final AggBookLevel r in rows.reversed) {
      acc += r.qty;
      out.add(r.copyWith(total: acc));
    }
    return out.reversed.toList();
  }
  double acc = 0;
  return rows.map((AggBookLevel r) {
    acc += r.qty;
    return r.copyWith(total: acc);
  }).toList();
}

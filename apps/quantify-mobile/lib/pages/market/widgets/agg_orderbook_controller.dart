import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter/material.dart' show Color;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/agg_market_data.dart';
import '../../../data/providers.dart';
import 'agg_orderbook_math.dart';

/// 订单簿视图模式。
enum AggView { both, asks, bids }

/// 加载/错误态空 bundle 占位（渲染空盘口，不抛错）。
const AggMarketData kEmptyAggData = AggMarketData(
  exchanges: <AggExchange>[],
  exchangeMap: <String, AggExchange>{},
  precisions: <int>[],
  asks: <AggBookLevel>[],
  bids: <AggBookLevel>[],
  oiCoins: <String>[],
  oiExchangeMap: <String, AggExchange>{},
  oiData: <String, OiSnapshot>{},
  volCoins: <String>[],
  volExchangeName: <String, String>{},
  volColor: <String, Color>{},
  volData: <String, VolSnapshot>{},
  coinColor: <String, Color>{},
);

/// 聚合挂单卡输入态（issue #2218 C4）。
///
/// 仅持**输入态**：来源筛选选中集合、价格精度、视图模式。派生结果（asks/bids
/// /maxCum/bestAsk/bestBid）不入 state，避免与 [aggOrderbookProvider] 原始
/// levels 形成双源——派生由 [AggOrderbookController] 的 computed getter/method
/// 经 `ref.watch(aggOrderbookProvider)` 实时计算。
class AggOrderbookState {
  const AggOrderbookState({
    this.selectedEx,
    this.precision = 1,
    this.view = AggView.both,
  });

  /// 来源筛选选中集合。null = 尚未初始化（首帧有数据时填全选）。
  final Set<String>? selectedEx;

  /// 价格精度桶（`bucket > 1` 时聚合）。
  final int precision;

  /// 订单簿视图模式（双向/卖/买）。
  final AggView view;

  AggOrderbookState copyWith({
    Set<String>? selectedEx,
    int? precision,
    AggView? view,
  }) {
    return AggOrderbookState(
      selectedEx: selectedEx ?? this.selectedEx,
      precision: precision ?? this.precision,
      view: view ?? this.view,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AggOrderbookState &&
          runtimeType == other.runtimeType &&
          precision == other.precision &&
          view == other.view &&
          setEquals(selectedEx, other.selectedEx);

  @override
  int get hashCode => Object.hash(
    precision,
    view,
    // Set 顺序无关：以元素哈希异或聚合，保证与 setEquals 判等一致。
    selectedEx?.fold<int>(0, (int acc, String e) => acc ^ e.hashCode),
  );
}

/// 聚合挂单卡控制器（issue #2218 C4）。
///
/// 选择态/精度/视图模式收口于此；过滤 + 聚合 + 累计派生由 [asks]/[bids] 经
/// `ref.watch(aggOrderbookProvider)` 取原始 levels 后实时计算（`aggregateLevels`
/// /`withCumulative` 算法本体不改，仅改执行位置）。View 仅 `ref.watch` 取派生结果。
class AggOrderbookController extends Notifier<AggOrderbookState> {
  @override
  AggOrderbookState build() => const AggOrderbookState();

  /// 解析来源选中集合：已有用户选择则用之；否则用全集（首帧初始化）。
  /// 数据为空（加载中）时返回空集，待真实数据到达再全选。
  Set<String> _resolveSelection(AggMarketData data) {
    final Set<String> all = data.exchanges
        .map((AggExchange e) => e.key)
        .toSet();
    final Set<String>? selected = state.selectedEx;
    if (all.isEmpty) return const <String>{};
    if (selected == null) return all;
    if (selected.isEmpty) return const <String>{};
    final Set<String> clamped = selected.intersection(all);
    return clamped.isEmpty ? all : clamped;
  }

  /// 单侧派生：按选中来源过滤 → 按精度聚合 → 填充累计量。纯派生，不改 state。
  List<AggBookLevel> _side(
    List<AggBookLevel> raw,
    bool isAsk,
    Set<String> selected,
  ) {
    final List<AggBookLevel> filtered = raw
        .where((AggBookLevel r) => selected.contains(r.exchange))
        .toList();
    return withCumulative(
      aggregateLevels(filtered, state.precision, isAsk),
      isAsk,
    );
  }

  /// 卖盘派生（含累计）。[data] 由 View `ref.watch(aggOrderbookProvider)` 传入，
  /// 与 [state] 输入态共同决定结果，保证 View 在原始数据/输入态变化时重建。
  List<AggBookLevel> asksOf(AggMarketData data) =>
      _side(data.asks, true, _resolveSelection(data));

  /// 买盘派生（含累计）。语义同 [asksOf]。
  List<AggBookLevel> bidsOf(AggMarketData data) =>
      _side(data.bids, false, _resolveSelection(data));

  /// 当前帧精度档位（供精度抽屉渲染选项；一次性 read，非响应式）。
  List<int> get precisions =>
      ref.read(aggOrderbookProvider).value?.precisions ?? const <int>[];

  /// 当前帧来源列表（供来源抽屉渲染选项；一次性 read，非响应式）。
  List<AggExchange> get exchanges =>
      ref.read(aggOrderbookProvider).value?.exchanges ?? const <AggExchange>[];

  /// 解析后的当前选中集合（一次性 read，供来源抽屉初始选中回退）。
  Set<String> get currentSelection =>
      _resolveSelection(ref.read(aggOrderbookProvider).value ?? kEmptyAggData);

  /// 指定数据下解析后的当前选中集合。
  Set<String> currentSelectionOf(AggMarketData data) => _resolveSelection(data);

  void setExchanges(Set<String> selected) {
    // 防御性拷贝：避免外部持有同一可变 Set 实例后静默 mutate state。
    state = state.copyWith(selectedEx: selected.toSet());
  }

  void setPrecision(int precision) {
    state = state.copyWith(precision: precision);
  }

  void setView(AggView view) {
    state = state.copyWith(view: view);
  }
}

final aggOrderbookControllerProvider =
    NotifierProvider.autoDispose<AggOrderbookController, AggOrderbookState>(
      AggOrderbookController.new,
    );

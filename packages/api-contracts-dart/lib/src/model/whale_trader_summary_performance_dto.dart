//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_trader_summary_performance_dto.g.dart';

/// WhaleTraderSummaryPerformanceDto
///
/// Properties:
/// * [address] - 鲸鱼地址（链上地址）
/// * [lookbackDays] - 统计使用的回溯天数，例如 7 表示近 7 天内的 Hyperliquid Whale Alert 数据
/// * [symbolFilter] - 可选的币种过滤条件，若存在则仅统计该币种下的预警记录
/// * [trades] - 时间窗口内的鲸鱼预警总条数（视作成交/开平仓次数的近似值，不代表真实成交笔数）
/// * [positions] - 时间窗口内涉及的币种数量（去重后的 symbol 数量）
/// * [totalValueUsd] - 时间窗口内名义价值总和（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合，不代表账户真实资产净值。
/// * [longCount] - 多头方向的预警条数（positionSize > 0）
/// * [shortCount] - 空头方向的预警条数（positionSize < 0）
/// * [winRatePct] - 胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于可视化展示，不代表真实历史胜率。
/// * [pnlUsd] - 实现盈亏（USD）。当前实现为基于名义价值与多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。
@BuiltValue()
abstract class WhaleTraderSummaryPerformanceDto implements Built<WhaleTraderSummaryPerformanceDto, WhaleTraderSummaryPerformanceDtoBuilder> {
  /// 鲸鱼地址（链上地址）
  @BuiltValueField(wireName: r'address')
  String get address;

  /// 统计使用的回溯天数，例如 7 表示近 7 天内的 Hyperliquid Whale Alert 数据
  @BuiltValueField(wireName: r'lookbackDays')
  num get lookbackDays;

  /// 可选的币种过滤条件，若存在则仅统计该币种下的预警记录
  @BuiltValueField(wireName: r'symbolFilter')
  String? get symbolFilter;

  /// 时间窗口内的鲸鱼预警总条数（视作成交/开平仓次数的近似值，不代表真实成交笔数）
  @BuiltValueField(wireName: r'trades')
  num get trades;

  /// 时间窗口内涉及的币种数量（去重后的 symbol 数量）
  @BuiltValueField(wireName: r'positions')
  num get positions;

  /// 时间窗口内名义价值总和（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合，不代表账户真实资产净值。
  @BuiltValueField(wireName: r'totalValueUsd')
  num get totalValueUsd;

  /// 多头方向的预警条数（positionSize > 0）
  @BuiltValueField(wireName: r'longCount')
  num get longCount;

  /// 空头方向的预警条数（positionSize < 0）
  @BuiltValueField(wireName: r'shortCount')
  num get shortCount;

  /// 胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于可视化展示，不代表真实历史胜率。
  @BuiltValueField(wireName: r'winRatePct')
  num get winRatePct;

  /// 实现盈亏（USD）。当前实现为基于名义价值与多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。
  @BuiltValueField(wireName: r'pnlUsd')
  num get pnlUsd;

  WhaleTraderSummaryPerformanceDto._();

  factory WhaleTraderSummaryPerformanceDto([void updates(WhaleTraderSummaryPerformanceDtoBuilder b)]) = _$WhaleTraderSummaryPerformanceDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleTraderSummaryPerformanceDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleTraderSummaryPerformanceDto> get serializer => _$WhaleTraderSummaryPerformanceDtoSerializer();
}

class _$WhaleTraderSummaryPerformanceDtoSerializer implements PrimitiveSerializer<WhaleTraderSummaryPerformanceDto> {
  @override
  final Iterable<Type> types = const [WhaleTraderSummaryPerformanceDto, _$WhaleTraderSummaryPerformanceDto];

  @override
  final String wireName = r'WhaleTraderSummaryPerformanceDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleTraderSummaryPerformanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'address';
    yield serializers.serialize(
      object.address,
      specifiedType: const FullType(String),
    );
    yield r'lookbackDays';
    yield serializers.serialize(
      object.lookbackDays,
      specifiedType: const FullType(num),
    );
    if (object.symbolFilter != null) {
      yield r'symbolFilter';
      yield serializers.serialize(
        object.symbolFilter,
        specifiedType: const FullType(String),
      );
    }
    yield r'trades';
    yield serializers.serialize(
      object.trades,
      specifiedType: const FullType(num),
    );
    yield r'positions';
    yield serializers.serialize(
      object.positions,
      specifiedType: const FullType(num),
    );
    yield r'totalValueUsd';
    yield serializers.serialize(
      object.totalValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'longCount';
    yield serializers.serialize(
      object.longCount,
      specifiedType: const FullType(num),
    );
    yield r'shortCount';
    yield serializers.serialize(
      object.shortCount,
      specifiedType: const FullType(num),
    );
    yield r'winRatePct';
    yield serializers.serialize(
      object.winRatePct,
      specifiedType: const FullType(num),
    );
    yield r'pnlUsd';
    yield serializers.serialize(
      object.pnlUsd,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleTraderSummaryPerformanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleTraderSummaryPerformanceDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.address = valueDes;
          break;
        case r'lookbackDays':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.lookbackDays = valueDes;
          break;
        case r'symbolFilter':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbolFilter = valueDes;
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.trades = valueDes;
          break;
        case r'positions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positions = valueDes;
          break;
        case r'totalValueUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalValueUsd = valueDes;
          break;
        case r'longCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longCount = valueDes;
          break;
        case r'shortCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortCount = valueDes;
          break;
        case r'winRatePct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.winRatePct = valueDes;
          break;
        case r'pnlUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.pnlUsd = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleTraderSummaryPerformanceDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleTraderSummaryPerformanceDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}


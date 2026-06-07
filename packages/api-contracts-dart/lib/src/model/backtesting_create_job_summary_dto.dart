//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_summary_dto.g.dart';

/// BacktestingCreateJobSummaryDto
///
/// Properties:
/// * [netProfit] - 净利润（计价货币）
/// * [netProfitPct] - 净利润百分比（%）
/// * [maxDrawdownPct] - 最大回撤百分比（%）
/// * [winRate] - 胜率（0-1 之间的小数）
/// * [profitFactor] - 盈亏比（无可用数据时为 null）
/// * [totalTrades] - 总交易次数
/// * [totalOpenTrades] 
/// * [openPnl] 
@BuiltValue()
abstract class BacktestingCreateJobSummaryDto implements Built<BacktestingCreateJobSummaryDto, BacktestingCreateJobSummaryDtoBuilder> {
  /// 净利润（计价货币）
  @BuiltValueField(wireName: r'netProfit')
  num get netProfit;

  /// 净利润百分比（%）
  @BuiltValueField(wireName: r'netProfitPct')
  num get netProfitPct;

  /// 最大回撤百分比（%）
  @BuiltValueField(wireName: r'maxDrawdownPct')
  num get maxDrawdownPct;

  /// 胜率（0-1 之间的小数）
  @BuiltValueField(wireName: r'winRate')
  num get winRate;

  /// 盈亏比（无可用数据时为 null）
  @BuiltValueField(wireName: r'profitFactor')
  num? get profitFactor;

  /// 总交易次数
  @BuiltValueField(wireName: r'totalTrades')
  num get totalTrades;

  @BuiltValueField(wireName: r'totalOpenTrades')
  num? get totalOpenTrades;

  @BuiltValueField(wireName: r'openPnl')
  num? get openPnl;

  BacktestingCreateJobSummaryDto._();

  factory BacktestingCreateJobSummaryDto([void updates(BacktestingCreateJobSummaryDtoBuilder b)]) = _$BacktestingCreateJobSummaryDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobSummaryDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobSummaryDto> get serializer => _$BacktestingCreateJobSummaryDtoSerializer();
}

class _$BacktestingCreateJobSummaryDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobSummaryDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobSummaryDto, _$BacktestingCreateJobSummaryDto];

  @override
  final String wireName = r'BacktestingCreateJobSummaryDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobSummaryDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'netProfit';
    yield serializers.serialize(
      object.netProfit,
      specifiedType: const FullType(num),
    );
    yield r'netProfitPct';
    yield serializers.serialize(
      object.netProfitPct,
      specifiedType: const FullType(num),
    );
    yield r'maxDrawdownPct';
    yield serializers.serialize(
      object.maxDrawdownPct,
      specifiedType: const FullType(num),
    );
    yield r'winRate';
    yield serializers.serialize(
      object.winRate,
      specifiedType: const FullType(num),
    );
    yield r'profitFactor';
    yield object.profitFactor == null ? null : serializers.serialize(
      object.profitFactor,
      specifiedType: const FullType.nullable(num),
    );
    yield r'totalTrades';
    yield serializers.serialize(
      object.totalTrades,
      specifiedType: const FullType(num),
    );
    if (object.totalOpenTrades != null) {
      yield r'totalOpenTrades';
      yield serializers.serialize(
        object.totalOpenTrades,
        specifiedType: const FullType(num),
      );
    }
    if (object.openPnl != null) {
      yield r'openPnl';
      yield serializers.serialize(
        object.openPnl,
        specifiedType: const FullType(num),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobSummaryDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobSummaryDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'netProfit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.netProfit = valueDes;
          break;
        case r'netProfitPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.netProfitPct = valueDes;
          break;
        case r'maxDrawdownPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxDrawdownPct = valueDes;
          break;
        case r'winRate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.winRate = valueDes;
          break;
        case r'profitFactor':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.profitFactor = valueDes;
          break;
        case r'totalTrades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalTrades = valueDes;
          break;
        case r'totalOpenTrades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalOpenTrades = valueDes;
          break;
        case r'openPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openPnl = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobSummaryDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobSummaryDtoBuilder();
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


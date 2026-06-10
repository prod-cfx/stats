//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_official_backtest_metrics_response_dto.g.dart';

/// StrategyPlazaOfficialBacktestMetricsResponseDto
///
/// Properties:
/// * [returnPct] 
/// * [winRatePct] 
/// * [maxDrawdownPct] 
/// * [tradeCount] 
@BuiltValue()
abstract class StrategyPlazaOfficialBacktestMetricsResponseDto implements Built<StrategyPlazaOfficialBacktestMetricsResponseDto, StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder> {
  @BuiltValueField(wireName: r'returnPct')
  num? get returnPct;

  @BuiltValueField(wireName: r'winRatePct')
  num? get winRatePct;

  @BuiltValueField(wireName: r'maxDrawdownPct')
  num? get maxDrawdownPct;

  @BuiltValueField(wireName: r'tradeCount')
  num? get tradeCount;

  StrategyPlazaOfficialBacktestMetricsResponseDto._();

  factory StrategyPlazaOfficialBacktestMetricsResponseDto([void updates(StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder b)]) = _$StrategyPlazaOfficialBacktestMetricsResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaOfficialBacktestMetricsResponseDto> get serializer => _$StrategyPlazaOfficialBacktestMetricsResponseDtoSerializer();
}

class _$StrategyPlazaOfficialBacktestMetricsResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaOfficialBacktestMetricsResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaOfficialBacktestMetricsResponseDto, _$StrategyPlazaOfficialBacktestMetricsResponseDto];

  @override
  final String wireName = r'StrategyPlazaOfficialBacktestMetricsResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaOfficialBacktestMetricsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.returnPct != null) {
      yield r'returnPct';
      yield serializers.serialize(
        object.returnPct,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.winRatePct != null) {
      yield r'winRatePct';
      yield serializers.serialize(
        object.winRatePct,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.maxDrawdownPct != null) {
      yield r'maxDrawdownPct';
      yield serializers.serialize(
        object.maxDrawdownPct,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.tradeCount != null) {
      yield r'tradeCount';
      yield serializers.serialize(
        object.tradeCount,
        specifiedType: const FullType.nullable(num),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestMetricsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'returnPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.returnPct = valueDes;
          break;
        case r'winRatePct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.winRatePct = valueDes;
          break;
        case r'maxDrawdownPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.maxDrawdownPct = valueDes;
          break;
        case r'tradeCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.tradeCount = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaOfficialBacktestMetricsResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder();
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


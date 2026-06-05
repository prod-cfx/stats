//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_display_metrics_response_dto.g.dart';

/// StrategyPlazaDisplayMetricsResponseDto
///
/// Properties:
/// * [label] 
/// * [returnPct] 
/// * [winRatePct] 
/// * [maxDrawdownPct] 
@BuiltValue()
abstract class StrategyPlazaDisplayMetricsResponseDto implements Built<StrategyPlazaDisplayMetricsResponseDto, StrategyPlazaDisplayMetricsResponseDtoBuilder> {
  @BuiltValueField(wireName: r'label')
  StrategyPlazaDisplayMetricsResponseDtoLabelEnum get label;
  // enum labelEnum {  official_sample_backtest,  };

  @BuiltValueField(wireName: r'returnPct')
  num? get returnPct;

  @BuiltValueField(wireName: r'winRatePct')
  num? get winRatePct;

  @BuiltValueField(wireName: r'maxDrawdownPct')
  num? get maxDrawdownPct;

  StrategyPlazaDisplayMetricsResponseDto._();

  factory StrategyPlazaDisplayMetricsResponseDto([void updates(StrategyPlazaDisplayMetricsResponseDtoBuilder b)]) = _$StrategyPlazaDisplayMetricsResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaDisplayMetricsResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaDisplayMetricsResponseDto> get serializer => _$StrategyPlazaDisplayMetricsResponseDtoSerializer();
}

class _$StrategyPlazaDisplayMetricsResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaDisplayMetricsResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaDisplayMetricsResponseDto, _$StrategyPlazaDisplayMetricsResponseDto];

  @override
  final String wireName = r'StrategyPlazaDisplayMetricsResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaDisplayMetricsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'label';
    yield serializers.serialize(
      object.label,
      specifiedType: const FullType(StrategyPlazaDisplayMetricsResponseDtoLabelEnum),
    );
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
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaDisplayMetricsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaDisplayMetricsResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'label':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaDisplayMetricsResponseDtoLabelEnum),
          ) as StrategyPlazaDisplayMetricsResponseDtoLabelEnum;
          result.label = valueDes;
          break;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaDisplayMetricsResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaDisplayMetricsResponseDtoBuilder();
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

class StrategyPlazaDisplayMetricsResponseDtoLabelEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'official_sample_backtest')
  static const StrategyPlazaDisplayMetricsResponseDtoLabelEnum officialSampleBacktest = _$strategyPlazaDisplayMetricsResponseDtoLabelEnum_officialSampleBacktest;

  static Serializer<StrategyPlazaDisplayMetricsResponseDtoLabelEnum> get serializer => _$strategyPlazaDisplayMetricsResponseDtoLabelEnumSerializer;

  const StrategyPlazaDisplayMetricsResponseDtoLabelEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaDisplayMetricsResponseDtoLabelEnum> get values => _$strategyPlazaDisplayMetricsResponseDtoLabelEnumValues;
  static StrategyPlazaDisplayMetricsResponseDtoLabelEnum valueOf(String name) => _$strategyPlazaDisplayMetricsResponseDtoLabelEnumValueOf(name);
}


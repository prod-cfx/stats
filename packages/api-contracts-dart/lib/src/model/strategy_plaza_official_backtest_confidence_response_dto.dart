//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_official_backtest_confidence_response_dto.g.dart';

/// StrategyPlazaOfficialBacktestConfidenceResponseDto
///
/// Properties:
/// * [level] 
/// * [reasons] 
@BuiltValue()
abstract class StrategyPlazaOfficialBacktestConfidenceResponseDto implements Built<StrategyPlazaOfficialBacktestConfidenceResponseDto, StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder> {
  @BuiltValueField(wireName: r'level')
  StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum get level;
  // enum levelEnum {  high,  medium,  low,  };

  @BuiltValueField(wireName: r'reasons')
  BuiltList<String> get reasons;

  StrategyPlazaOfficialBacktestConfidenceResponseDto._();

  factory StrategyPlazaOfficialBacktestConfidenceResponseDto([void updates(StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder b)]) = _$StrategyPlazaOfficialBacktestConfidenceResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaOfficialBacktestConfidenceResponseDto> get serializer => _$StrategyPlazaOfficialBacktestConfidenceResponseDtoSerializer();
}

class _$StrategyPlazaOfficialBacktestConfidenceResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaOfficialBacktestConfidenceResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaOfficialBacktestConfidenceResponseDto, _$StrategyPlazaOfficialBacktestConfidenceResponseDto];

  @override
  final String wireName = r'StrategyPlazaOfficialBacktestConfidenceResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaOfficialBacktestConfidenceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'level';
    yield serializers.serialize(
      object.level,
      specifiedType: const FullType(StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum),
    );
    yield r'reasons';
    yield serializers.serialize(
      object.reasons,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestConfidenceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'level':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum),
          ) as StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum;
          result.level = valueDes;
          break;
        case r'reasons':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.reasons.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaOfficialBacktestConfidenceResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder();
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

class StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'high')
  static const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum high = _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_high;
  @BuiltValueEnumConst(wireName: r'medium')
  static const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum medium = _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_medium;
  @BuiltValueEnumConst(wireName: r'low')
  static const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum low = _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_low;

  static Serializer<StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum> get serializer => _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumSerializer;

  const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum> get values => _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumValues;
  static StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum valueOf(String name) => _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumValueOf(name);
}


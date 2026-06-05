//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/account_ai_quant_strategy_detail_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_run_existing_response_dto.g.dart';

/// StrategyPlazaRunExistingResponseDto
///
/// Properties:
/// * [result] 
/// * [strategy] 
@BuiltValue()
abstract class StrategyPlazaRunExistingResponseDto implements Built<StrategyPlazaRunExistingResponseDto, StrategyPlazaRunExistingResponseDtoBuilder> {
  @BuiltValueField(wireName: r'result')
  StrategyPlazaRunExistingResponseDtoResultEnum get result;
  // enum resultEnum {  existing,  };

  @BuiltValueField(wireName: r'strategy')
  AccountAiQuantStrategyDetailResponseDto get strategy;

  StrategyPlazaRunExistingResponseDto._();

  factory StrategyPlazaRunExistingResponseDto([void updates(StrategyPlazaRunExistingResponseDtoBuilder b)]) = _$StrategyPlazaRunExistingResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaRunExistingResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaRunExistingResponseDto> get serializer => _$StrategyPlazaRunExistingResponseDtoSerializer();
}

class _$StrategyPlazaRunExistingResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaRunExistingResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaRunExistingResponseDto, _$StrategyPlazaRunExistingResponseDto];

  @override
  final String wireName = r'StrategyPlazaRunExistingResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaRunExistingResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'result';
    yield serializers.serialize(
      object.result,
      specifiedType: const FullType(StrategyPlazaRunExistingResponseDtoResultEnum),
    );
    yield r'strategy';
    yield serializers.serialize(
      object.strategy,
      specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaRunExistingResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaRunExistingResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'result':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaRunExistingResponseDtoResultEnum),
          ) as StrategyPlazaRunExistingResponseDtoResultEnum;
          result.result = valueDes;
          break;
        case r'strategy':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDto),
          ) as AccountAiQuantStrategyDetailResponseDto;
          result.strategy.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaRunExistingResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaRunExistingResponseDtoBuilder();
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

class StrategyPlazaRunExistingResponseDtoResultEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'existing')
  static const StrategyPlazaRunExistingResponseDtoResultEnum existing = _$strategyPlazaRunExistingResponseDtoResultEnum_existing;

  static Serializer<StrategyPlazaRunExistingResponseDtoResultEnum> get serializer => _$strategyPlazaRunExistingResponseDtoResultEnumSerializer;

  const StrategyPlazaRunExistingResponseDtoResultEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaRunExistingResponseDtoResultEnum> get values => _$strategyPlazaRunExistingResponseDtoResultEnumValues;
  static StrategyPlazaRunExistingResponseDtoResultEnum valueOf(String name) => _$strategyPlazaRunExistingResponseDtoResultEnumValueOf(name);
}


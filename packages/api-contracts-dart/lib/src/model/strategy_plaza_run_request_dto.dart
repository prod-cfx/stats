//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_run_request_dto.g.dart';

/// StrategyPlazaRunRequestDto
///
/// Properties:
/// * [runRequestId] 
@BuiltValue()
abstract class StrategyPlazaRunRequestDto implements Built<StrategyPlazaRunRequestDto, StrategyPlazaRunRequestDtoBuilder> {
  @BuiltValueField(wireName: r'runRequestId')
  String get runRequestId;

  StrategyPlazaRunRequestDto._();

  factory StrategyPlazaRunRequestDto([void updates(StrategyPlazaRunRequestDtoBuilder b)]) = _$StrategyPlazaRunRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaRunRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaRunRequestDto> get serializer => _$StrategyPlazaRunRequestDtoSerializer();
}

class _$StrategyPlazaRunRequestDtoSerializer implements PrimitiveSerializer<StrategyPlazaRunRequestDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaRunRequestDto, _$StrategyPlazaRunRequestDto];

  @override
  final String wireName = r'StrategyPlazaRunRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaRunRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'runRequestId';
    yield serializers.serialize(
      object.runRequestId,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaRunRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaRunRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'runRequestId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.runRequestId = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaRunRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaRunRequestDtoBuilder();
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


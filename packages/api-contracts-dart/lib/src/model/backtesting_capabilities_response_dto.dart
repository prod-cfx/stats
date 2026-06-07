//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_capabilities_response_dto.g.dart';

/// BacktestingCapabilitiesResponseDto
///
/// Properties:
/// * [allowedBaseTimeframes] 
@BuiltValue()
abstract class BacktestingCapabilitiesResponseDto implements Built<BacktestingCapabilitiesResponseDto, BacktestingCapabilitiesResponseDtoBuilder> {
  @BuiltValueField(wireName: r'allowedBaseTimeframes')
  BuiltList<String> get allowedBaseTimeframes;

  BacktestingCapabilitiesResponseDto._();

  factory BacktestingCapabilitiesResponseDto([void updates(BacktestingCapabilitiesResponseDtoBuilder b)]) = _$BacktestingCapabilitiesResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCapabilitiesResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCapabilitiesResponseDto> get serializer => _$BacktestingCapabilitiesResponseDtoSerializer();
}

class _$BacktestingCapabilitiesResponseDtoSerializer implements PrimitiveSerializer<BacktestingCapabilitiesResponseDto> {
  @override
  final Iterable<Type> types = const [BacktestingCapabilitiesResponseDto, _$BacktestingCapabilitiesResponseDto];

  @override
  final String wireName = r'BacktestingCapabilitiesResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCapabilitiesResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'allowedBaseTimeframes';
    yield serializers.serialize(
      object.allowedBaseTimeframes,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCapabilitiesResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCapabilitiesResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'allowedBaseTimeframes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.allowedBaseTimeframes.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCapabilitiesResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCapabilitiesResponseDtoBuilder();
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


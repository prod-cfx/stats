//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'base_response_dto.g.dart';

/// BaseResponseDto
///
/// Properties:
/// * [data] - 响应数据
/// * [message] - 提示信息
@BuiltValue(instantiable: false)
abstract class BaseResponseDto  {
  /// 响应数据
  @BuiltValueField(wireName: r'data')
  JsonObject get data;

  /// 提示信息
  @BuiltValueField(wireName: r'message')
  String? get message;

  @BuiltValueSerializer(custom: true)
  static Serializer<BaseResponseDto> get serializer => _$BaseResponseDtoSerializer();
}

class _$BaseResponseDtoSerializer implements PrimitiveSerializer<BaseResponseDto> {
  @override
  final Iterable<Type> types = const [BaseResponseDto];

  @override
  final String wireName = r'BaseResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BaseResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(JsonObject),
    );
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BaseResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  @override
  BaseResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return serializers.deserialize(serialized, specifiedType: FullType($BaseResponseDto)) as $BaseResponseDto;
  }
}

/// a concrete implementation of [BaseResponseDto], since [BaseResponseDto] is not instantiable
@BuiltValue(instantiable: true)
abstract class $BaseResponseDto implements BaseResponseDto, Built<$BaseResponseDto, $BaseResponseDtoBuilder> {
  $BaseResponseDto._();

  factory $BaseResponseDto([void Function($BaseResponseDtoBuilder)? updates]) = _$$BaseResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults($BaseResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<$BaseResponseDto> get serializer => _$$BaseResponseDtoSerializer();
}

class _$$BaseResponseDtoSerializer implements PrimitiveSerializer<$BaseResponseDto> {
  @override
  final Iterable<Type> types = const [$BaseResponseDto, _$$BaseResponseDto];

  @override
  final String wireName = r'$BaseResponseDto';

  @override
  Object serialize(
    Serializers serializers,
    $BaseResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return serializers.serialize(object, specifiedType: FullType(BaseResponseDto))!;
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BaseResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(JsonObject),
          ) as JsonObject;
          result.data = valueDes;
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  $BaseResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = $BaseResponseDtoBuilder();
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


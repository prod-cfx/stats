//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'bind_email_request_dto.g.dart';

/// BindEmailRequestDto
///
/// Properties:
/// * [email] - Email address
/// * [code] - 6-digit verification code
@BuiltValue()
abstract class BindEmailRequestDto implements Built<BindEmailRequestDto, BindEmailRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  /// 6-digit verification code
  @BuiltValueField(wireName: r'code')
  String get code;

  BindEmailRequestDto._();

  factory BindEmailRequestDto([void updates(BindEmailRequestDtoBuilder b)]) = _$BindEmailRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BindEmailRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BindEmailRequestDto> get serializer => _$BindEmailRequestDtoSerializer();
}

class _$BindEmailRequestDtoSerializer implements PrimitiveSerializer<BindEmailRequestDto> {
  @override
  final Iterable<Type> types = const [BindEmailRequestDto, _$BindEmailRequestDto];

  @override
  final String wireName = r'BindEmailRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BindEmailRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BindEmailRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BindEmailRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BindEmailRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BindEmailRequestDtoBuilder();
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


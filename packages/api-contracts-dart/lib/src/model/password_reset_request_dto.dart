//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'password_reset_request_dto.g.dart';

/// PasswordResetRequestDto
///
/// Properties:
/// * [email] - Email address
@BuiltValue()
abstract class PasswordResetRequestDto implements Built<PasswordResetRequestDto, PasswordResetRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  PasswordResetRequestDto._();

  factory PasswordResetRequestDto([void updates(PasswordResetRequestDtoBuilder b)]) = _$PasswordResetRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PasswordResetRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PasswordResetRequestDto> get serializer => _$PasswordResetRequestDtoSerializer();
}

class _$PasswordResetRequestDtoSerializer implements PrimitiveSerializer<PasswordResetRequestDto> {
  @override
  final Iterable<Type> types = const [PasswordResetRequestDto, _$PasswordResetRequestDto];

  @override
  final String wireName = r'PasswordResetRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PasswordResetRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    PasswordResetRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required PasswordResetRequestDtoBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  PasswordResetRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PasswordResetRequestDtoBuilder();
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


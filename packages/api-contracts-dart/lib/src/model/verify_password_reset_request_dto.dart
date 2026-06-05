//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'verify_password_reset_request_dto.g.dart';

/// VerifyPasswordResetRequestDto
///
/// Properties:
/// * [email] - Email address
/// * [code] - 6-digit reset code
/// * [newPassword] - New password
@BuiltValue()
abstract class VerifyPasswordResetRequestDto implements Built<VerifyPasswordResetRequestDto, VerifyPasswordResetRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  /// 6-digit reset code
  @BuiltValueField(wireName: r'code')
  String get code;

  /// New password
  @BuiltValueField(wireName: r'newPassword')
  String get newPassword;

  VerifyPasswordResetRequestDto._();

  factory VerifyPasswordResetRequestDto([void updates(VerifyPasswordResetRequestDtoBuilder b)]) = _$VerifyPasswordResetRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(VerifyPasswordResetRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<VerifyPasswordResetRequestDto> get serializer => _$VerifyPasswordResetRequestDtoSerializer();
}

class _$VerifyPasswordResetRequestDtoSerializer implements PrimitiveSerializer<VerifyPasswordResetRequestDto> {
  @override
  final Iterable<Type> types = const [VerifyPasswordResetRequestDto, _$VerifyPasswordResetRequestDto];

  @override
  final String wireName = r'VerifyPasswordResetRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    VerifyPasswordResetRequestDto object, {
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
    yield r'newPassword';
    yield serializers.serialize(
      object.newPassword,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    VerifyPasswordResetRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required VerifyPasswordResetRequestDtoBuilder result,
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
        case r'newPassword':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.newPassword = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  VerifyPasswordResetRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = VerifyPasswordResetRequestDtoBuilder();
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


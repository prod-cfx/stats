//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'resend_verification_request_dto.g.dart';

/// ResendVerificationRequestDto
///
/// Properties:
/// * [email] - Email address
@BuiltValue()
abstract class ResendVerificationRequestDto implements Built<ResendVerificationRequestDto, ResendVerificationRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  ResendVerificationRequestDto._();

  factory ResendVerificationRequestDto([void updates(ResendVerificationRequestDtoBuilder b)]) = _$ResendVerificationRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ResendVerificationRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ResendVerificationRequestDto> get serializer => _$ResendVerificationRequestDtoSerializer();
}

class _$ResendVerificationRequestDtoSerializer implements PrimitiveSerializer<ResendVerificationRequestDto> {
  @override
  final Iterable<Type> types = const [ResendVerificationRequestDto, _$ResendVerificationRequestDto];

  @override
  final String wireName = r'ResendVerificationRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ResendVerificationRequestDto object, {
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
    ResendVerificationRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ResendVerificationRequestDtoBuilder result,
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
  ResendVerificationRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ResendVerificationRequestDtoBuilder();
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


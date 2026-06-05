//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'send_email_login_code_request_dto.g.dart';

/// SendEmailLoginCodeRequestDto
///
/// Properties:
/// * [email] - Email address
@BuiltValue()
abstract class SendEmailLoginCodeRequestDto implements Built<SendEmailLoginCodeRequestDto, SendEmailLoginCodeRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  SendEmailLoginCodeRequestDto._();

  factory SendEmailLoginCodeRequestDto([void updates(SendEmailLoginCodeRequestDtoBuilder b)]) = _$SendEmailLoginCodeRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SendEmailLoginCodeRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SendEmailLoginCodeRequestDto> get serializer => _$SendEmailLoginCodeRequestDtoSerializer();
}

class _$SendEmailLoginCodeRequestDtoSerializer implements PrimitiveSerializer<SendEmailLoginCodeRequestDto> {
  @override
  final Iterable<Type> types = const [SendEmailLoginCodeRequestDto, _$SendEmailLoginCodeRequestDto];

  @override
  final String wireName = r'SendEmailLoginCodeRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SendEmailLoginCodeRequestDto object, {
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
    SendEmailLoginCodeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SendEmailLoginCodeRequestDtoBuilder result,
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
  SendEmailLoginCodeRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SendEmailLoginCodeRequestDtoBuilder();
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


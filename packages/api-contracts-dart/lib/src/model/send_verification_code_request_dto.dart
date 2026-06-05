//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'send_verification_code_request_dto.g.dart';

/// SendVerificationCodeRequestDto
///
/// Properties:
/// * [email] - Email address
/// * [purpose] - Purpose of verification code
@BuiltValue()
abstract class SendVerificationCodeRequestDto implements Built<SendVerificationCodeRequestDto, SendVerificationCodeRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  /// Purpose of verification code
  @BuiltValueField(wireName: r'purpose')
  SendVerificationCodeRequestDtoPurposeEnum get purpose;
  // enum purposeEnum {  EMAIL_VERIFICATION,  PASSWORD_RESET,  };

  SendVerificationCodeRequestDto._();

  factory SendVerificationCodeRequestDto([void updates(SendVerificationCodeRequestDtoBuilder b)]) = _$SendVerificationCodeRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SendVerificationCodeRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SendVerificationCodeRequestDto> get serializer => _$SendVerificationCodeRequestDtoSerializer();
}

class _$SendVerificationCodeRequestDtoSerializer implements PrimitiveSerializer<SendVerificationCodeRequestDto> {
  @override
  final Iterable<Type> types = const [SendVerificationCodeRequestDto, _$SendVerificationCodeRequestDto];

  @override
  final String wireName = r'SendVerificationCodeRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SendVerificationCodeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'purpose';
    yield serializers.serialize(
      object.purpose,
      specifiedType: const FullType(SendVerificationCodeRequestDtoPurposeEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SendVerificationCodeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SendVerificationCodeRequestDtoBuilder result,
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
        case r'purpose':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SendVerificationCodeRequestDtoPurposeEnum),
          ) as SendVerificationCodeRequestDtoPurposeEnum;
          result.purpose = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SendVerificationCodeRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SendVerificationCodeRequestDtoBuilder();
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

class SendVerificationCodeRequestDtoPurposeEnum extends EnumClass {

  /// Purpose of verification code
  @BuiltValueEnumConst(wireName: r'EMAIL_VERIFICATION')
  static const SendVerificationCodeRequestDtoPurposeEnum EMAIL_VERIFICATION = _$sendVerificationCodeRequestDtoPurposeEnum_EMAIL_VERIFICATION;
  /// Purpose of verification code
  @BuiltValueEnumConst(wireName: r'PASSWORD_RESET')
  static const SendVerificationCodeRequestDtoPurposeEnum PASSWORD_RESET = _$sendVerificationCodeRequestDtoPurposeEnum_PASSWORD_RESET;

  static Serializer<SendVerificationCodeRequestDtoPurposeEnum> get serializer => _$sendVerificationCodeRequestDtoPurposeEnumSerializer;

  const SendVerificationCodeRequestDtoPurposeEnum._(String name): super(name);

  static BuiltSet<SendVerificationCodeRequestDtoPurposeEnum> get values => _$sendVerificationCodeRequestDtoPurposeEnumValues;
  static SendVerificationCodeRequestDtoPurposeEnum valueOf(String name) => _$sendVerificationCodeRequestDtoPurposeEnumValueOf(name);
}


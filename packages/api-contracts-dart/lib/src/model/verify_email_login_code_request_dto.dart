//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'verify_email_login_code_request_dto.g.dart';

/// VerifyEmailLoginCodeRequestDto
///
/// Properties:
/// * [email] - Email address
/// * [code] - 6-digit verification code
/// * [betaCode] - 内测码，首次创建用户时必填
@BuiltValue()
abstract class VerifyEmailLoginCodeRequestDto implements Built<VerifyEmailLoginCodeRequestDto, VerifyEmailLoginCodeRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  /// 6-digit verification code
  @BuiltValueField(wireName: r'code')
  String get code;

  /// 内测码，首次创建用户时必填
  @BuiltValueField(wireName: r'betaCode')
  String? get betaCode;

  VerifyEmailLoginCodeRequestDto._();

  factory VerifyEmailLoginCodeRequestDto([void updates(VerifyEmailLoginCodeRequestDtoBuilder b)]) = _$VerifyEmailLoginCodeRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(VerifyEmailLoginCodeRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<VerifyEmailLoginCodeRequestDto> get serializer => _$VerifyEmailLoginCodeRequestDtoSerializer();
}

class _$VerifyEmailLoginCodeRequestDtoSerializer implements PrimitiveSerializer<VerifyEmailLoginCodeRequestDto> {
  @override
  final Iterable<Type> types = const [VerifyEmailLoginCodeRequestDto, _$VerifyEmailLoginCodeRequestDto];

  @override
  final String wireName = r'VerifyEmailLoginCodeRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    VerifyEmailLoginCodeRequestDto object, {
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
    if (object.betaCode != null) {
      yield r'betaCode';
      yield serializers.serialize(
        object.betaCode,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    VerifyEmailLoginCodeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required VerifyEmailLoginCodeRequestDtoBuilder result,
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
        case r'betaCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.betaCode = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  VerifyEmailLoginCodeRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = VerifyEmailLoginCodeRequestDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'verify_email_request_dto.g.dart';

/// VerifyEmailRequestDto
///
/// Properties:
/// * [email] - Email address
/// * [code] - 6-digit verification code
/// * [updateUserStatus] - Whether to update user status automatically
@BuiltValue()
abstract class VerifyEmailRequestDto implements Built<VerifyEmailRequestDto, VerifyEmailRequestDtoBuilder> {
  /// Email address
  @BuiltValueField(wireName: r'email')
  String get email;

  /// 6-digit verification code
  @BuiltValueField(wireName: r'code')
  String get code;

  /// Whether to update user status automatically
  @BuiltValueField(wireName: r'updateUserStatus')
  bool? get updateUserStatus;

  VerifyEmailRequestDto._();

  factory VerifyEmailRequestDto([void updates(VerifyEmailRequestDtoBuilder b)]) = _$VerifyEmailRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(VerifyEmailRequestDtoBuilder b) => b
      ..updateUserStatus = true;

  @BuiltValueSerializer(custom: true)
  static Serializer<VerifyEmailRequestDto> get serializer => _$VerifyEmailRequestDtoSerializer();
}

class _$VerifyEmailRequestDtoSerializer implements PrimitiveSerializer<VerifyEmailRequestDto> {
  @override
  final Iterable<Type> types = const [VerifyEmailRequestDto, _$VerifyEmailRequestDto];

  @override
  final String wireName = r'VerifyEmailRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    VerifyEmailRequestDto object, {
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
    if (object.updateUserStatus != null) {
      yield r'updateUserStatus';
      yield serializers.serialize(
        object.updateUserStatus,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    VerifyEmailRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required VerifyEmailRequestDtoBuilder result,
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
        case r'updateUserStatus':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.updateUserStatus = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  VerifyEmailRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = VerifyEmailRequestDtoBuilder();
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


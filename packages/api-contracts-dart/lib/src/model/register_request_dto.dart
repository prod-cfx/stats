//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'register_request_dto.g.dart';

/// RegisterRequestDto
///
/// Properties:
/// * [email] 
/// * [password] 
/// * [nickname] 
/// * [betaCode] - 内测码，首次创建用户时必填
@BuiltValue()
abstract class RegisterRequestDto implements Built<RegisterRequestDto, RegisterRequestDtoBuilder> {
  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'password')
  String get password;

  @BuiltValueField(wireName: r'nickname')
  String? get nickname;

  /// 内测码，首次创建用户时必填
  @BuiltValueField(wireName: r'betaCode')
  String? get betaCode;

  RegisterRequestDto._();

  factory RegisterRequestDto([void updates(RegisterRequestDtoBuilder b)]) = _$RegisterRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RegisterRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RegisterRequestDto> get serializer => _$RegisterRequestDtoSerializer();
}

class _$RegisterRequestDtoSerializer implements PrimitiveSerializer<RegisterRequestDto> {
  @override
  final Iterable<Type> types = const [RegisterRequestDto, _$RegisterRequestDto];

  @override
  final String wireName = r'RegisterRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RegisterRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'password';
    yield serializers.serialize(
      object.password,
      specifiedType: const FullType(String),
    );
    if (object.nickname != null) {
      yield r'nickname';
      yield serializers.serialize(
        object.nickname,
        specifiedType: const FullType(String),
      );
    }
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
    RegisterRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RegisterRequestDtoBuilder result,
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
        case r'password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.password = valueDes;
          break;
        case r'nickname':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.nickname = valueDes;
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
  RegisterRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RegisterRequestDtoBuilder();
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


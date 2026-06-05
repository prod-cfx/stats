//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/user_profile_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_response_dto.g.dart';

/// AuthResponseDto
///
/// Properties:
/// * [accessToken] - 访问令牌
/// * [user] - 用户信息
@BuiltValue()
abstract class AuthResponseDto implements Built<AuthResponseDto, AuthResponseDtoBuilder> {
  /// 访问令牌
  @BuiltValueField(wireName: r'accessToken')
  String get accessToken;

  /// 用户信息
  @BuiltValueField(wireName: r'user')
  UserProfileResponseDto get user;

  AuthResponseDto._();

  factory AuthResponseDto([void updates(AuthResponseDtoBuilder b)]) = _$AuthResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthResponseDto> get serializer => _$AuthResponseDtoSerializer();
}

class _$AuthResponseDtoSerializer implements PrimitiveSerializer<AuthResponseDto> {
  @override
  final Iterable<Type> types = const [AuthResponseDto, _$AuthResponseDto];

  @override
  final String wireName = r'AuthResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'accessToken';
    yield serializers.serialize(
      object.accessToken,
      specifiedType: const FullType(String),
    );
    yield r'user';
    yield serializers.serialize(
      object.user,
      specifiedType: const FullType(UserProfileResponseDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AuthResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'accessToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.accessToken = valueDes;
          break;
        case r'user':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(UserProfileResponseDto),
          ) as UserProfileResponseDto;
          result.user.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AuthResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthResponseDtoBuilder();
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


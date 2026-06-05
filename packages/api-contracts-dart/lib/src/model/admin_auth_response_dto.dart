//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_profile_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_auth_response_dto.g.dart';

/// AdminAuthResponseDto
///
/// Properties:
/// * [accessToken] - 访问令牌
/// * [refreshToken] - 刷新令牌
/// * [expiresIn] - 访问令牌过期时间（字符串，例如 30m）
/// * [admin] - 管理员信息
@BuiltValue()
abstract class AdminAuthResponseDto implements Built<AdminAuthResponseDto, AdminAuthResponseDtoBuilder> {
  /// 访问令牌
  @BuiltValueField(wireName: r'accessToken')
  String get accessToken;

  /// 刷新令牌
  @BuiltValueField(wireName: r'refreshToken')
  String? get refreshToken;

  /// 访问令牌过期时间（字符串，例如 30m）
  @BuiltValueField(wireName: r'expiresIn')
  String? get expiresIn;

  /// 管理员信息
  @BuiltValueField(wireName: r'admin')
  AdminProfileDto get admin;

  AdminAuthResponseDto._();

  factory AdminAuthResponseDto([void updates(AdminAuthResponseDtoBuilder b)]) = _$AdminAuthResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminAuthResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminAuthResponseDto> get serializer => _$AdminAuthResponseDtoSerializer();
}

class _$AdminAuthResponseDtoSerializer implements PrimitiveSerializer<AdminAuthResponseDto> {
  @override
  final Iterable<Type> types = const [AdminAuthResponseDto, _$AdminAuthResponseDto];

  @override
  final String wireName = r'AdminAuthResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminAuthResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'accessToken';
    yield serializers.serialize(
      object.accessToken,
      specifiedType: const FullType(String),
    );
    if (object.refreshToken != null) {
      yield r'refreshToken';
      yield serializers.serialize(
        object.refreshToken,
        specifiedType: const FullType(String),
      );
    }
    if (object.expiresIn != null) {
      yield r'expiresIn';
      yield serializers.serialize(
        object.expiresIn,
        specifiedType: const FullType(String),
      );
    }
    yield r'admin';
    yield serializers.serialize(
      object.admin,
      specifiedType: const FullType(AdminProfileDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminAuthResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminAuthResponseDtoBuilder result,
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
        case r'refreshToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.refreshToken = valueDes;
          break;
        case r'expiresIn':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.expiresIn = valueDes;
          break;
        case r'admin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminProfileDto),
          ) as AdminProfileDto;
          result.admin.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminAuthResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminAuthResponseDtoBuilder();
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


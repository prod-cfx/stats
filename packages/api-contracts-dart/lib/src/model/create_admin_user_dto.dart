//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_admin_user_dto.g.dart';

/// CreateAdminUserDto
///
/// Properties:
/// * [username] - 登录用户名
/// * [password] - 登录密码
/// * [nickName] - 昵称
/// * [email] - 邮箱
/// * [avatarUrl] - 头像 URL
/// * [phone] - 手机号
/// * [roleIds] - 初始角色 ID 列表
@BuiltValue()
abstract class CreateAdminUserDto implements Built<CreateAdminUserDto, CreateAdminUserDtoBuilder> {
  /// 登录用户名
  @BuiltValueField(wireName: r'username')
  String get username;

  /// 登录密码
  @BuiltValueField(wireName: r'password')
  String get password;

  /// 昵称
  @BuiltValueField(wireName: r'nickName')
  String? get nickName;

  /// 邮箱
  @BuiltValueField(wireName: r'email')
  String? get email;

  /// 头像 URL
  @BuiltValueField(wireName: r'avatarUrl')
  String? get avatarUrl;

  /// 手机号
  @BuiltValueField(wireName: r'phone')
  String? get phone;

  /// 初始角色 ID 列表
  @BuiltValueField(wireName: r'roleIds')
  BuiltList<String>? get roleIds;

  CreateAdminUserDto._();

  factory CreateAdminUserDto([void updates(CreateAdminUserDtoBuilder b)]) = _$CreateAdminUserDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateAdminUserDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateAdminUserDto> get serializer => _$CreateAdminUserDtoSerializer();
}

class _$CreateAdminUserDtoSerializer implements PrimitiveSerializer<CreateAdminUserDto> {
  @override
  final Iterable<Type> types = const [CreateAdminUserDto, _$CreateAdminUserDto];

  @override
  final String wireName = r'CreateAdminUserDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateAdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'username';
    yield serializers.serialize(
      object.username,
      specifiedType: const FullType(String),
    );
    yield r'password';
    yield serializers.serialize(
      object.password,
      specifiedType: const FullType(String),
    );
    if (object.nickName != null) {
      yield r'nickName';
      yield serializers.serialize(
        object.nickName,
        specifiedType: const FullType(String),
      );
    }
    if (object.email != null) {
      yield r'email';
      yield serializers.serialize(
        object.email,
        specifiedType: const FullType(String),
      );
    }
    if (object.avatarUrl != null) {
      yield r'avatarUrl';
      yield serializers.serialize(
        object.avatarUrl,
        specifiedType: const FullType(String),
      );
    }
    if (object.phone != null) {
      yield r'phone';
      yield serializers.serialize(
        object.phone,
        specifiedType: const FullType(String),
      );
    }
    if (object.roleIds != null) {
      yield r'roleIds';
      yield serializers.serialize(
        object.roleIds,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateAdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateAdminUserDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'username':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.username = valueDes;
          break;
        case r'password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.password = valueDes;
          break;
        case r'nickName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.nickName = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'avatarUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.avatarUrl = valueDes;
          break;
        case r'phone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.phone = valueDes;
          break;
        case r'roleIds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.roleIds.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateAdminUserDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateAdminUserDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_assigned_role_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_user_dto.g.dart';

/// AdminUserDto
///
/// Properties:
/// * [id] - 管理员 ID
/// * [username] - 登录用户名
/// * [nickName] - 昵称
/// * [email] - 邮箱
/// * [avatarUrl] - 头像 URL
/// * [phone] - 手机号
/// * [isFrozen] - 是否冻结
/// * [roles] - 关联角色列表
@BuiltValue()
abstract class AdminUserDto implements Built<AdminUserDto, AdminUserDtoBuilder> {
  /// 管理员 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 登录用户名
  @BuiltValueField(wireName: r'username')
  String get username;

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

  /// 是否冻结
  @BuiltValueField(wireName: r'isFrozen')
  bool get isFrozen;

  /// 关联角色列表
  @BuiltValueField(wireName: r'roles')
  BuiltList<AdminAssignedRoleDto> get roles;

  AdminUserDto._();

  factory AdminUserDto([void updates(AdminUserDtoBuilder b)]) = _$AdminUserDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminUserDtoBuilder b) => b
      ..roles = ListBuilder();

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminUserDto> get serializer => _$AdminUserDtoSerializer();
}

class _$AdminUserDtoSerializer implements PrimitiveSerializer<AdminUserDto> {
  @override
  final Iterable<Type> types = const [AdminUserDto, _$AdminUserDto];

  @override
  final String wireName = r'AdminUserDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'username';
    yield serializers.serialize(
      object.username,
      specifiedType: const FullType(String),
    );
    yield r'nickName';
    yield object.nickName == null ? null : serializers.serialize(
      object.nickName,
      specifiedType: const FullType.nullable(String),
    );
    yield r'email';
    yield object.email == null ? null : serializers.serialize(
      object.email,
      specifiedType: const FullType.nullable(String),
    );
    yield r'avatarUrl';
    yield object.avatarUrl == null ? null : serializers.serialize(
      object.avatarUrl,
      specifiedType: const FullType.nullable(String),
    );
    yield r'phone';
    yield object.phone == null ? null : serializers.serialize(
      object.phone,
      specifiedType: const FullType.nullable(String),
    );
    yield r'isFrozen';
    yield serializers.serialize(
      object.isFrozen,
      specifiedType: const FullType(bool),
    );
    yield r'roles';
    yield serializers.serialize(
      object.roles,
      specifiedType: const FullType(BuiltList, [FullType(AdminAssignedRoleDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminUserDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'username':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.username = valueDes;
          break;
        case r'nickName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.nickName = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.email = valueDes;
          break;
        case r'avatarUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.avatarUrl = valueDes;
          break;
        case r'phone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.phone = valueDes;
          break;
        case r'isFrozen':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isFrozen = valueDes;
          break;
        case r'roles':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AdminAssignedRoleDto)]),
          ) as BuiltList<AdminAssignedRoleDto>;
          result.roles.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminUserDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminUserDtoBuilder();
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


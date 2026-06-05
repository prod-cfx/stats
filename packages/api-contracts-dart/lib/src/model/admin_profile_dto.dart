//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_profile_dto.g.dart';

/// AdminProfileDto
///
/// Properties:
/// * [id] - 管理员 ID
/// * [username] - 登录用户名
/// * [email] - 邮箱
/// * [nickName] - 昵称
/// * [isFrozen] - 账号是否冻结
/// * [menuPermissions] - 拥有的菜单权限编码
@BuiltValue()
abstract class AdminProfileDto implements Built<AdminProfileDto, AdminProfileDtoBuilder> {
  /// 管理员 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 登录用户名
  @BuiltValueField(wireName: r'username')
  String get username;

  /// 邮箱
  @BuiltValueField(wireName: r'email')
  String? get email;

  /// 昵称
  @BuiltValueField(wireName: r'nickName')
  String? get nickName;

  /// 账号是否冻结
  @BuiltValueField(wireName: r'isFrozen')
  bool get isFrozen;

  /// 拥有的菜单权限编码
  @BuiltValueField(wireName: r'menuPermissions')
  BuiltList<String> get menuPermissions;

  AdminProfileDto._();

  factory AdminProfileDto([void updates(AdminProfileDtoBuilder b)]) = _$AdminProfileDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminProfileDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminProfileDto> get serializer => _$AdminProfileDtoSerializer();
}

class _$AdminProfileDtoSerializer implements PrimitiveSerializer<AdminProfileDto> {
  @override
  final Iterable<Type> types = const [AdminProfileDto, _$AdminProfileDto];

  @override
  final String wireName = r'AdminProfileDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminProfileDto object, {
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
    if (object.email != null) {
      yield r'email';
      yield serializers.serialize(
        object.email,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.nickName != null) {
      yield r'nickName';
      yield serializers.serialize(
        object.nickName,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'isFrozen';
    yield serializers.serialize(
      object.isFrozen,
      specifiedType: const FullType(bool),
    );
    yield r'menuPermissions';
    yield serializers.serialize(
      object.menuPermissions,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminProfileDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminProfileDtoBuilder result,
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
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.email = valueDes;
          break;
        case r'nickName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.nickName = valueDes;
          break;
        case r'isFrozen':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isFrozen = valueDes;
          break;
        case r'menuPermissions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.menuPermissions.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminProfileDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminProfileDtoBuilder();
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


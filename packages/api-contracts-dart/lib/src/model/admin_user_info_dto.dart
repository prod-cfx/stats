//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/admin_menu_permission_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_user_info_dto.g.dart';

/// AdminUserInfoDto
///
/// Properties:
/// * [id] - 用户ID
/// * [username] - 用户名
/// * [nickName] - 昵称
/// * [headPic] - 头像
/// * [menus] - 菜单树
/// * [menuPermissions] - 菜单权限
/// * [featurePermissions] - 功能权限
/// * [apiPermissions] - API权限
@BuiltValue()
abstract class AdminUserInfoDto implements Built<AdminUserInfoDto, AdminUserInfoDtoBuilder> {
  /// 用户ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 用户名
  @BuiltValueField(wireName: r'username')
  String get username;

  /// 昵称
  @BuiltValueField(wireName: r'nickName')
  String? get nickName;

  /// 头像
  @BuiltValueField(wireName: r'headPic')
  String? get headPic;

  /// 菜单树
  @BuiltValueField(wireName: r'menus')
  BuiltList<AdminMenuPermissionDto> get menus;

  /// 菜单权限
  @BuiltValueField(wireName: r'menuPermissions')
  BuiltList<String> get menuPermissions;

  /// 功能权限
  @BuiltValueField(wireName: r'featurePermissions')
  BuiltList<String> get featurePermissions;

  /// API权限
  @BuiltValueField(wireName: r'apiPermissions')
  BuiltList<String> get apiPermissions;

  AdminUserInfoDto._();

  factory AdminUserInfoDto([void updates(AdminUserInfoDtoBuilder b)]) = _$AdminUserInfoDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminUserInfoDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminUserInfoDto> get serializer => _$AdminUserInfoDtoSerializer();
}

class _$AdminUserInfoDtoSerializer implements PrimitiveSerializer<AdminUserInfoDto> {
  @override
  final Iterable<Type> types = const [AdminUserInfoDto, _$AdminUserInfoDto];

  @override
  final String wireName = r'AdminUserInfoDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminUserInfoDto object, {
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
    if (object.nickName != null) {
      yield r'nickName';
      yield serializers.serialize(
        object.nickName,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.headPic != null) {
      yield r'headPic';
      yield serializers.serialize(
        object.headPic,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'menus';
    yield serializers.serialize(
      object.menus,
      specifiedType: const FullType(BuiltList, [FullType(AdminMenuPermissionDto)]),
    );
    yield r'menuPermissions';
    yield serializers.serialize(
      object.menuPermissions,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'featurePermissions';
    yield serializers.serialize(
      object.featurePermissions,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'apiPermissions';
    yield serializers.serialize(
      object.apiPermissions,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminUserInfoDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminUserInfoDtoBuilder result,
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
        case r'headPic':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.headPic = valueDes;
          break;
        case r'menus':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AdminMenuPermissionDto)]),
          ) as BuiltList<AdminMenuPermissionDto>;
          result.menus.replace(valueDes);
          break;
        case r'menuPermissions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.menuPermissions.replace(valueDes);
          break;
        case r'featurePermissions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.featurePermissions.replace(valueDes);
          break;
        case r'apiPermissions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.apiPermissions.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminUserInfoDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminUserInfoDtoBuilder();
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


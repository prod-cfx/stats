//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_admin_role_dto.g.dart';

/// UpdateAdminRoleDto
///
/// Properties:
/// * [name] - 角色名称
/// * [description] - 角色描述
/// * [menuPermissions] - 菜单权限 code 列表
/// * [featurePermissions] - 功能权限 code 列表
/// * [apiPermissions] - API 权限标识列表
@BuiltValue()
abstract class UpdateAdminRoleDto implements Built<UpdateAdminRoleDto, UpdateAdminRoleDtoBuilder> {
  /// 角色名称
  @BuiltValueField(wireName: r'name')
  String? get name;

  /// 角色描述
  @BuiltValueField(wireName: r'description')
  String? get description;

  /// 菜单权限 code 列表
  @BuiltValueField(wireName: r'menuPermissions')
  BuiltList<String>? get menuPermissions;

  /// 功能权限 code 列表
  @BuiltValueField(wireName: r'featurePermissions')
  BuiltList<String>? get featurePermissions;

  /// API 权限标识列表
  @BuiltValueField(wireName: r'apiPermissions')
  BuiltList<String>? get apiPermissions;

  UpdateAdminRoleDto._();

  factory UpdateAdminRoleDto([void updates(UpdateAdminRoleDtoBuilder b)]) = _$UpdateAdminRoleDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateAdminRoleDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateAdminRoleDto> get serializer => _$UpdateAdminRoleDtoSerializer();
}

class _$UpdateAdminRoleDtoSerializer implements PrimitiveSerializer<UpdateAdminRoleDto> {
  @override
  final Iterable<Type> types = const [UpdateAdminRoleDto, _$UpdateAdminRoleDto];

  @override
  final String wireName = r'UpdateAdminRoleDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateAdminRoleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType(String),
      );
    }
    if (object.menuPermissions != null) {
      yield r'menuPermissions';
      yield serializers.serialize(
        object.menuPermissions,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.featurePermissions != null) {
      yield r'featurePermissions';
      yield serializers.serialize(
        object.featurePermissions,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.apiPermissions != null) {
      yield r'apiPermissions';
      yield serializers.serialize(
        object.apiPermissions,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateAdminRoleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateAdminRoleDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
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
  UpdateAdminRoleDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateAdminRoleDtoBuilder();
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


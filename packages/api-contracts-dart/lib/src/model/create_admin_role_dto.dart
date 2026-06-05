//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_admin_role_dto.g.dart';

/// CreateAdminRoleDto
///
/// Properties:
/// * [code] - 角色编码（全局唯一，例如 admin、moderator、自定义值）
/// * [name] - 角色名称
/// * [description] - 角色描述
/// * [menuPermissions] - 菜单权限 code 列表
/// * [featurePermissions] - 功能权限 code 列表
/// * [apiPermissions] - API 权限标识列表
@BuiltValue()
abstract class CreateAdminRoleDto implements Built<CreateAdminRoleDto, CreateAdminRoleDtoBuilder> {
  /// 角色编码（全局唯一，例如 admin、moderator、自定义值）
  @BuiltValueField(wireName: r'code')
  String get code;

  /// 角色名称
  @BuiltValueField(wireName: r'name')
  String get name;

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

  CreateAdminRoleDto._();

  factory CreateAdminRoleDto([void updates(CreateAdminRoleDtoBuilder b)]) = _$CreateAdminRoleDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateAdminRoleDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateAdminRoleDto> get serializer => _$CreateAdminRoleDtoSerializer();
}

class _$CreateAdminRoleDtoSerializer implements PrimitiveSerializer<CreateAdminRoleDto> {
  @override
  final Iterable<Type> types = const [CreateAdminRoleDto, _$CreateAdminRoleDto];

  @override
  final String wireName = r'CreateAdminRoleDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateAdminRoleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
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
    CreateAdminRoleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateAdminRoleDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
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
  CreateAdminRoleDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateAdminRoleDtoBuilder();
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


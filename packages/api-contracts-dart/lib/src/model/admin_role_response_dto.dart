//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_role_response_dto.g.dart';

/// AdminRoleResponseDto
///
/// Properties:
/// * [id] - 角色 ID
/// * [code] - 角色编码
/// * [name] - 角色名称
/// * [description] - 角色描述
/// * [menuPermissions] - 菜单权限 code 列表
/// * [featurePermissions] - 功能权限 code 列表
/// * [apiPermissions] - API 权限 code 列表
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class AdminRoleResponseDto implements Built<AdminRoleResponseDto, AdminRoleResponseDtoBuilder> {
  /// 角色 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 角色编码
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
  BuiltList<String> get menuPermissions;

  /// 功能权限 code 列表
  @BuiltValueField(wireName: r'featurePermissions')
  BuiltList<String> get featurePermissions;

  /// API 权限 code 列表
  @BuiltValueField(wireName: r'apiPermissions')
  BuiltList<String> get apiPermissions;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  AdminRoleResponseDto._();

  factory AdminRoleResponseDto([void updates(AdminRoleResponseDtoBuilder b)]) = _$AdminRoleResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminRoleResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminRoleResponseDto> get serializer => _$AdminRoleResponseDtoSerializer();
}

class _$AdminRoleResponseDtoSerializer implements PrimitiveSerializer<AdminRoleResponseDto> {
  @override
  final Iterable<Type> types = const [AdminRoleResponseDto, _$AdminRoleResponseDto];

  @override
  final String wireName = r'AdminRoleResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminRoleResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
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
        specifiedType: const FullType.nullable(String),
      );
    }
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
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminRoleResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminRoleResponseDtoBuilder result,
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
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
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
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminRoleResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminRoleResponseDtoBuilder();
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


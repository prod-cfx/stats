//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_menu_permission_dto.g.dart';

/// AdminMenuPermissionDto
///
/// Properties:
/// * [id] 
/// * [parentId] 
/// * [name] 
/// * [route] 
/// * [icon] 
/// * [sortOrder] 
/// * [code] - 菜单/功能权限 code
/// * [type] - 菜单类型
/// * [children] 
@BuiltValue()
abstract class AdminMenuPermissionDto implements Built<AdminMenuPermissionDto, AdminMenuPermissionDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'parentId')
  String? get parentId;

  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'route')
  String? get route;

  @BuiltValueField(wireName: r'icon')
  String? get icon;

  @BuiltValueField(wireName: r'sortOrder')
  num get sortOrder;

  /// 菜单/功能权限 code
  @BuiltValueField(wireName: r'code')
  String? get code;

  /// 菜单类型
  @BuiltValueField(wireName: r'type')
  AdminMenuPermissionDtoTypeEnum get type;
  // enum typeEnum {  DIRECTORY,  MENU,  FEATURE,  };

  @BuiltValueField(wireName: r'children')
  BuiltMap<String, JsonObject?> get children;

  AdminMenuPermissionDto._();

  factory AdminMenuPermissionDto([void updates(AdminMenuPermissionDtoBuilder b)]) = _$AdminMenuPermissionDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminMenuPermissionDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminMenuPermissionDto> get serializer => _$AdminMenuPermissionDtoSerializer();
}

class _$AdminMenuPermissionDtoSerializer implements PrimitiveSerializer<AdminMenuPermissionDto> {
  @override
  final Iterable<Type> types = const [AdminMenuPermissionDto, _$AdminMenuPermissionDto];

  @override
  final String wireName = r'AdminMenuPermissionDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminMenuPermissionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    if (object.parentId != null) {
      yield r'parentId';
      yield serializers.serialize(
        object.parentId,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.route != null) {
      yield r'route';
      yield serializers.serialize(
        object.route,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.icon != null) {
      yield r'icon';
      yield serializers.serialize(
        object.icon,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'sortOrder';
    yield serializers.serialize(
      object.sortOrder,
      specifiedType: const FullType(num),
    );
    yield r'code';
    yield object.code == null ? null : serializers.serialize(
      object.code,
      specifiedType: const FullType.nullable(String),
    );
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(AdminMenuPermissionDtoTypeEnum),
    );
    yield r'children';
    yield serializers.serialize(
      object.children,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminMenuPermissionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminMenuPermissionDtoBuilder result,
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
        case r'parentId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.parentId = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'route':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.route = valueDes;
          break;
        case r'icon':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.icon = valueDes;
          break;
        case r'sortOrder':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.sortOrder = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.code = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminMenuPermissionDtoTypeEnum),
          ) as AdminMenuPermissionDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'children':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.children.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminMenuPermissionDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminMenuPermissionDtoBuilder();
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

class AdminMenuPermissionDtoTypeEnum extends EnumClass {

  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'DIRECTORY')
  static const AdminMenuPermissionDtoTypeEnum DIRECTORY = _$adminMenuPermissionDtoTypeEnum_DIRECTORY;
  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'MENU')
  static const AdminMenuPermissionDtoTypeEnum MENU = _$adminMenuPermissionDtoTypeEnum_MENU;
  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'FEATURE')
  static const AdminMenuPermissionDtoTypeEnum FEATURE = _$adminMenuPermissionDtoTypeEnum_FEATURE;

  static Serializer<AdminMenuPermissionDtoTypeEnum> get serializer => _$adminMenuPermissionDtoTypeEnumSerializer;

  const AdminMenuPermissionDtoTypeEnum._(String name): super(name);

  static BuiltSet<AdminMenuPermissionDtoTypeEnum> get values => _$adminMenuPermissionDtoTypeEnumValues;
  static AdminMenuPermissionDtoTypeEnum valueOf(String name) => _$adminMenuPermissionDtoTypeEnumValueOf(name);
}


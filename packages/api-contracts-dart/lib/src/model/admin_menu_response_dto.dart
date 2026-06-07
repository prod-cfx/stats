//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_menu_response_dto.g.dart';

/// AdminMenuResponseDto
///
/// Properties:
/// * [id] - 菜单 ID
/// * [parentId] - 父级菜单 ID，顶级为空
/// * [type] - 菜单类型
/// * [title] - 菜单标题
/// * [icon] - 图标名称
/// * [code] - 唯一菜单/功能 code
/// * [path] - 前端路由路径
/// * [description] - 描述
/// * [i18nKey] - i18n key
/// * [sort] - 排序值，越大越靠后
/// * [isShow] - 是否在菜单中展示
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class AdminMenuResponseDto implements Built<AdminMenuResponseDto, AdminMenuResponseDtoBuilder> {
  /// 菜单 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 父级菜单 ID，顶级为空
  @BuiltValueField(wireName: r'parentId')
  String? get parentId;

  /// 菜单类型
  @BuiltValueField(wireName: r'type')
  AdminMenuResponseDtoTypeEnum get type;
  // enum typeEnum {  DIRECTORY,  MENU,  FEATURE,  };

  /// 菜单标题
  @BuiltValueField(wireName: r'title')
  String get title;

  /// 图标名称
  @BuiltValueField(wireName: r'icon')
  String? get icon;

  /// 唯一菜单/功能 code
  @BuiltValueField(wireName: r'code')
  String? get code;

  /// 前端路由路径
  @BuiltValueField(wireName: r'path')
  String? get path;

  /// 描述
  @BuiltValueField(wireName: r'description')
  String? get description;

  /// i18n key
  @BuiltValueField(wireName: r'i18nKey')
  String? get i18nKey;

  /// 排序值，越大越靠后
  @BuiltValueField(wireName: r'sort')
  num get sort;

  /// 是否在菜单中展示
  @BuiltValueField(wireName: r'isShow')
  bool get isShow;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  AdminMenuResponseDto._();

  factory AdminMenuResponseDto([void updates(AdminMenuResponseDtoBuilder b)]) = _$AdminMenuResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminMenuResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminMenuResponseDto> get serializer => _$AdminMenuResponseDtoSerializer();
}

class _$AdminMenuResponseDtoSerializer implements PrimitiveSerializer<AdminMenuResponseDto> {
  @override
  final Iterable<Type> types = const [AdminMenuResponseDto, _$AdminMenuResponseDto];

  @override
  final String wireName = r'AdminMenuResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminMenuResponseDto object, {
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
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(AdminMenuResponseDtoTypeEnum),
    );
    yield r'title';
    yield serializers.serialize(
      object.title,
      specifiedType: const FullType(String),
    );
    if (object.icon != null) {
      yield r'icon';
      yield serializers.serialize(
        object.icon,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.code != null) {
      yield r'code';
      yield serializers.serialize(
        object.code,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.path != null) {
      yield r'path';
      yield serializers.serialize(
        object.path,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.i18nKey != null) {
      yield r'i18nKey';
      yield serializers.serialize(
        object.i18nKey,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'sort';
    yield serializers.serialize(
      object.sort,
      specifiedType: const FullType(num),
    );
    yield r'isShow';
    yield serializers.serialize(
      object.isShow,
      specifiedType: const FullType(bool),
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
    AdminMenuResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminMenuResponseDtoBuilder result,
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
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminMenuResponseDtoTypeEnum),
          ) as AdminMenuResponseDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'title':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.title = valueDes;
          break;
        case r'icon':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.icon = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.code = valueDes;
          break;
        case r'path':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.path = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.description = valueDes;
          break;
        case r'i18nKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.i18nKey = valueDes;
          break;
        case r'sort':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.sort = valueDes;
          break;
        case r'isShow':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isShow = valueDes;
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
  AdminMenuResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminMenuResponseDtoBuilder();
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

class AdminMenuResponseDtoTypeEnum extends EnumClass {

  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'DIRECTORY')
  static const AdminMenuResponseDtoTypeEnum DIRECTORY = _$adminMenuResponseDtoTypeEnum_DIRECTORY;
  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'MENU')
  static const AdminMenuResponseDtoTypeEnum MENU = _$adminMenuResponseDtoTypeEnum_MENU;
  /// 菜单类型
  @BuiltValueEnumConst(wireName: r'FEATURE')
  static const AdminMenuResponseDtoTypeEnum FEATURE = _$adminMenuResponseDtoTypeEnum_FEATURE;

  static Serializer<AdminMenuResponseDtoTypeEnum> get serializer => _$adminMenuResponseDtoTypeEnumSerializer;

  const AdminMenuResponseDtoTypeEnum._(String name): super(name);

  static BuiltSet<AdminMenuResponseDtoTypeEnum> get values => _$adminMenuResponseDtoTypeEnumValues;
  static AdminMenuResponseDtoTypeEnum valueOf(String name) => _$adminMenuResponseDtoTypeEnumValueOf(name);
}


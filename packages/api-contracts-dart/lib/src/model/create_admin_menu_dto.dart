//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_admin_menu_dto.g.dart';

/// CreateAdminMenuDto
///
/// Properties:
/// * [parentId] - 父级菜单 ID，顶级菜单可为空
/// * [type] - 菜单类型
/// * [title] - 菜单标题
/// * [icon] - 图标名称
/// * [code] - 唯一菜单/功能 code
/// * [path] - 前端路由路径
/// * [description] - 描述
/// * [i18nKey] - i18n key
/// * [sort] - 排序值，越大越靠后
/// * [isShow] - 是否在菜单中展示
@BuiltValue()
abstract class CreateAdminMenuDto implements Built<CreateAdminMenuDto, CreateAdminMenuDtoBuilder> {
  /// 父级菜单 ID，顶级菜单可为空
  @BuiltValueField(wireName: r'parentId')
  String? get parentId;

  /// 菜单类型
  @BuiltValueField(wireName: r'type')
  String get type;

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
  num? get sort;

  /// 是否在菜单中展示
  @BuiltValueField(wireName: r'isShow')
  bool? get isShow;

  CreateAdminMenuDto._();

  factory CreateAdminMenuDto([void updates(CreateAdminMenuDtoBuilder b)]) = _$CreateAdminMenuDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateAdminMenuDtoBuilder b) => b
      ..sort = 0
      ..isShow = true;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateAdminMenuDto> get serializer => _$CreateAdminMenuDtoSerializer();
}

class _$CreateAdminMenuDtoSerializer implements PrimitiveSerializer<CreateAdminMenuDto> {
  @override
  final Iterable<Type> types = const [CreateAdminMenuDto, _$CreateAdminMenuDto];

  @override
  final String wireName = r'CreateAdminMenuDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateAdminMenuDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.parentId != null) {
      yield r'parentId';
      yield serializers.serialize(
        object.parentId,
        specifiedType: const FullType(String),
      );
    }
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(String),
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
        specifiedType: const FullType(String),
      );
    }
    if (object.code != null) {
      yield r'code';
      yield serializers.serialize(
        object.code,
        specifiedType: const FullType(String),
      );
    }
    if (object.path != null) {
      yield r'path';
      yield serializers.serialize(
        object.path,
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
    if (object.i18nKey != null) {
      yield r'i18nKey';
      yield serializers.serialize(
        object.i18nKey,
        specifiedType: const FullType(String),
      );
    }
    if (object.sort != null) {
      yield r'sort';
      yield serializers.serialize(
        object.sort,
        specifiedType: const FullType(num),
      );
    }
    if (object.isShow != null) {
      yield r'isShow';
      yield serializers.serialize(
        object.isShow,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateAdminMenuDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateAdminMenuDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'parentId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.parentId = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
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
            specifiedType: const FullType(String),
          ) as String;
          result.icon = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        case r'path':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.path = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
          break;
        case r'i18nKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateAdminMenuDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateAdminMenuDtoBuilder();
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


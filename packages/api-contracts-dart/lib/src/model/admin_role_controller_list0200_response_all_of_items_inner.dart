//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_role_controller_list0200_response_all_of_items_inner.g.dart';

/// AdminRoleControllerList0200ResponseAllOfItemsInner
///
/// Properties:
/// * [id] 
/// * [code] 
/// * [name] 
/// * [description] 
/// * [menuPermissions] 
/// * [featurePermissions] 
/// * [apiPermissions] 
/// * [createdAt] 
/// * [updatedAt] 
@BuiltValue()
abstract class AdminRoleControllerList0200ResponseAllOfItemsInner implements Built<AdminRoleControllerList0200ResponseAllOfItemsInner, AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder> {
  @BuiltValueField(wireName: r'id')
  String? get id;

  @BuiltValueField(wireName: r'code')
  String? get code;

  @BuiltValueField(wireName: r'name')
  String? get name;

  @BuiltValueField(wireName: r'description')
  String? get description;

  @BuiltValueField(wireName: r'menuPermissions')
  BuiltList<String>? get menuPermissions;

  @BuiltValueField(wireName: r'featurePermissions')
  BuiltList<String>? get featurePermissions;

  @BuiltValueField(wireName: r'apiPermissions')
  BuiltList<String>? get apiPermissions;

  @BuiltValueField(wireName: r'createdAt')
  DateTime? get createdAt;

  @BuiltValueField(wireName: r'updatedAt')
  DateTime? get updatedAt;

  AdminRoleControllerList0200ResponseAllOfItemsInner._();

  factory AdminRoleControllerList0200ResponseAllOfItemsInner([void updates(AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder b)]) = _$AdminRoleControllerList0200ResponseAllOfItemsInner;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminRoleControllerList0200ResponseAllOfItemsInner> get serializer => _$AdminRoleControllerList0200ResponseAllOfItemsInnerSerializer();
}

class _$AdminRoleControllerList0200ResponseAllOfItemsInnerSerializer implements PrimitiveSerializer<AdminRoleControllerList0200ResponseAllOfItemsInner> {
  @override
  final Iterable<Type> types = const [AdminRoleControllerList0200ResponseAllOfItemsInner, _$AdminRoleControllerList0200ResponseAllOfItemsInner];

  @override
  final String wireName = r'AdminRoleControllerList0200ResponseAllOfItemsInner';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminRoleControllerList0200ResponseAllOfItemsInner object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.id != null) {
      yield r'id';
      yield serializers.serialize(
        object.id,
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
        specifiedType: const FullType.nullable(String),
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
    if (object.createdAt != null) {
      yield r'createdAt';
      yield serializers.serialize(
        object.createdAt,
        specifiedType: const FullType(DateTime),
      );
    }
    if (object.updatedAt != null) {
      yield r'updatedAt';
      yield serializers.serialize(
        object.updatedAt,
        specifiedType: const FullType(DateTime),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminRoleControllerList0200ResponseAllOfItemsInner object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder result,
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
  AdminRoleControllerList0200ResponseAllOfItemsInner deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder();
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


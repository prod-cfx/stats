//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_assigned_role_dto.g.dart';

/// AdminAssignedRoleDto
///
/// Properties:
/// * [id] - 角色 ID
/// * [code] - 角色编码
/// * [name] - 角色名称
/// * [description] - 角色描述
@BuiltValue()
abstract class AdminAssignedRoleDto implements Built<AdminAssignedRoleDto, AdminAssignedRoleDtoBuilder> {
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

  AdminAssignedRoleDto._();

  factory AdminAssignedRoleDto([void updates(AdminAssignedRoleDtoBuilder b)]) = _$AdminAssignedRoleDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminAssignedRoleDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminAssignedRoleDto> get serializer => _$AdminAssignedRoleDtoSerializer();
}

class _$AdminAssignedRoleDtoSerializer implements PrimitiveSerializer<AdminAssignedRoleDto> {
  @override
  final Iterable<Type> types = const [AdminAssignedRoleDto, _$AdminAssignedRoleDto];

  @override
  final String wireName = r'AdminAssignedRoleDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminAssignedRoleDto object, {
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
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminAssignedRoleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminAssignedRoleDtoBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminAssignedRoleDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminAssignedRoleDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_admin_user_dto.g.dart';

/// UpdateAdminUserDto
///
/// Properties:
/// * [nickName] - 昵称
/// * [email] - 邮箱
/// * [avatarUrl] - 头像 URL
/// * [phone] - 手机号
/// * [isFrozen] - 是否冻结
/// * [roleIds] - 角色 ID 列表
@BuiltValue()
abstract class UpdateAdminUserDto implements Built<UpdateAdminUserDto, UpdateAdminUserDtoBuilder> {
  /// 昵称
  @BuiltValueField(wireName: r'nickName')
  String? get nickName;

  /// 邮箱
  @BuiltValueField(wireName: r'email')
  String? get email;

  /// 头像 URL
  @BuiltValueField(wireName: r'avatarUrl')
  String? get avatarUrl;

  /// 手机号
  @BuiltValueField(wireName: r'phone')
  String? get phone;

  /// 是否冻结
  @BuiltValueField(wireName: r'isFrozen')
  bool? get isFrozen;

  /// 角色 ID 列表
  @BuiltValueField(wireName: r'roleIds')
  BuiltList<String>? get roleIds;

  UpdateAdminUserDto._();

  factory UpdateAdminUserDto([void updates(UpdateAdminUserDtoBuilder b)]) = _$UpdateAdminUserDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateAdminUserDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateAdminUserDto> get serializer => _$UpdateAdminUserDtoSerializer();
}

class _$UpdateAdminUserDtoSerializer implements PrimitiveSerializer<UpdateAdminUserDto> {
  @override
  final Iterable<Type> types = const [UpdateAdminUserDto, _$UpdateAdminUserDto];

  @override
  final String wireName = r'UpdateAdminUserDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateAdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.nickName != null) {
      yield r'nickName';
      yield serializers.serialize(
        object.nickName,
        specifiedType: const FullType(String),
      );
    }
    if (object.email != null) {
      yield r'email';
      yield serializers.serialize(
        object.email,
        specifiedType: const FullType(String),
      );
    }
    if (object.avatarUrl != null) {
      yield r'avatarUrl';
      yield serializers.serialize(
        object.avatarUrl,
        specifiedType: const FullType(String),
      );
    }
    if (object.phone != null) {
      yield r'phone';
      yield serializers.serialize(
        object.phone,
        specifiedType: const FullType(String),
      );
    }
    if (object.isFrozen != null) {
      yield r'isFrozen';
      yield serializers.serialize(
        object.isFrozen,
        specifiedType: const FullType(bool),
      );
    }
    if (object.roleIds != null) {
      yield r'roleIds';
      yield serializers.serialize(
        object.roleIds,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateAdminUserDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateAdminUserDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'nickName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.nickName = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'avatarUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.avatarUrl = valueDes;
          break;
        case r'phone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.phone = valueDes;
          break;
        case r'isFrozen':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isFrozen = valueDes;
          break;
        case r'roleIds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.roleIds.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateAdminUserDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateAdminUserDtoBuilder();
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


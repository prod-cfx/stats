//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_register_dto.g.dart';

/// AdminRegisterDto
///
/// Properties:
/// * [username] - 用户名
/// * [password] - 密码
/// * [email] - 邮箱
/// * [nickName] - 昵称
/// * [roleCodes] - 初始角色编码列表
@BuiltValue()
abstract class AdminRegisterDto implements Built<AdminRegisterDto, AdminRegisterDtoBuilder> {
  /// 用户名
  @BuiltValueField(wireName: r'username')
  String get username;

  /// 密码
  @BuiltValueField(wireName: r'password')
  String get password;

  /// 邮箱
  @BuiltValueField(wireName: r'email')
  String? get email;

  /// 昵称
  @BuiltValueField(wireName: r'nickName')
  String? get nickName;

  /// 初始角色编码列表
  @BuiltValueField(wireName: r'roleCodes')
  BuiltList<String>? get roleCodes;

  AdminRegisterDto._();

  factory AdminRegisterDto([void updates(AdminRegisterDtoBuilder b)]) = _$AdminRegisterDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminRegisterDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminRegisterDto> get serializer => _$AdminRegisterDtoSerializer();
}

class _$AdminRegisterDtoSerializer implements PrimitiveSerializer<AdminRegisterDto> {
  @override
  final Iterable<Type> types = const [AdminRegisterDto, _$AdminRegisterDto];

  @override
  final String wireName = r'AdminRegisterDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminRegisterDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'username';
    yield serializers.serialize(
      object.username,
      specifiedType: const FullType(String),
    );
    yield r'password';
    yield serializers.serialize(
      object.password,
      specifiedType: const FullType(String),
    );
    if (object.email != null) {
      yield r'email';
      yield serializers.serialize(
        object.email,
        specifiedType: const FullType(String),
      );
    }
    if (object.nickName != null) {
      yield r'nickName';
      yield serializers.serialize(
        object.nickName,
        specifiedType: const FullType(String),
      );
    }
    if (object.roleCodes != null) {
      yield r'roleCodes';
      yield serializers.serialize(
        object.roleCodes,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminRegisterDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminRegisterDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'username':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.username = valueDes;
          break;
        case r'password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.password = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'nickName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.nickName = valueDes;
          break;
        case r'roleCodes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.roleCodes.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminRegisterDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminRegisterDtoBuilder();
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


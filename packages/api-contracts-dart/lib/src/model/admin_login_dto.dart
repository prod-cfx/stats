//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_login_dto.g.dart';

/// AdminLoginDto
///
/// Properties:
/// * [username] - 管理员登录用户名
/// * [password] - 管理员登录密码
@BuiltValue()
abstract class AdminLoginDto implements Built<AdminLoginDto, AdminLoginDtoBuilder> {
  /// 管理员登录用户名
  @BuiltValueField(wireName: r'username')
  String get username;

  /// 管理员登录密码
  @BuiltValueField(wireName: r'password')
  String get password;

  AdminLoginDto._();

  factory AdminLoginDto([void updates(AdminLoginDtoBuilder b)]) = _$AdminLoginDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminLoginDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminLoginDto> get serializer => _$AdminLoginDtoSerializer();
}

class _$AdminLoginDtoSerializer implements PrimitiveSerializer<AdminLoginDto> {
  @override
  final Iterable<Type> types = const [AdminLoginDto, _$AdminLoginDto];

  @override
  final String wireName = r'AdminLoginDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminLoginDto object, {
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
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminLoginDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminLoginDtoBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminLoginDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminLoginDtoBuilder();
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


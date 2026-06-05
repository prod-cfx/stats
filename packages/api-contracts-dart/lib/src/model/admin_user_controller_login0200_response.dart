//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_user_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_user_controller_login0200_response.g.dart';

/// AdminUserControllerLogin0200Response
///
/// Properties:
/// * [accessToken] 
/// * [refreshToken] 
/// * [expiresIn] 
/// * [user] 
@BuiltValue()
abstract class AdminUserControllerLogin0200Response implements Built<AdminUserControllerLogin0200Response, AdminUserControllerLogin0200ResponseBuilder> {
  @BuiltValueField(wireName: r'accessToken')
  String? get accessToken;

  @BuiltValueField(wireName: r'refreshToken')
  String? get refreshToken;

  @BuiltValueField(wireName: r'expiresIn')
  String? get expiresIn;

  @BuiltValueField(wireName: r'user')
  AdminUserDto? get user;

  AdminUserControllerLogin0200Response._();

  factory AdminUserControllerLogin0200Response([void updates(AdminUserControllerLogin0200ResponseBuilder b)]) = _$AdminUserControllerLogin0200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminUserControllerLogin0200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminUserControllerLogin0200Response> get serializer => _$AdminUserControllerLogin0200ResponseSerializer();
}

class _$AdminUserControllerLogin0200ResponseSerializer implements PrimitiveSerializer<AdminUserControllerLogin0200Response> {
  @override
  final Iterable<Type> types = const [AdminUserControllerLogin0200Response, _$AdminUserControllerLogin0200Response];

  @override
  final String wireName = r'AdminUserControllerLogin0200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminUserControllerLogin0200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.accessToken != null) {
      yield r'accessToken';
      yield serializers.serialize(
        object.accessToken,
        specifiedType: const FullType(String),
      );
    }
    if (object.refreshToken != null) {
      yield r'refreshToken';
      yield serializers.serialize(
        object.refreshToken,
        specifiedType: const FullType(String),
      );
    }
    if (object.expiresIn != null) {
      yield r'expiresIn';
      yield serializers.serialize(
        object.expiresIn,
        specifiedType: const FullType(String),
      );
    }
    if (object.user != null) {
      yield r'user';
      yield serializers.serialize(
        object.user,
        specifiedType: const FullType(AdminUserDto),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminUserControllerLogin0200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminUserControllerLogin0200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'accessToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.accessToken = valueDes;
          break;
        case r'refreshToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.refreshToken = valueDes;
          break;
        case r'expiresIn':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.expiresIn = valueDes;
          break;
        case r'user':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminUserDto),
          ) as AdminUserDto;
          result.user.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminUserControllerLogin0200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminUserControllerLogin0200ResponseBuilder();
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


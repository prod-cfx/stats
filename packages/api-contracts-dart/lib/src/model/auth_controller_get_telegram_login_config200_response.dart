//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/auth_controller_get_telegram_login_config200_response_data.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_get_telegram_login_config200_response.g.dart';

/// AuthControllerGetTelegramLoginConfig200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerGetTelegramLoginConfig200Response implements Built<AuthControllerGetTelegramLoginConfig200Response, AuthControllerGetTelegramLoginConfig200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AuthControllerGetTelegramLoginConfig200ResponseData? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerGetTelegramLoginConfig200Response._();

  factory AuthControllerGetTelegramLoginConfig200Response([void updates(AuthControllerGetTelegramLoginConfig200ResponseBuilder b)]) = _$AuthControllerGetTelegramLoginConfig200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerGetTelegramLoginConfig200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerGetTelegramLoginConfig200Response> get serializer => _$AuthControllerGetTelegramLoginConfig200ResponseSerializer();
}

class _$AuthControllerGetTelegramLoginConfig200ResponseSerializer implements PrimitiveSerializer<AuthControllerGetTelegramLoginConfig200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerGetTelegramLoginConfig200Response, _$AuthControllerGetTelegramLoginConfig200Response];

  @override
  final String wireName = r'AuthControllerGetTelegramLoginConfig200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerGetTelegramLoginConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(AuthControllerGetTelegramLoginConfig200ResponseData),
      );
    }
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AuthControllerGetTelegramLoginConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerGetTelegramLoginConfig200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AuthControllerGetTelegramLoginConfig200ResponseData),
          ) as AuthControllerGetTelegramLoginConfig200ResponseData;
          result.data.replace(valueDes);
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AuthControllerGetTelegramLoginConfig200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerGetTelegramLoginConfig200ResponseBuilder();
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


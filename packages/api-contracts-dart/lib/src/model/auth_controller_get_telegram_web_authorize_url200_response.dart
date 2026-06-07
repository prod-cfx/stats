//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/telegram_web_authorize_url_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_get_telegram_web_authorize_url200_response.g.dart';

/// AuthControllerGetTelegramWebAuthorizeUrl200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerGetTelegramWebAuthorizeUrl200Response implements Built<AuthControllerGetTelegramWebAuthorizeUrl200Response, AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  TelegramWebAuthorizeUrlResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerGetTelegramWebAuthorizeUrl200Response._();

  factory AuthControllerGetTelegramWebAuthorizeUrl200Response([void updates(AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder b)]) = _$AuthControllerGetTelegramWebAuthorizeUrl200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerGetTelegramWebAuthorizeUrl200Response> get serializer => _$AuthControllerGetTelegramWebAuthorizeUrl200ResponseSerializer();
}

class _$AuthControllerGetTelegramWebAuthorizeUrl200ResponseSerializer implements PrimitiveSerializer<AuthControllerGetTelegramWebAuthorizeUrl200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerGetTelegramWebAuthorizeUrl200Response, _$AuthControllerGetTelegramWebAuthorizeUrl200Response];

  @override
  final String wireName = r'AuthControllerGetTelegramWebAuthorizeUrl200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerGetTelegramWebAuthorizeUrl200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(TelegramWebAuthorizeUrlResponseDto),
    );
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
    AuthControllerGetTelegramWebAuthorizeUrl200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramWebAuthorizeUrlResponseDto),
          ) as TelegramWebAuthorizeUrlResponseDto;
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
  AuthControllerGetTelegramWebAuthorizeUrl200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder();
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


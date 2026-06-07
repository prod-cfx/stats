//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/telegram_bot_webhook_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_handle_telegram_bot_webhook200_response.g.dart';

/// AuthControllerHandleTelegramBotWebhook200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerHandleTelegramBotWebhook200Response implements Built<AuthControllerHandleTelegramBotWebhook200Response, AuthControllerHandleTelegramBotWebhook200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  TelegramBotWebhookResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerHandleTelegramBotWebhook200Response._();

  factory AuthControllerHandleTelegramBotWebhook200Response([void updates(AuthControllerHandleTelegramBotWebhook200ResponseBuilder b)]) = _$AuthControllerHandleTelegramBotWebhook200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerHandleTelegramBotWebhook200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerHandleTelegramBotWebhook200Response> get serializer => _$AuthControllerHandleTelegramBotWebhook200ResponseSerializer();
}

class _$AuthControllerHandleTelegramBotWebhook200ResponseSerializer implements PrimitiveSerializer<AuthControllerHandleTelegramBotWebhook200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerHandleTelegramBotWebhook200Response, _$AuthControllerHandleTelegramBotWebhook200Response];

  @override
  final String wireName = r'AuthControllerHandleTelegramBotWebhook200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerHandleTelegramBotWebhook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(TelegramBotWebhookResponseDto),
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
    AuthControllerHandleTelegramBotWebhook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerHandleTelegramBotWebhook200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramBotWebhookResponseDto),
          ) as TelegramBotWebhookResponseDto;
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
  AuthControllerHandleTelegramBotWebhook200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerHandleTelegramBotWebhook200ResponseBuilder();
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


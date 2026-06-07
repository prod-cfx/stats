//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/telegram_desktop_intent_status_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_get_telegram_desktop_intent_status200_response.g.dart';

/// AuthControllerGetTelegramDesktopIntentStatus200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerGetTelegramDesktopIntentStatus200Response implements Built<AuthControllerGetTelegramDesktopIntentStatus200Response, AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  TelegramDesktopIntentStatusResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerGetTelegramDesktopIntentStatus200Response._();

  factory AuthControllerGetTelegramDesktopIntentStatus200Response([void updates(AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder b)]) = _$AuthControllerGetTelegramDesktopIntentStatus200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerGetTelegramDesktopIntentStatus200Response> get serializer => _$AuthControllerGetTelegramDesktopIntentStatus200ResponseSerializer();
}

class _$AuthControllerGetTelegramDesktopIntentStatus200ResponseSerializer implements PrimitiveSerializer<AuthControllerGetTelegramDesktopIntentStatus200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerGetTelegramDesktopIntentStatus200Response, _$AuthControllerGetTelegramDesktopIntentStatus200Response];

  @override
  final String wireName = r'AuthControllerGetTelegramDesktopIntentStatus200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerGetTelegramDesktopIntentStatus200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(TelegramDesktopIntentStatusResponseDto),
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
    AuthControllerGetTelegramDesktopIntentStatus200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramDesktopIntentStatusResponseDto),
          ) as TelegramDesktopIntentStatusResponseDto;
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
  AuthControllerGetTelegramDesktopIntentStatus200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/telegram_desktop_intent_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_create_telegram_desktop_intent200_response.g.dart';

/// AuthControllerCreateTelegramDesktopIntent200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerCreateTelegramDesktopIntent200Response implements Built<AuthControllerCreateTelegramDesktopIntent200Response, AuthControllerCreateTelegramDesktopIntent200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  TelegramDesktopIntentResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerCreateTelegramDesktopIntent200Response._();

  factory AuthControllerCreateTelegramDesktopIntent200Response([void updates(AuthControllerCreateTelegramDesktopIntent200ResponseBuilder b)]) = _$AuthControllerCreateTelegramDesktopIntent200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerCreateTelegramDesktopIntent200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerCreateTelegramDesktopIntent200Response> get serializer => _$AuthControllerCreateTelegramDesktopIntent200ResponseSerializer();
}

class _$AuthControllerCreateTelegramDesktopIntent200ResponseSerializer implements PrimitiveSerializer<AuthControllerCreateTelegramDesktopIntent200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerCreateTelegramDesktopIntent200Response, _$AuthControllerCreateTelegramDesktopIntent200Response];

  @override
  final String wireName = r'AuthControllerCreateTelegramDesktopIntent200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerCreateTelegramDesktopIntent200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(TelegramDesktopIntentResponseDto),
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
    AuthControllerCreateTelegramDesktopIntent200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerCreateTelegramDesktopIntent200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramDesktopIntentResponseDto),
          ) as TelegramDesktopIntentResponseDto;
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
  AuthControllerCreateTelegramDesktopIntent200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerCreateTelegramDesktopIntent200ResponseBuilder();
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


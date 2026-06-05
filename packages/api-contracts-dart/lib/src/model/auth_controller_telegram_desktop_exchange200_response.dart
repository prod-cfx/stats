//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/auth_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_telegram_desktop_exchange200_response.g.dart';

/// AuthControllerTelegramDesktopExchange200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AuthControllerTelegramDesktopExchange200Response implements Built<AuthControllerTelegramDesktopExchange200Response, AuthControllerTelegramDesktopExchange200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AuthResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AuthControllerTelegramDesktopExchange200Response._();

  factory AuthControllerTelegramDesktopExchange200Response([void updates(AuthControllerTelegramDesktopExchange200ResponseBuilder b)]) = _$AuthControllerTelegramDesktopExchange200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerTelegramDesktopExchange200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerTelegramDesktopExchange200Response> get serializer => _$AuthControllerTelegramDesktopExchange200ResponseSerializer();
}

class _$AuthControllerTelegramDesktopExchange200ResponseSerializer implements PrimitiveSerializer<AuthControllerTelegramDesktopExchange200Response> {
  @override
  final Iterable<Type> types = const [AuthControllerTelegramDesktopExchange200Response, _$AuthControllerTelegramDesktopExchange200Response];

  @override
  final String wireName = r'AuthControllerTelegramDesktopExchange200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerTelegramDesktopExchange200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(AuthResponseDto),
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
    AuthControllerTelegramDesktopExchange200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerTelegramDesktopExchange200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AuthResponseDto),
          ) as AuthResponseDto;
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
  AuthControllerTelegramDesktopExchange200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerTelegramDesktopExchange200ResponseBuilder();
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


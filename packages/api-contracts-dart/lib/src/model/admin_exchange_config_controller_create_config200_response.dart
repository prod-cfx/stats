//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/exchange_config_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_exchange_config_controller_create_config200_response.g.dart';

/// AdminExchangeConfigControllerCreateConfig200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminExchangeConfigControllerCreateConfig200Response implements Built<AdminExchangeConfigControllerCreateConfig200Response, AdminExchangeConfigControllerCreateConfig200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  ExchangeConfigResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminExchangeConfigControllerCreateConfig200Response._();

  factory AdminExchangeConfigControllerCreateConfig200Response([void updates(AdminExchangeConfigControllerCreateConfig200ResponseBuilder b)]) = _$AdminExchangeConfigControllerCreateConfig200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminExchangeConfigControllerCreateConfig200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminExchangeConfigControllerCreateConfig200Response> get serializer => _$AdminExchangeConfigControllerCreateConfig200ResponseSerializer();
}

class _$AdminExchangeConfigControllerCreateConfig200ResponseSerializer implements PrimitiveSerializer<AdminExchangeConfigControllerCreateConfig200Response> {
  @override
  final Iterable<Type> types = const [AdminExchangeConfigControllerCreateConfig200Response, _$AdminExchangeConfigControllerCreateConfig200Response];

  @override
  final String wireName = r'AdminExchangeConfigControllerCreateConfig200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminExchangeConfigControllerCreateConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(ExchangeConfigResponseDto),
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
    AdminExchangeConfigControllerCreateConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminExchangeConfigControllerCreateConfig200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(ExchangeConfigResponseDto),
          ) as ExchangeConfigResponseDto;
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
  AdminExchangeConfigControllerCreateConfig200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminExchangeConfigControllerCreateConfig200ResponseBuilder();
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


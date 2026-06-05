//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/trades_pair_config_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_trades_pair_config_controller_create_config200_response.g.dart';

/// AdminTradesPairConfigControllerCreateConfig200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminTradesPairConfigControllerCreateConfig200Response implements Built<AdminTradesPairConfigControllerCreateConfig200Response, AdminTradesPairConfigControllerCreateConfig200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  TradesPairConfigResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminTradesPairConfigControllerCreateConfig200Response._();

  factory AdminTradesPairConfigControllerCreateConfig200Response([void updates(AdminTradesPairConfigControllerCreateConfig200ResponseBuilder b)]) = _$AdminTradesPairConfigControllerCreateConfig200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminTradesPairConfigControllerCreateConfig200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminTradesPairConfigControllerCreateConfig200Response> get serializer => _$AdminTradesPairConfigControllerCreateConfig200ResponseSerializer();
}

class _$AdminTradesPairConfigControllerCreateConfig200ResponseSerializer implements PrimitiveSerializer<AdminTradesPairConfigControllerCreateConfig200Response> {
  @override
  final Iterable<Type> types = const [AdminTradesPairConfigControllerCreateConfig200Response, _$AdminTradesPairConfigControllerCreateConfig200Response];

  @override
  final String wireName = r'AdminTradesPairConfigControllerCreateConfig200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminTradesPairConfigControllerCreateConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(TradesPairConfigResponseDto),
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
    AdminTradesPairConfigControllerCreateConfig200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminTradesPairConfigControllerCreateConfig200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TradesPairConfigResponseDto),
          ) as TradesPairConfigResponseDto;
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
  AdminTradesPairConfigControllerCreateConfig200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminTradesPairConfigControllerCreateConfig200ResponseBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/orderbook_pair_config_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_orderbook_pair_config_controller_get_all_configs200_response.g.dart';

/// AdminOrderbookPairConfigControllerGetAllConfigs200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminOrderbookPairConfigControllerGetAllConfigs200Response implements Built<AdminOrderbookPairConfigControllerGetAllConfigs200Response, AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<OrderbookPairConfigResponseDto>? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminOrderbookPairConfigControllerGetAllConfigs200Response._();

  factory AdminOrderbookPairConfigControllerGetAllConfigs200Response([void updates(AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder b)]) = _$AdminOrderbookPairConfigControllerGetAllConfigs200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminOrderbookPairConfigControllerGetAllConfigs200Response> get serializer => _$AdminOrderbookPairConfigControllerGetAllConfigs200ResponseSerializer();
}

class _$AdminOrderbookPairConfigControllerGetAllConfigs200ResponseSerializer implements PrimitiveSerializer<AdminOrderbookPairConfigControllerGetAllConfigs200Response> {
  @override
  final Iterable<Type> types = const [AdminOrderbookPairConfigControllerGetAllConfigs200Response, _$AdminOrderbookPairConfigControllerGetAllConfigs200Response];

  @override
  final String wireName = r'AdminOrderbookPairConfigControllerGetAllConfigs200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminOrderbookPairConfigControllerGetAllConfigs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(BuiltList, [FullType(OrderbookPairConfigResponseDto)]),
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
    AdminOrderbookPairConfigControllerGetAllConfigs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OrderbookPairConfigResponseDto)]),
          ) as BuiltList<OrderbookPairConfigResponseDto>;
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
  AdminOrderbookPairConfigControllerGetAllConfigs200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder();
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


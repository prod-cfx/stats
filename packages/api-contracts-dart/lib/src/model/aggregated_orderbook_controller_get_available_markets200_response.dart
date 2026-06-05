//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/aggregated_orderbook_market_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_orderbook_controller_get_available_markets200_response.g.dart';

/// AggregatedOrderbookControllerGetAvailableMarkets200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AggregatedOrderbookControllerGetAvailableMarkets200Response implements Built<AggregatedOrderbookControllerGetAvailableMarkets200Response, AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<AggregatedOrderbookMarketResponseDto>? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AggregatedOrderbookControllerGetAvailableMarkets200Response._();

  factory AggregatedOrderbookControllerGetAvailableMarkets200Response([void updates(AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder b)]) = _$AggregatedOrderbookControllerGetAvailableMarkets200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedOrderbookControllerGetAvailableMarkets200Response> get serializer => _$AggregatedOrderbookControllerGetAvailableMarkets200ResponseSerializer();
}

class _$AggregatedOrderbookControllerGetAvailableMarkets200ResponseSerializer implements PrimitiveSerializer<AggregatedOrderbookControllerGetAvailableMarkets200Response> {
  @override
  final Iterable<Type> types = const [AggregatedOrderbookControllerGetAvailableMarkets200Response, _$AggregatedOrderbookControllerGetAvailableMarkets200Response];

  @override
  final String wireName = r'AggregatedOrderbookControllerGetAvailableMarkets200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedOrderbookControllerGetAvailableMarkets200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(BuiltList, [FullType(AggregatedOrderbookMarketResponseDto)]),
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
    AggregatedOrderbookControllerGetAvailableMarkets200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AggregatedOrderbookMarketResponseDto)]),
          ) as BuiltList<AggregatedOrderbookMarketResponseDto>;
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
  AggregatedOrderbookControllerGetAvailableMarkets200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder();
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


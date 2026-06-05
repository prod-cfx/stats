//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/aggregated_orderbook_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_orderbook_controller_get_aggregated_orderbook200_response.g.dart';

/// AggregatedOrderbookControllerGetAggregatedOrderbook200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AggregatedOrderbookControllerGetAggregatedOrderbook200Response implements Built<AggregatedOrderbookControllerGetAggregatedOrderbook200Response, AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AggregatedOrderbookResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AggregatedOrderbookControllerGetAggregatedOrderbook200Response._();

  factory AggregatedOrderbookControllerGetAggregatedOrderbook200Response([void updates(AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder b)]) = _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedOrderbookControllerGetAggregatedOrderbook200Response> get serializer => _$AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseSerializer();
}

class _$AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseSerializer implements PrimitiveSerializer<AggregatedOrderbookControllerGetAggregatedOrderbook200Response> {
  @override
  final Iterable<Type> types = const [AggregatedOrderbookControllerGetAggregatedOrderbook200Response, _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response];

  @override
  final String wireName = r'AggregatedOrderbookControllerGetAggregatedOrderbook200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedOrderbookControllerGetAggregatedOrderbook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(AggregatedOrderbookResponseDto),
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
    AggregatedOrderbookControllerGetAggregatedOrderbook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AggregatedOrderbookResponseDto),
          ) as AggregatedOrderbookResponseDto;
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
  AggregatedOrderbookControllerGetAggregatedOrderbook200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder();
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


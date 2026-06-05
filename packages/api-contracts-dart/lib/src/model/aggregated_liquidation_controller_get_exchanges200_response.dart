//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/base_response_dto.dart';
import 'package:backend_api_contracts/src/model/exchange_liquidation_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_liquidation_controller_get_exchanges200_response.g.dart';

/// AggregatedLiquidationControllerGetExchanges200Response
///
/// Properties:
/// * [data] 
/// * [message] - 提示信息
@BuiltValue()
abstract class AggregatedLiquidationControllerGetExchanges200Response implements BaseResponseDto, Built<AggregatedLiquidationControllerGetExchanges200Response, AggregatedLiquidationControllerGetExchanges200ResponseBuilder> {
  AggregatedLiquidationControllerGetExchanges200Response._();

  factory AggregatedLiquidationControllerGetExchanges200Response([void updates(AggregatedLiquidationControllerGetExchanges200ResponseBuilder b)]) = _$AggregatedLiquidationControllerGetExchanges200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedLiquidationControllerGetExchanges200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedLiquidationControllerGetExchanges200Response> get serializer => _$AggregatedLiquidationControllerGetExchanges200ResponseSerializer();
}

class _$AggregatedLiquidationControllerGetExchanges200ResponseSerializer implements PrimitiveSerializer<AggregatedLiquidationControllerGetExchanges200Response> {
  @override
  final Iterable<Type> types = const [AggregatedLiquidationControllerGetExchanges200Response, _$AggregatedLiquidationControllerGetExchanges200Response];

  @override
  final String wireName = r'AggregatedLiquidationControllerGetExchanges200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedLiquidationControllerGetExchanges200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(JsonObject),
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
    AggregatedLiquidationControllerGetExchanges200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedLiquidationControllerGetExchanges200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(JsonObject),
          ) as JsonObject;
          result.data = valueDes;
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
  AggregatedLiquidationControllerGetExchanges200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedLiquidationControllerGetExchanges200ResponseBuilder();
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


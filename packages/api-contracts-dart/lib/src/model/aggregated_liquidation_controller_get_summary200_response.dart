//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/base_response_dto.dart';
import 'package:backend_api_contracts/src/model/aggregated_liquidation_summary_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_liquidation_controller_get_summary200_response.g.dart';

/// AggregatedLiquidationControllerGetSummary200Response
///
/// Properties:
/// * [data] 
/// * [message] - 提示信息
@BuiltValue()
abstract class AggregatedLiquidationControllerGetSummary200Response implements BaseResponseDto, Built<AggregatedLiquidationControllerGetSummary200Response, AggregatedLiquidationControllerGetSummary200ResponseBuilder> {
  AggregatedLiquidationControllerGetSummary200Response._();

  factory AggregatedLiquidationControllerGetSummary200Response([void updates(AggregatedLiquidationControllerGetSummary200ResponseBuilder b)]) = _$AggregatedLiquidationControllerGetSummary200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedLiquidationControllerGetSummary200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedLiquidationControllerGetSummary200Response> get serializer => _$AggregatedLiquidationControllerGetSummary200ResponseSerializer();
}

class _$AggregatedLiquidationControllerGetSummary200ResponseSerializer implements PrimitiveSerializer<AggregatedLiquidationControllerGetSummary200Response> {
  @override
  final Iterable<Type> types = const [AggregatedLiquidationControllerGetSummary200Response, _$AggregatedLiquidationControllerGetSummary200Response];

  @override
  final String wireName = r'AggregatedLiquidationControllerGetSummary200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedLiquidationControllerGetSummary200Response object, {
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
    AggregatedLiquidationControllerGetSummary200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedLiquidationControllerGetSummary200ResponseBuilder result,
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
  AggregatedLiquidationControllerGetSummary200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedLiquidationControllerGetSummary200ResponseBuilder();
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


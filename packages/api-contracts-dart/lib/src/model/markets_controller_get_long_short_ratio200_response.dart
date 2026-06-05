//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/base_pagination_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/long_short_ratio_point_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'markets_controller_get_long_short_ratio200_response.g.dart';

/// MarketsControllerGetLongShortRatio200Response
///
/// Properties:
/// * [total] - 数据总量
/// * [page] - 当前页码
/// * [limit] - 每页数量
/// * [items] 
@BuiltValue()
abstract class MarketsControllerGetLongShortRatio200Response implements BasePaginationResponseDto, Built<MarketsControllerGetLongShortRatio200Response, MarketsControllerGetLongShortRatio200ResponseBuilder> {
  MarketsControllerGetLongShortRatio200Response._();

  factory MarketsControllerGetLongShortRatio200Response([void updates(MarketsControllerGetLongShortRatio200ResponseBuilder b)]) = _$MarketsControllerGetLongShortRatio200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MarketsControllerGetLongShortRatio200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MarketsControllerGetLongShortRatio200Response> get serializer => _$MarketsControllerGetLongShortRatio200ResponseSerializer();
}

class _$MarketsControllerGetLongShortRatio200ResponseSerializer implements PrimitiveSerializer<MarketsControllerGetLongShortRatio200Response> {
  @override
  final Iterable<Type> types = const [MarketsControllerGetLongShortRatio200Response, _$MarketsControllerGetLongShortRatio200Response];

  @override
  final String wireName = r'MarketsControllerGetLongShortRatio200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MarketsControllerGetLongShortRatio200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'limit';
    yield serializers.serialize(
      object.limit,
      specifiedType: const FullType(num),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(num),
    );
    yield r'page';
    yield serializers.serialize(
      object.page,
      specifiedType: const FullType(num),
    );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    MarketsControllerGetLongShortRatio200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MarketsControllerGetLongShortRatio200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.limit = valueDes;
          break;
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.total = valueDes;
          break;
        case r'page':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.page = valueDes;
          break;
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
          ) as BuiltList<JsonObject>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MarketsControllerGetLongShortRatio200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MarketsControllerGetLongShortRatio200ResponseBuilder();
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


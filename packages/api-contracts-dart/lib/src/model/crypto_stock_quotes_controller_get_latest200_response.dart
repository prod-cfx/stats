//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/crypto_stock_quote_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/base_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'crypto_stock_quotes_controller_get_latest200_response.g.dart';

/// CryptoStockQuotesControllerGetLatest200Response
///
/// Properties:
/// * [data] 
/// * [message] - 提示信息
@BuiltValue()
abstract class CryptoStockQuotesControllerGetLatest200Response implements BaseResponseDto, Built<CryptoStockQuotesControllerGetLatest200Response, CryptoStockQuotesControllerGetLatest200ResponseBuilder> {
  CryptoStockQuotesControllerGetLatest200Response._();

  factory CryptoStockQuotesControllerGetLatest200Response([void updates(CryptoStockQuotesControllerGetLatest200ResponseBuilder b)]) = _$CryptoStockQuotesControllerGetLatest200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CryptoStockQuotesControllerGetLatest200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CryptoStockQuotesControllerGetLatest200Response> get serializer => _$CryptoStockQuotesControllerGetLatest200ResponseSerializer();
}

class _$CryptoStockQuotesControllerGetLatest200ResponseSerializer implements PrimitiveSerializer<CryptoStockQuotesControllerGetLatest200Response> {
  @override
  final Iterable<Type> types = const [CryptoStockQuotesControllerGetLatest200Response, _$CryptoStockQuotesControllerGetLatest200Response];

  @override
  final String wireName = r'CryptoStockQuotesControllerGetLatest200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CryptoStockQuotesControllerGetLatest200Response object, {
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
    CryptoStockQuotesControllerGetLatest200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CryptoStockQuotesControllerGetLatest200ResponseBuilder result,
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
  CryptoStockQuotesControllerGetLatest200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CryptoStockQuotesControllerGetLatest200ResponseBuilder();
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


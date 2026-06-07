//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_capabilities_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_proxy_controller_capabilities200_response.g.dart';

/// BacktestingProxyControllerCapabilities200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class BacktestingProxyControllerCapabilities200Response implements Built<BacktestingProxyControllerCapabilities200Response, BacktestingProxyControllerCapabilities200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BacktestingCapabilitiesResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  BacktestingProxyControllerCapabilities200Response._();

  factory BacktestingProxyControllerCapabilities200Response([void updates(BacktestingProxyControllerCapabilities200ResponseBuilder b)]) = _$BacktestingProxyControllerCapabilities200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingProxyControllerCapabilities200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingProxyControllerCapabilities200Response> get serializer => _$BacktestingProxyControllerCapabilities200ResponseSerializer();
}

class _$BacktestingProxyControllerCapabilities200ResponseSerializer implements PrimitiveSerializer<BacktestingProxyControllerCapabilities200Response> {
  @override
  final Iterable<Type> types = const [BacktestingProxyControllerCapabilities200Response, _$BacktestingProxyControllerCapabilities200Response];

  @override
  final String wireName = r'BacktestingProxyControllerCapabilities200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingProxyControllerCapabilities200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BacktestingCapabilitiesResponseDto),
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
    BacktestingProxyControllerCapabilities200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingProxyControllerCapabilities200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCapabilitiesResponseDto),
          ) as BacktestingCapabilitiesResponseDto;
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
  BacktestingProxyControllerCapabilities200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingProxyControllerCapabilities200ResponseBuilder();
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


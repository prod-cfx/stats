//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/strategy_plaza_signal_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_proxy_controller_signals200_response.g.dart';

/// StrategyPlazaProxyControllerSignals200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerSignals200Response implements Built<StrategyPlazaProxyControllerSignals200Response, StrategyPlazaProxyControllerSignals200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<StrategyPlazaSignalResponseDto> get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  StrategyPlazaProxyControllerSignals200Response._();

  factory StrategyPlazaProxyControllerSignals200Response([void updates(StrategyPlazaProxyControllerSignals200ResponseBuilder b)]) = _$StrategyPlazaProxyControllerSignals200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerSignals200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerSignals200Response> get serializer => _$StrategyPlazaProxyControllerSignals200ResponseSerializer();
}

class _$StrategyPlazaProxyControllerSignals200ResponseSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerSignals200Response> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerSignals200Response, _$StrategyPlazaProxyControllerSignals200Response];

  @override
  final String wireName = r'StrategyPlazaProxyControllerSignals200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerSignals200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaSignalResponseDto)]),
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
    StrategyPlazaProxyControllerSignals200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaProxyControllerSignals200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaSignalResponseDto)]),
          ) as BuiltList<StrategyPlazaSignalResponseDto>;
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
  StrategyPlazaProxyControllerSignals200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerSignals200ResponseBuilder();
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


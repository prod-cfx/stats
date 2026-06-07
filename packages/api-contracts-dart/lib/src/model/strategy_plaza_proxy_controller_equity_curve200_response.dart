//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_proxy_controller_equity_curve200_response.g.dart';

/// StrategyPlazaProxyControllerEquityCurve200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerEquityCurve200Response implements Built<StrategyPlazaProxyControllerEquityCurve200Response, StrategyPlazaProxyControllerEquityCurve200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<num> get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  StrategyPlazaProxyControllerEquityCurve200Response._();

  factory StrategyPlazaProxyControllerEquityCurve200Response([void updates(StrategyPlazaProxyControllerEquityCurve200ResponseBuilder b)]) = _$StrategyPlazaProxyControllerEquityCurve200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerEquityCurve200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerEquityCurve200Response> get serializer => _$StrategyPlazaProxyControllerEquityCurve200ResponseSerializer();
}

class _$StrategyPlazaProxyControllerEquityCurve200ResponseSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerEquityCurve200Response> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerEquityCurve200Response, _$StrategyPlazaProxyControllerEquityCurve200Response];

  @override
  final String wireName = r'StrategyPlazaProxyControllerEquityCurve200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerEquityCurve200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BuiltList, [FullType(num)]),
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
    StrategyPlazaProxyControllerEquityCurve200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaProxyControllerEquityCurve200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(num)]),
          ) as BuiltList<num>;
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
  StrategyPlazaProxyControllerEquityCurve200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerEquityCurve200ResponseBuilder();
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


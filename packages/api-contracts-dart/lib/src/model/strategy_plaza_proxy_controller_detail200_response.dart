//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/strategy_plaza_template_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_proxy_controller_detail200_response.g.dart';

/// StrategyPlazaProxyControllerDetail200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerDetail200Response implements Built<StrategyPlazaProxyControllerDetail200Response, StrategyPlazaProxyControllerDetail200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  StrategyPlazaTemplateResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  StrategyPlazaProxyControllerDetail200Response._();

  factory StrategyPlazaProxyControllerDetail200Response([void updates(StrategyPlazaProxyControllerDetail200ResponseBuilder b)]) = _$StrategyPlazaProxyControllerDetail200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerDetail200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerDetail200Response> get serializer => _$StrategyPlazaProxyControllerDetail200ResponseSerializer();
}

class _$StrategyPlazaProxyControllerDetail200ResponseSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerDetail200Response> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerDetail200Response, _$StrategyPlazaProxyControllerDetail200Response];

  @override
  final String wireName = r'StrategyPlazaProxyControllerDetail200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerDetail200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDto),
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
    StrategyPlazaProxyControllerDetail200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaProxyControllerDetail200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDto),
          ) as StrategyPlazaTemplateResponseDto;
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
  StrategyPlazaProxyControllerDetail200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerDetail200ResponseBuilder();
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


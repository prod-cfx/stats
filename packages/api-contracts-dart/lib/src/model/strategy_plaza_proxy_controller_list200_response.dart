//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/strategy_plaza_template_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_proxy_controller_list200_response.g.dart';

/// StrategyPlazaProxyControllerList200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerList200Response implements Built<StrategyPlazaProxyControllerList200Response, StrategyPlazaProxyControllerList200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<StrategyPlazaTemplateResponseDto> get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  StrategyPlazaProxyControllerList200Response._();

  factory StrategyPlazaProxyControllerList200Response([void updates(StrategyPlazaProxyControllerList200ResponseBuilder b)]) = _$StrategyPlazaProxyControllerList200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerList200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerList200Response> get serializer => _$StrategyPlazaProxyControllerList200ResponseSerializer();
}

class _$StrategyPlazaProxyControllerList200ResponseSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerList200Response> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerList200Response, _$StrategyPlazaProxyControllerList200Response];

  @override
  final String wireName = r'StrategyPlazaProxyControllerList200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerList200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaTemplateResponseDto)]),
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
    StrategyPlazaProxyControllerList200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaProxyControllerList200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaTemplateResponseDto)]),
          ) as BuiltList<StrategyPlazaTemplateResponseDto>;
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
  StrategyPlazaProxyControllerList200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerList200ResponseBuilder();
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


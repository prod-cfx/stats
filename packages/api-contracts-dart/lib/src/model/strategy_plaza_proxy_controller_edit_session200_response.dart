//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/strategy_plaza_edit_session_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_proxy_controller_edit_session200_response.g.dart';

/// StrategyPlazaProxyControllerEditSession200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerEditSession200Response implements Built<StrategyPlazaProxyControllerEditSession200Response, StrategyPlazaProxyControllerEditSession200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  StrategyPlazaEditSessionResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  StrategyPlazaProxyControllerEditSession200Response._();

  factory StrategyPlazaProxyControllerEditSession200Response([void updates(StrategyPlazaProxyControllerEditSession200ResponseBuilder b)]) = _$StrategyPlazaProxyControllerEditSession200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerEditSession200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerEditSession200Response> get serializer => _$StrategyPlazaProxyControllerEditSession200ResponseSerializer();
}

class _$StrategyPlazaProxyControllerEditSession200ResponseSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerEditSession200Response> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerEditSession200Response, _$StrategyPlazaProxyControllerEditSession200Response];

  @override
  final String wireName = r'StrategyPlazaProxyControllerEditSession200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerEditSession200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(StrategyPlazaEditSessionResponseDto),
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
    StrategyPlazaProxyControllerEditSession200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaProxyControllerEditSession200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaEditSessionResponseDto),
          ) as StrategyPlazaEditSessionResponseDto;
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
  StrategyPlazaProxyControllerEditSession200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerEditSession200ResponseBuilder();
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


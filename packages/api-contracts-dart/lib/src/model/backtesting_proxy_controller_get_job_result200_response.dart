//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_report_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_proxy_controller_get_job_result200_response.g.dart';

/// BacktestingProxyControllerGetJobResult200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class BacktestingProxyControllerGetJobResult200Response implements Built<BacktestingProxyControllerGetJobResult200Response, BacktestingProxyControllerGetJobResult200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BacktestingReportResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  BacktestingProxyControllerGetJobResult200Response._();

  factory BacktestingProxyControllerGetJobResult200Response([void updates(BacktestingProxyControllerGetJobResult200ResponseBuilder b)]) = _$BacktestingProxyControllerGetJobResult200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingProxyControllerGetJobResult200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingProxyControllerGetJobResult200Response> get serializer => _$BacktestingProxyControllerGetJobResult200ResponseSerializer();
}

class _$BacktestingProxyControllerGetJobResult200ResponseSerializer implements PrimitiveSerializer<BacktestingProxyControllerGetJobResult200Response> {
  @override
  final Iterable<Type> types = const [BacktestingProxyControllerGetJobResult200Response, _$BacktestingProxyControllerGetJobResult200Response];

  @override
  final String wireName = r'BacktestingProxyControllerGetJobResult200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingProxyControllerGetJobResult200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BacktestingReportResponseDto),
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
    BacktestingProxyControllerGetJobResult200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingProxyControllerGetJobResult200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingReportResponseDto),
          ) as BacktestingReportResponseDto;
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
  BacktestingProxyControllerGetJobResult200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingProxyControllerGetJobResult200ResponseBuilder();
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


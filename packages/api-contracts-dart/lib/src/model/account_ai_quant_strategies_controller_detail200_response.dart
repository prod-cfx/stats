//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/account_ai_quant_strategy_detail_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_strategies_controller_detail200_response.g.dart';

/// AccountAiQuantStrategiesControllerDetail200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AccountAiQuantStrategiesControllerDetail200Response implements Built<AccountAiQuantStrategiesControllerDetail200Response, AccountAiQuantStrategiesControllerDetail200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AccountAiQuantStrategyDetailResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AccountAiQuantStrategiesControllerDetail200Response._();

  factory AccountAiQuantStrategiesControllerDetail200Response([void updates(AccountAiQuantStrategiesControllerDetail200ResponseBuilder b)]) = _$AccountAiQuantStrategiesControllerDetail200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantStrategiesControllerDetail200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantStrategiesControllerDetail200Response> get serializer => _$AccountAiQuantStrategiesControllerDetail200ResponseSerializer();
}

class _$AccountAiQuantStrategiesControllerDetail200ResponseSerializer implements PrimitiveSerializer<AccountAiQuantStrategiesControllerDetail200Response> {
  @override
  final Iterable<Type> types = const [AccountAiQuantStrategiesControllerDetail200Response, _$AccountAiQuantStrategiesControllerDetail200Response];

  @override
  final String wireName = r'AccountAiQuantStrategiesControllerDetail200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantStrategiesControllerDetail200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDto),
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
    AccountAiQuantStrategiesControllerDetail200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantStrategiesControllerDetail200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDto),
          ) as AccountAiQuantStrategyDetailResponseDto;
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
  AccountAiQuantStrategiesControllerDetail200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantStrategiesControllerDetail200ResponseBuilder();
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


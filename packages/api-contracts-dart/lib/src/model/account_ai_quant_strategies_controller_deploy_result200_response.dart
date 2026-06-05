//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/account_ai_quant_strategy_detail_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_strategies_controller_deploy_result200_response.g.dart';

/// AccountAiQuantStrategiesControllerDeployResult200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AccountAiQuantStrategiesControllerDeployResult200Response implements Built<AccountAiQuantStrategiesControllerDeployResult200Response, AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AccountAiQuantStrategyDetailResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AccountAiQuantStrategiesControllerDeployResult200Response._();

  factory AccountAiQuantStrategiesControllerDeployResult200Response([void updates(AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder b)]) = _$AccountAiQuantStrategiesControllerDeployResult200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantStrategiesControllerDeployResult200Response> get serializer => _$AccountAiQuantStrategiesControllerDeployResult200ResponseSerializer();
}

class _$AccountAiQuantStrategiesControllerDeployResult200ResponseSerializer implements PrimitiveSerializer<AccountAiQuantStrategiesControllerDeployResult200Response> {
  @override
  final Iterable<Type> types = const [AccountAiQuantStrategiesControllerDeployResult200Response, _$AccountAiQuantStrategiesControllerDeployResult200Response];

  @override
  final String wireName = r'AccountAiQuantStrategiesControllerDeployResult200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantStrategiesControllerDeployResult200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield object.data == null ? null : serializers.serialize(
      object.data,
      specifiedType: const FullType.nullable(AccountAiQuantStrategyDetailResponseDto),
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
    AccountAiQuantStrategiesControllerDeployResult200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(AccountAiQuantStrategyDetailResponseDto),
          ) as AccountAiQuantStrategyDetailResponseDto?;
          if (valueDes == null) continue;
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
  AccountAiQuantStrategiesControllerDeployResult200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder();
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


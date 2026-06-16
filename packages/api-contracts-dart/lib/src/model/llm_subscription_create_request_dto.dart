//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_subscription_create_request_dto.g.dart';

/// LlmSubscriptionCreateRequestDto
///
/// Properties:
/// * [llmStrategyInstanceId] - LLM 策略实例 ID
/// * [customParams]
/// * [exchangeAccountId] - 交易所账户 ID
@BuiltValue()
abstract class LlmSubscriptionCreateRequestDto implements Built<LlmSubscriptionCreateRequestDto, LlmSubscriptionCreateRequestDtoBuilder> {
  /// LLM 策略实例 ID
  @BuiltValueField(wireName: r'llmStrategyInstanceId')
  String get llmStrategyInstanceId;

  @BuiltValueField(wireName: r'customParams')
  BuiltMap<String, JsonObject?>? get customParams;

  /// 交易所账户 ID
  @BuiltValueField(wireName: r'exchangeAccountId')
  String get exchangeAccountId;

  LlmSubscriptionCreateRequestDto._();

  factory LlmSubscriptionCreateRequestDto([void updates(LlmSubscriptionCreateRequestDtoBuilder b)]) = _$LlmSubscriptionCreateRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmSubscriptionCreateRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmSubscriptionCreateRequestDto> get serializer => _$LlmSubscriptionCreateRequestDtoSerializer();
}

class _$LlmSubscriptionCreateRequestDtoSerializer implements PrimitiveSerializer<LlmSubscriptionCreateRequestDto> {
  @override
  final Iterable<Type> types = const [LlmSubscriptionCreateRequestDto, _$LlmSubscriptionCreateRequestDto];

  @override
  final String wireName = r'LlmSubscriptionCreateRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmSubscriptionCreateRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'llmStrategyInstanceId';
    yield serializers.serialize(
      object.llmStrategyInstanceId,
      specifiedType: const FullType(String),
    );
    if (object.customParams != null) {
      yield r'customParams';
      yield serializers.serialize(
        object.customParams,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    yield r'exchangeAccountId';
    yield serializers.serialize(
      object.exchangeAccountId,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LlmSubscriptionCreateRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmSubscriptionCreateRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'llmStrategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.llmStrategyInstanceId = valueDes;
          break;
        case r'customParams':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.customParams.replace(valueDes);
          break;
        case r'exchangeAccountId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchangeAccountId = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LlmSubscriptionCreateRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmSubscriptionCreateRequestDtoBuilder();
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

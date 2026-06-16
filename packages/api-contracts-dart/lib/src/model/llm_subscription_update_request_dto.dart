//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_subscription_update_request_dto.g.dart';

/// LlmSubscriptionUpdateRequestDto
///
/// Properties:
/// * [status]
/// * [customParams]
/// * [exchangeAccountId]
@BuiltValue()
abstract class LlmSubscriptionUpdateRequestDto implements Built<LlmSubscriptionUpdateRequestDto, LlmSubscriptionUpdateRequestDtoBuilder> {
  @BuiltValueField(wireName: r'status')
  LlmSubscriptionUpdateRequestDtoStatusEnum? get status;
  // enum statusEnum {  active,  paused,  cancelled,  };

  @BuiltValueField(wireName: r'customParams')
  BuiltMap<String, JsonObject?>? get customParams;

  @BuiltValueField(wireName: r'exchangeAccountId')
  String? get exchangeAccountId;

  LlmSubscriptionUpdateRequestDto._();

  factory LlmSubscriptionUpdateRequestDto([void updates(LlmSubscriptionUpdateRequestDtoBuilder b)]) = _$LlmSubscriptionUpdateRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmSubscriptionUpdateRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmSubscriptionUpdateRequestDto> get serializer => _$LlmSubscriptionUpdateRequestDtoSerializer();
}

class _$LlmSubscriptionUpdateRequestDtoSerializer implements PrimitiveSerializer<LlmSubscriptionUpdateRequestDto> {
  @override
  final Iterable<Type> types = const [LlmSubscriptionUpdateRequestDto, _$LlmSubscriptionUpdateRequestDto];

  @override
  final String wireName = r'LlmSubscriptionUpdateRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmSubscriptionUpdateRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.status != null) {
      yield r'status';
      yield serializers.serialize(
        object.status,
        specifiedType: const FullType(LlmSubscriptionUpdateRequestDtoStatusEnum),
      );
    }
    if (object.customParams != null) {
      yield r'customParams';
      yield serializers.serialize(
        object.customParams,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.exchangeAccountId != null) {
      yield r'exchangeAccountId';
      yield serializers.serialize(
        object.exchangeAccountId,
        specifiedType: const FullType.nullable(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    LlmSubscriptionUpdateRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmSubscriptionUpdateRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmSubscriptionUpdateRequestDtoStatusEnum),
          ) as LlmSubscriptionUpdateRequestDtoStatusEnum;
          result.status = valueDes;
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
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
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
  LlmSubscriptionUpdateRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmSubscriptionUpdateRequestDtoBuilder();
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

class LlmSubscriptionUpdateRequestDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'active')
  static const LlmSubscriptionUpdateRequestDtoStatusEnum active = _$llmSubscriptionUpdateRequestDtoStatusEnum_active;
  @BuiltValueEnumConst(wireName: r'paused')
  static const LlmSubscriptionUpdateRequestDtoStatusEnum paused = _$llmSubscriptionUpdateRequestDtoStatusEnum_paused;
  @BuiltValueEnumConst(wireName: r'cancelled')
  static const LlmSubscriptionUpdateRequestDtoStatusEnum cancelled = _$llmSubscriptionUpdateRequestDtoStatusEnum_cancelled;

  static Serializer<LlmSubscriptionUpdateRequestDtoStatusEnum> get serializer => _$llmSubscriptionUpdateRequestDtoStatusEnumSerializer;

  const LlmSubscriptionUpdateRequestDtoStatusEnum._(String name): super(name);

  static BuiltSet<LlmSubscriptionUpdateRequestDtoStatusEnum> get values => _$llmSubscriptionUpdateRequestDtoStatusEnumValues;
  static LlmSubscriptionUpdateRequestDtoStatusEnum valueOf(String name) => _$llmSubscriptionUpdateRequestDtoStatusEnumValueOf(name);
}

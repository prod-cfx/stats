//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_subscription_response_dto.g.dart';

/// LlmSubscriptionResponseDto
///
/// Properties:
/// * [id] 
/// * [userId] 
/// * [llmStrategyInstanceId] 
/// * [llmStrategyInstanceName] 
/// * [llmStrategyName] 
/// * [llmStrategyDescription] 
/// * [status] 
/// * [customParams] 
/// * [exchangeAccountId] 
/// * [exchangeId] 
/// * [exchangeName] 
/// * [subscribedAt] 
/// * [unsubscribedAt] 
/// * [createdAt] 
/// * [updatedAt] 
@BuiltValue()
abstract class LlmSubscriptionResponseDto implements Built<LlmSubscriptionResponseDto, LlmSubscriptionResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'userId')
  String get userId;

  @BuiltValueField(wireName: r'llmStrategyInstanceId')
  String get llmStrategyInstanceId;

  @BuiltValueField(wireName: r'llmStrategyInstanceName')
  String get llmStrategyInstanceName;

  @BuiltValueField(wireName: r'llmStrategyName')
  String get llmStrategyName;

  @BuiltValueField(wireName: r'llmStrategyDescription')
  String? get llmStrategyDescription;

  @BuiltValueField(wireName: r'status')
  LlmSubscriptionResponseDtoStatusEnum get status;
  // enum statusEnum {  active,  paused,  cancelled,  };

  @BuiltValueField(wireName: r'customParams')
  BuiltMap<String, JsonObject?>? get customParams;

  @BuiltValueField(wireName: r'exchangeAccountId')
  String? get exchangeAccountId;

  @BuiltValueField(wireName: r'exchangeId')
  String? get exchangeId;

  @BuiltValueField(wireName: r'exchangeName')
  String? get exchangeName;

  @BuiltValueField(wireName: r'subscribedAt')
  String get subscribedAt;

  @BuiltValueField(wireName: r'unsubscribedAt')
  String? get unsubscribedAt;

  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  LlmSubscriptionResponseDto._();

  factory LlmSubscriptionResponseDto([void updates(LlmSubscriptionResponseDtoBuilder b)]) = _$LlmSubscriptionResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmSubscriptionResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmSubscriptionResponseDto> get serializer => _$LlmSubscriptionResponseDtoSerializer();
}

class _$LlmSubscriptionResponseDtoSerializer implements PrimitiveSerializer<LlmSubscriptionResponseDto> {
  @override
  final Iterable<Type> types = const [LlmSubscriptionResponseDto, _$LlmSubscriptionResponseDto];

  @override
  final String wireName = r'LlmSubscriptionResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmSubscriptionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'userId';
    yield serializers.serialize(
      object.userId,
      specifiedType: const FullType(String),
    );
    yield r'llmStrategyInstanceId';
    yield serializers.serialize(
      object.llmStrategyInstanceId,
      specifiedType: const FullType(String),
    );
    yield r'llmStrategyInstanceName';
    yield serializers.serialize(
      object.llmStrategyInstanceName,
      specifiedType: const FullType(String),
    );
    yield r'llmStrategyName';
    yield serializers.serialize(
      object.llmStrategyName,
      specifiedType: const FullType(String),
    );
    if (object.llmStrategyDescription != null) {
      yield r'llmStrategyDescription';
      yield serializers.serialize(
        object.llmStrategyDescription,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(LlmSubscriptionResponseDtoStatusEnum),
    );
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
    if (object.exchangeId != null) {
      yield r'exchangeId';
      yield serializers.serialize(
        object.exchangeId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.exchangeName != null) {
      yield r'exchangeName';
      yield serializers.serialize(
        object.exchangeName,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'subscribedAt';
    yield serializers.serialize(
      object.subscribedAt,
      specifiedType: const FullType(String),
    );
    if (object.unsubscribedAt != null) {
      yield r'unsubscribedAt';
      yield serializers.serialize(
        object.unsubscribedAt,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LlmSubscriptionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmSubscriptionResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'userId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userId = valueDes;
          break;
        case r'llmStrategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.llmStrategyInstanceId = valueDes;
          break;
        case r'llmStrategyInstanceName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.llmStrategyInstanceName = valueDes;
          break;
        case r'llmStrategyName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.llmStrategyName = valueDes;
          break;
        case r'llmStrategyDescription':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.llmStrategyDescription = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmSubscriptionResponseDtoStatusEnum),
          ) as LlmSubscriptionResponseDtoStatusEnum;
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
        case r'exchangeId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.exchangeId = valueDes;
          break;
        case r'exchangeName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.exchangeName = valueDes;
          break;
        case r'subscribedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.subscribedAt = valueDes;
          break;
        case r'unsubscribedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.unsubscribedAt = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LlmSubscriptionResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmSubscriptionResponseDtoBuilder();
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

class LlmSubscriptionResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'active')
  static const LlmSubscriptionResponseDtoStatusEnum active = _$llmSubscriptionResponseDtoStatusEnum_active;
  @BuiltValueEnumConst(wireName: r'paused')
  static const LlmSubscriptionResponseDtoStatusEnum paused = _$llmSubscriptionResponseDtoStatusEnum_paused;
  @BuiltValueEnumConst(wireName: r'cancelled')
  static const LlmSubscriptionResponseDtoStatusEnum cancelled = _$llmSubscriptionResponseDtoStatusEnum_cancelled;

  static Serializer<LlmSubscriptionResponseDtoStatusEnum> get serializer => _$llmSubscriptionResponseDtoStatusEnumSerializer;

  const LlmSubscriptionResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<LlmSubscriptionResponseDtoStatusEnum> get values => _$llmSubscriptionResponseDtoStatusEnumValues;
  static LlmSubscriptionResponseDtoStatusEnum valueOf(String name) => _$llmSubscriptionResponseDtoStatusEnumValueOf(name);
}


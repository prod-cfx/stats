//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_strategy_instance_signal_response_dto.g.dart';

/// LlmStrategyInstanceSignalResponseDto
///
/// Properties:
/// * [id] 
/// * [strategyId] 
/// * [strategyInstanceId] 
/// * [llmStrategyId] 
/// * [llmStrategyInstanceId] 
/// * [symbolId] 
/// * [symbolCode] 
/// * [sourceType] 
/// * [signalType] 
/// * [direction] 
/// * [confidence] 
/// * [entryPrice] 
/// * [targetPrice] 
/// * [stopLoss] 
/// * [takeProfit] 
/// * [positionSizeQuote] 
/// * [positionSizeRatio] 
/// * [aiModel] 
/// * [aiReasoning] 
/// * [aiRawResponse] 
/// * [marketContext] 
/// * [metadata] 
/// * [status] 
/// * [publishedAt] 
/// * [expiresAt] 
/// * [createdAt] 
/// * [updatedAt] 
@BuiltValue()
abstract class LlmStrategyInstanceSignalResponseDto implements Built<LlmStrategyInstanceSignalResponseDto, LlmStrategyInstanceSignalResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'strategyId')
  String? get strategyId;

  @BuiltValueField(wireName: r'strategyInstanceId')
  String? get strategyInstanceId;

  @BuiltValueField(wireName: r'llmStrategyId')
  String? get llmStrategyId;

  @BuiltValueField(wireName: r'llmStrategyInstanceId')
  String? get llmStrategyInstanceId;

  @BuiltValueField(wireName: r'symbolId')
  String get symbolId;

  @BuiltValueField(wireName: r'symbolCode')
  String? get symbolCode;

  @BuiltValueField(wireName: r'sourceType')
  LlmStrategyInstanceSignalResponseDtoSourceTypeEnum get sourceType;
  // enum sourceTypeEnum {  AI_GENERATED,  MANUAL,  SYSTEM,  };

  @BuiltValueField(wireName: r'signalType')
  LlmStrategyInstanceSignalResponseDtoSignalTypeEnum get signalType;
  // enum signalTypeEnum {  ENTRY,  EXIT,  ADJUSTMENT,  ALERT,  };

  @BuiltValueField(wireName: r'direction')
  LlmStrategyInstanceSignalResponseDtoDirectionEnum get direction;
  // enum directionEnum {  BUY,  SELL,  CLOSE_LONG,  CLOSE_SHORT,  };

  @BuiltValueField(wireName: r'confidence')
  String? get confidence;

  @BuiltValueField(wireName: r'entryPrice')
  String? get entryPrice;

  @BuiltValueField(wireName: r'targetPrice')
  String? get targetPrice;

  @BuiltValueField(wireName: r'stopLoss')
  String? get stopLoss;

  @BuiltValueField(wireName: r'takeProfit')
  String? get takeProfit;

  @BuiltValueField(wireName: r'positionSizeQuote')
  String? get positionSizeQuote;

  @BuiltValueField(wireName: r'positionSizeRatio')
  String? get positionSizeRatio;

  @BuiltValueField(wireName: r'aiModel')
  String? get aiModel;

  @BuiltValueField(wireName: r'aiReasoning')
  String? get aiReasoning;

  @BuiltValueField(wireName: r'aiRawResponse')
  BuiltMap<String, JsonObject?>? get aiRawResponse;

  @BuiltValueField(wireName: r'marketContext')
  BuiltMap<String, JsonObject?>? get marketContext;

  @BuiltValueField(wireName: r'metadata')
  BuiltMap<String, JsonObject?>? get metadata;

  @BuiltValueField(wireName: r'status')
  LlmStrategyInstanceSignalResponseDtoStatusEnum get status;
  // enum statusEnum {  PENDING,  EXECUTED,  PARTIAL,  EXPIRED,  CANCELLED,  FAILED,  };

  @BuiltValueField(wireName: r'publishedAt')
  String get publishedAt;

  @BuiltValueField(wireName: r'expiresAt')
  String? get expiresAt;

  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  LlmStrategyInstanceSignalResponseDto._();

  factory LlmStrategyInstanceSignalResponseDto([void updates(LlmStrategyInstanceSignalResponseDtoBuilder b)]) = _$LlmStrategyInstanceSignalResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmStrategyInstanceSignalResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmStrategyInstanceSignalResponseDto> get serializer => _$LlmStrategyInstanceSignalResponseDtoSerializer();
}

class _$LlmStrategyInstanceSignalResponseDtoSerializer implements PrimitiveSerializer<LlmStrategyInstanceSignalResponseDto> {
  @override
  final Iterable<Type> types = const [LlmStrategyInstanceSignalResponseDto, _$LlmStrategyInstanceSignalResponseDto];

  @override
  final String wireName = r'LlmStrategyInstanceSignalResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmStrategyInstanceSignalResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    if (object.strategyId != null) {
      yield r'strategyId';
      yield serializers.serialize(
        object.strategyId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.strategyInstanceId != null) {
      yield r'strategyInstanceId';
      yield serializers.serialize(
        object.strategyInstanceId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.llmStrategyId != null) {
      yield r'llmStrategyId';
      yield serializers.serialize(
        object.llmStrategyId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.llmStrategyInstanceId != null) {
      yield r'llmStrategyInstanceId';
      yield serializers.serialize(
        object.llmStrategyInstanceId,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'symbolId';
    yield serializers.serialize(
      object.symbolId,
      specifiedType: const FullType(String),
    );
    if (object.symbolCode != null) {
      yield r'symbolCode';
      yield serializers.serialize(
        object.symbolCode,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'sourceType';
    yield serializers.serialize(
      object.sourceType,
      specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoSourceTypeEnum),
    );
    yield r'signalType';
    yield serializers.serialize(
      object.signalType,
      specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoSignalTypeEnum),
    );
    yield r'direction';
    yield serializers.serialize(
      object.direction,
      specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoDirectionEnum),
    );
    if (object.confidence != null) {
      yield r'confidence';
      yield serializers.serialize(
        object.confidence,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.entryPrice != null) {
      yield r'entryPrice';
      yield serializers.serialize(
        object.entryPrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.targetPrice != null) {
      yield r'targetPrice';
      yield serializers.serialize(
        object.targetPrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.stopLoss != null) {
      yield r'stopLoss';
      yield serializers.serialize(
        object.stopLoss,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.takeProfit != null) {
      yield r'takeProfit';
      yield serializers.serialize(
        object.takeProfit,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.positionSizeQuote != null) {
      yield r'positionSizeQuote';
      yield serializers.serialize(
        object.positionSizeQuote,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.positionSizeRatio != null) {
      yield r'positionSizeRatio';
      yield serializers.serialize(
        object.positionSizeRatio,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.aiModel != null) {
      yield r'aiModel';
      yield serializers.serialize(
        object.aiModel,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.aiReasoning != null) {
      yield r'aiReasoning';
      yield serializers.serialize(
        object.aiReasoning,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.aiRawResponse != null) {
      yield r'aiRawResponse';
      yield serializers.serialize(
        object.aiRawResponse,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.marketContext != null) {
      yield r'marketContext';
      yield serializers.serialize(
        object.marketContext,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoStatusEnum),
    );
    yield r'publishedAt';
    yield serializers.serialize(
      object.publishedAt,
      specifiedType: const FullType(String),
    );
    if (object.expiresAt != null) {
      yield r'expiresAt';
      yield serializers.serialize(
        object.expiresAt,
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
    LlmStrategyInstanceSignalResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmStrategyInstanceSignalResponseDtoBuilder result,
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
        case r'strategyId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.strategyId = valueDes;
          break;
        case r'strategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.strategyInstanceId = valueDes;
          break;
        case r'llmStrategyId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.llmStrategyId = valueDes;
          break;
        case r'llmStrategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.llmStrategyInstanceId = valueDes;
          break;
        case r'symbolId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbolId = valueDes;
          break;
        case r'symbolCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.symbolCode = valueDes;
          break;
        case r'sourceType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoSourceTypeEnum),
          ) as LlmStrategyInstanceSignalResponseDtoSourceTypeEnum;
          result.sourceType = valueDes;
          break;
        case r'signalType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoSignalTypeEnum),
          ) as LlmStrategyInstanceSignalResponseDtoSignalTypeEnum;
          result.signalType = valueDes;
          break;
        case r'direction':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoDirectionEnum),
          ) as LlmStrategyInstanceSignalResponseDtoDirectionEnum;
          result.direction = valueDes;
          break;
        case r'confidence':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.confidence = valueDes;
          break;
        case r'entryPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.entryPrice = valueDes;
          break;
        case r'targetPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.targetPrice = valueDes;
          break;
        case r'stopLoss':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.stopLoss = valueDes;
          break;
        case r'takeProfit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.takeProfit = valueDes;
          break;
        case r'positionSizeQuote':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.positionSizeQuote = valueDes;
          break;
        case r'positionSizeRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.positionSizeRatio = valueDes;
          break;
        case r'aiModel':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.aiModel = valueDes;
          break;
        case r'aiReasoning':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.aiReasoning = valueDes;
          break;
        case r'aiRawResponse':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.aiRawResponse.replace(valueDes);
          break;
        case r'marketContext':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.marketContext.replace(valueDes);
          break;
        case r'metadata':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.metadata.replace(valueDes);
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceSignalResponseDtoStatusEnum),
          ) as LlmStrategyInstanceSignalResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'publishedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.publishedAt = valueDes;
          break;
        case r'expiresAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.expiresAt = valueDes;
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
  LlmStrategyInstanceSignalResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmStrategyInstanceSignalResponseDtoBuilder();
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

class LlmStrategyInstanceSignalResponseDtoSourceTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'AI_GENERATED')
  static const LlmStrategyInstanceSignalResponseDtoSourceTypeEnum AI_GENERATED = _$llmStrategyInstanceSignalResponseDtoSourceTypeEnum_AI_GENERATED;
  @BuiltValueEnumConst(wireName: r'MANUAL')
  static const LlmStrategyInstanceSignalResponseDtoSourceTypeEnum MANUAL = _$llmStrategyInstanceSignalResponseDtoSourceTypeEnum_MANUAL;
  @BuiltValueEnumConst(wireName: r'SYSTEM')
  static const LlmStrategyInstanceSignalResponseDtoSourceTypeEnum SYSTEM = _$llmStrategyInstanceSignalResponseDtoSourceTypeEnum_SYSTEM;

  static Serializer<LlmStrategyInstanceSignalResponseDtoSourceTypeEnum> get serializer => _$llmStrategyInstanceSignalResponseDtoSourceTypeEnumSerializer;

  const LlmStrategyInstanceSignalResponseDtoSourceTypeEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceSignalResponseDtoSourceTypeEnum> get values => _$llmStrategyInstanceSignalResponseDtoSourceTypeEnumValues;
  static LlmStrategyInstanceSignalResponseDtoSourceTypeEnum valueOf(String name) => _$llmStrategyInstanceSignalResponseDtoSourceTypeEnumValueOf(name);
}

class LlmStrategyInstanceSignalResponseDtoSignalTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'ENTRY')
  static const LlmStrategyInstanceSignalResponseDtoSignalTypeEnum ENTRY = _$llmStrategyInstanceSignalResponseDtoSignalTypeEnum_ENTRY;
  @BuiltValueEnumConst(wireName: r'EXIT')
  static const LlmStrategyInstanceSignalResponseDtoSignalTypeEnum EXIT = _$llmStrategyInstanceSignalResponseDtoSignalTypeEnum_EXIT;
  @BuiltValueEnumConst(wireName: r'ADJUSTMENT')
  static const LlmStrategyInstanceSignalResponseDtoSignalTypeEnum ADJUSTMENT = _$llmStrategyInstanceSignalResponseDtoSignalTypeEnum_ADJUSTMENT;
  @BuiltValueEnumConst(wireName: r'ALERT')
  static const LlmStrategyInstanceSignalResponseDtoSignalTypeEnum ALERT = _$llmStrategyInstanceSignalResponseDtoSignalTypeEnum_ALERT;

  static Serializer<LlmStrategyInstanceSignalResponseDtoSignalTypeEnum> get serializer => _$llmStrategyInstanceSignalResponseDtoSignalTypeEnumSerializer;

  const LlmStrategyInstanceSignalResponseDtoSignalTypeEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceSignalResponseDtoSignalTypeEnum> get values => _$llmStrategyInstanceSignalResponseDtoSignalTypeEnumValues;
  static LlmStrategyInstanceSignalResponseDtoSignalTypeEnum valueOf(String name) => _$llmStrategyInstanceSignalResponseDtoSignalTypeEnumValueOf(name);
}

class LlmStrategyInstanceSignalResponseDtoDirectionEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'BUY')
  static const LlmStrategyInstanceSignalResponseDtoDirectionEnum BUY = _$llmStrategyInstanceSignalResponseDtoDirectionEnum_BUY;
  @BuiltValueEnumConst(wireName: r'SELL')
  static const LlmStrategyInstanceSignalResponseDtoDirectionEnum SELL = _$llmStrategyInstanceSignalResponseDtoDirectionEnum_SELL;
  @BuiltValueEnumConst(wireName: r'CLOSE_LONG')
  static const LlmStrategyInstanceSignalResponseDtoDirectionEnum CLOSE_LONG = _$llmStrategyInstanceSignalResponseDtoDirectionEnum_CLOSE_LONG;
  @BuiltValueEnumConst(wireName: r'CLOSE_SHORT')
  static const LlmStrategyInstanceSignalResponseDtoDirectionEnum CLOSE_SHORT = _$llmStrategyInstanceSignalResponseDtoDirectionEnum_CLOSE_SHORT;

  static Serializer<LlmStrategyInstanceSignalResponseDtoDirectionEnum> get serializer => _$llmStrategyInstanceSignalResponseDtoDirectionEnumSerializer;

  const LlmStrategyInstanceSignalResponseDtoDirectionEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceSignalResponseDtoDirectionEnum> get values => _$llmStrategyInstanceSignalResponseDtoDirectionEnumValues;
  static LlmStrategyInstanceSignalResponseDtoDirectionEnum valueOf(String name) => _$llmStrategyInstanceSignalResponseDtoDirectionEnumValueOf(name);
}

class LlmStrategyInstanceSignalResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'PENDING')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum PENDING = _$llmStrategyInstanceSignalResponseDtoStatusEnum_PENDING;
  @BuiltValueEnumConst(wireName: r'EXECUTED')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum EXECUTED = _$llmStrategyInstanceSignalResponseDtoStatusEnum_EXECUTED;
  @BuiltValueEnumConst(wireName: r'PARTIAL')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum PARTIAL = _$llmStrategyInstanceSignalResponseDtoStatusEnum_PARTIAL;
  @BuiltValueEnumConst(wireName: r'EXPIRED')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum EXPIRED = _$llmStrategyInstanceSignalResponseDtoStatusEnum_EXPIRED;
  @BuiltValueEnumConst(wireName: r'CANCELLED')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum CANCELLED = _$llmStrategyInstanceSignalResponseDtoStatusEnum_CANCELLED;
  @BuiltValueEnumConst(wireName: r'FAILED')
  static const LlmStrategyInstanceSignalResponseDtoStatusEnum FAILED = _$llmStrategyInstanceSignalResponseDtoStatusEnum_FAILED;

  static Serializer<LlmStrategyInstanceSignalResponseDtoStatusEnum> get serializer => _$llmStrategyInstanceSignalResponseDtoStatusEnumSerializer;

  const LlmStrategyInstanceSignalResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceSignalResponseDtoStatusEnum> get values => _$llmStrategyInstanceSignalResponseDtoStatusEnumValues;
  static LlmStrategyInstanceSignalResponseDtoStatusEnum valueOf(String name) => _$llmStrategyInstanceSignalResponseDtoStatusEnumValueOf(name);
}


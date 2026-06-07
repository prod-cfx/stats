//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_strategy_instance_response_dto.g.dart';

/// LlmStrategyInstanceResponseDto
///
/// Properties:
/// * [id] 
/// * [strategyId] 
/// * [strategyName] 
/// * [strategyDescription] 
/// * [name] 
/// * [description] 
/// * [status] 
/// * [mode] 
/// * [llmModel] 
/// * [lastRunAt] 
/// * [isSubscribed] 
/// * [createdAt] 
/// * [updatedAt] 
@BuiltValue()
abstract class LlmStrategyInstanceResponseDto implements Built<LlmStrategyInstanceResponseDto, LlmStrategyInstanceResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'strategyId')
  String get strategyId;

  @BuiltValueField(wireName: r'strategyName')
  String get strategyName;

  @BuiltValueField(wireName: r'strategyDescription')
  String? get strategyDescription;

  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'description')
  String? get description;

  @BuiltValueField(wireName: r'status')
  LlmStrategyInstanceResponseDtoStatusEnum get status;
  // enum statusEnum {  running,  paused,  stopped,  };

  @BuiltValueField(wireName: r'mode')
  LlmStrategyInstanceResponseDtoModeEnum get mode;
  // enum modeEnum {  LIVE,  PAPER,  BACKTEST,  };

  @BuiltValueField(wireName: r'llmModel')
  String get llmModel;

  @BuiltValueField(wireName: r'lastRunAt')
  String? get lastRunAt;

  @BuiltValueField(wireName: r'isSubscribed')
  bool get isSubscribed;

  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  LlmStrategyInstanceResponseDto._();

  factory LlmStrategyInstanceResponseDto([void updates(LlmStrategyInstanceResponseDtoBuilder b)]) = _$LlmStrategyInstanceResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmStrategyInstanceResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmStrategyInstanceResponseDto> get serializer => _$LlmStrategyInstanceResponseDtoSerializer();
}

class _$LlmStrategyInstanceResponseDtoSerializer implements PrimitiveSerializer<LlmStrategyInstanceResponseDto> {
  @override
  final Iterable<Type> types = const [LlmStrategyInstanceResponseDto, _$LlmStrategyInstanceResponseDto];

  @override
  final String wireName = r'LlmStrategyInstanceResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmStrategyInstanceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'strategyId';
    yield serializers.serialize(
      object.strategyId,
      specifiedType: const FullType(String),
    );
    yield r'strategyName';
    yield serializers.serialize(
      object.strategyName,
      specifiedType: const FullType(String),
    );
    if (object.strategyDescription != null) {
      yield r'strategyDescription';
      yield serializers.serialize(
        object.strategyDescription,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(LlmStrategyInstanceResponseDtoStatusEnum),
    );
    yield r'mode';
    yield serializers.serialize(
      object.mode,
      specifiedType: const FullType(LlmStrategyInstanceResponseDtoModeEnum),
    );
    yield r'llmModel';
    yield serializers.serialize(
      object.llmModel,
      specifiedType: const FullType(String),
    );
    if (object.lastRunAt != null) {
      yield r'lastRunAt';
      yield serializers.serialize(
        object.lastRunAt,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'isSubscribed';
    yield serializers.serialize(
      object.isSubscribed,
      specifiedType: const FullType(bool),
    );
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
    LlmStrategyInstanceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmStrategyInstanceResponseDtoBuilder result,
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
            specifiedType: const FullType(String),
          ) as String;
          result.strategyId = valueDes;
          break;
        case r'strategyName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.strategyName = valueDes;
          break;
        case r'strategyDescription':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.strategyDescription = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.description = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceResponseDtoStatusEnum),
          ) as LlmStrategyInstanceResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'mode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmStrategyInstanceResponseDtoModeEnum),
          ) as LlmStrategyInstanceResponseDtoModeEnum;
          result.mode = valueDes;
          break;
        case r'llmModel':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.llmModel = valueDes;
          break;
        case r'lastRunAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.lastRunAt = valueDes;
          break;
        case r'isSubscribed':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isSubscribed = valueDes;
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
  LlmStrategyInstanceResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmStrategyInstanceResponseDtoBuilder();
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

class LlmStrategyInstanceResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'running')
  static const LlmStrategyInstanceResponseDtoStatusEnum running = _$llmStrategyInstanceResponseDtoStatusEnum_running;
  @BuiltValueEnumConst(wireName: r'paused')
  static const LlmStrategyInstanceResponseDtoStatusEnum paused = _$llmStrategyInstanceResponseDtoStatusEnum_paused;
  @BuiltValueEnumConst(wireName: r'stopped')
  static const LlmStrategyInstanceResponseDtoStatusEnum stopped = _$llmStrategyInstanceResponseDtoStatusEnum_stopped;

  static Serializer<LlmStrategyInstanceResponseDtoStatusEnum> get serializer => _$llmStrategyInstanceResponseDtoStatusEnumSerializer;

  const LlmStrategyInstanceResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceResponseDtoStatusEnum> get values => _$llmStrategyInstanceResponseDtoStatusEnumValues;
  static LlmStrategyInstanceResponseDtoStatusEnum valueOf(String name) => _$llmStrategyInstanceResponseDtoStatusEnumValueOf(name);
}

class LlmStrategyInstanceResponseDtoModeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'LIVE')
  static const LlmStrategyInstanceResponseDtoModeEnum LIVE = _$llmStrategyInstanceResponseDtoModeEnum_LIVE;
  @BuiltValueEnumConst(wireName: r'PAPER')
  static const LlmStrategyInstanceResponseDtoModeEnum PAPER = _$llmStrategyInstanceResponseDtoModeEnum_PAPER;
  @BuiltValueEnumConst(wireName: r'BACKTEST')
  static const LlmStrategyInstanceResponseDtoModeEnum BACKTEST = _$llmStrategyInstanceResponseDtoModeEnum_BACKTEST;

  static Serializer<LlmStrategyInstanceResponseDtoModeEnum> get serializer => _$llmStrategyInstanceResponseDtoModeEnumSerializer;

  const LlmStrategyInstanceResponseDtoModeEnum._(String name): super(name);

  static BuiltSet<LlmStrategyInstanceResponseDtoModeEnum> get values => _$llmStrategyInstanceResponseDtoModeEnumValues;
  static LlmStrategyInstanceResponseDtoModeEnum valueOf(String name) => _$llmStrategyInstanceResponseDtoModeEnumValueOf(name);
}


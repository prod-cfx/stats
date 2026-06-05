//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_create_job_strategy_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_range_dto.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_execution_dto.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_requested_range_input_dto.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_bar_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_request_dto.g.dart';

/// BacktestingCreateJobRequestDto
///
/// Properties:
/// * [symbols] 
/// * [baseTimeframe] 
/// * [stateTimeframes] 
/// * [initialCash] 
/// * [leverage] 
/// * [allowPartial] 
/// * [conversationId] 
/// * [execution] 
/// * [strategy] 
/// * [dataRange] 
/// * [requestedRangeInput] 
/// * [bars] 
/// * [eventStreams] 
@BuiltValue()
abstract class BacktestingCreateJobRequestDto implements Built<BacktestingCreateJobRequestDto, BacktestingCreateJobRequestDtoBuilder> {
  @BuiltValueField(wireName: r'symbols')
  BuiltList<String> get symbols;

  @BuiltValueField(wireName: r'baseTimeframe')
  BacktestingCreateJobRequestDtoBaseTimeframeEnum get baseTimeframe;
  // enum baseTimeframeEnum {  1m,  3m,  5m,  15m,  30m,  1h,  4h,  6h,  8h,  12h,  1d,  1w,  };

  @BuiltValueField(wireName: r'stateTimeframes')
  BuiltList<BacktestingCreateJobRequestDtoStateTimeframesEnum> get stateTimeframes;
  // enum stateTimeframesEnum {  1m,  3m,  5m,  15m,  30m,  1h,  4h,  6h,  8h,  12h,  1d,  1w,  };

  @BuiltValueField(wireName: r'initialCash')
  num get initialCash;

  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  @BuiltValueField(wireName: r'allowPartial')
  bool? get allowPartial;

  @BuiltValueField(wireName: r'conversationId')
  String? get conversationId;

  @BuiltValueField(wireName: r'execution')
  BacktestingCreateJobExecutionDto get execution;

  @BuiltValueField(wireName: r'strategy')
  BacktestingCreateJobStrategyDto get strategy;

  @BuiltValueField(wireName: r'dataRange')
  BacktestingCreateJobRangeDto get dataRange;

  @BuiltValueField(wireName: r'requestedRangeInput')
  BacktestingCreateJobRequestedRangeInputDto? get requestedRangeInput;

  @BuiltValueField(wireName: r'bars')
  BuiltList<BacktestingCreateJobBarDto>? get bars;

  @BuiltValueField(wireName: r'eventStreams')
  BuiltMap<String, JsonObject?>? get eventStreams;

  BacktestingCreateJobRequestDto._();

  factory BacktestingCreateJobRequestDto([void updates(BacktestingCreateJobRequestDtoBuilder b)]) = _$BacktestingCreateJobRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobRequestDto> get serializer => _$BacktestingCreateJobRequestDtoSerializer();
}

class _$BacktestingCreateJobRequestDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobRequestDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobRequestDto, _$BacktestingCreateJobRequestDto];

  @override
  final String wireName = r'BacktestingCreateJobRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbols';
    yield serializers.serialize(
      object.symbols,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'baseTimeframe';
    yield serializers.serialize(
      object.baseTimeframe,
      specifiedType: const FullType(BacktestingCreateJobRequestDtoBaseTimeframeEnum),
    );
    yield r'stateTimeframes';
    yield serializers.serialize(
      object.stateTimeframes,
      specifiedType: const FullType(BuiltList, [FullType(BacktestingCreateJobRequestDtoStateTimeframesEnum)]),
    );
    yield r'initialCash';
    yield serializers.serialize(
      object.initialCash,
      specifiedType: const FullType(num),
    );
    if (object.leverage != null) {
      yield r'leverage';
      yield serializers.serialize(
        object.leverage,
        specifiedType: const FullType(num),
      );
    }
    if (object.allowPartial != null) {
      yield r'allowPartial';
      yield serializers.serialize(
        object.allowPartial,
        specifiedType: const FullType(bool),
      );
    }
    if (object.conversationId != null) {
      yield r'conversationId';
      yield serializers.serialize(
        object.conversationId,
        specifiedType: const FullType(String),
      );
    }
    yield r'execution';
    yield serializers.serialize(
      object.execution,
      specifiedType: const FullType(BacktestingCreateJobExecutionDto),
    );
    yield r'strategy';
    yield serializers.serialize(
      object.strategy,
      specifiedType: const FullType(BacktestingCreateJobStrategyDto),
    );
    yield r'dataRange';
    yield serializers.serialize(
      object.dataRange,
      specifiedType: const FullType(BacktestingCreateJobRangeDto),
    );
    if (object.requestedRangeInput != null) {
      yield r'requestedRangeInput';
      yield serializers.serialize(
        object.requestedRangeInput,
        specifiedType: const FullType(BacktestingCreateJobRequestedRangeInputDto),
      );
    }
    if (object.bars != null) {
      yield r'bars';
      yield serializers.serialize(
        object.bars,
        specifiedType: const FullType(BuiltList, [FullType(BacktestingCreateJobBarDto)]),
      );
    }
    if (object.eventStreams != null) {
      yield r'eventStreams';
      yield serializers.serialize(
        object.eventStreams,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'symbols':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.symbols.replace(valueDes);
          break;
        case r'baseTimeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRequestDtoBaseTimeframeEnum),
          ) as BacktestingCreateJobRequestDtoBaseTimeframeEnum;
          result.baseTimeframe = valueDes;
          break;
        case r'stateTimeframes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BacktestingCreateJobRequestDtoStateTimeframesEnum)]),
          ) as BuiltList<BacktestingCreateJobRequestDtoStateTimeframesEnum>;
          result.stateTimeframes.replace(valueDes);
          break;
        case r'initialCash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.initialCash = valueDes;
          break;
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.leverage = valueDes;
          break;
        case r'allowPartial':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.allowPartial = valueDes;
          break;
        case r'conversationId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.conversationId = valueDes;
          break;
        case r'execution':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobExecutionDto),
          ) as BacktestingCreateJobExecutionDto;
          result.execution.replace(valueDes);
          break;
        case r'strategy':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobStrategyDto),
          ) as BacktestingCreateJobStrategyDto;
          result.strategy.replace(valueDes);
          break;
        case r'dataRange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRangeDto),
          ) as BacktestingCreateJobRangeDto;
          result.dataRange.replace(valueDes);
          break;
        case r'requestedRangeInput':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRequestedRangeInputDto),
          ) as BacktestingCreateJobRequestedRangeInputDto;
          result.requestedRangeInput.replace(valueDes);
          break;
        case r'bars':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BacktestingCreateJobBarDto)]),
          ) as BuiltList<BacktestingCreateJobBarDto>;
          result.bars.replace(valueDes);
          break;
        case r'eventStreams':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.eventStreams.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobRequestDtoBuilder();
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

class BacktestingCreateJobRequestDtoBaseTimeframeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'1m')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n1m = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n1m;
  @BuiltValueEnumConst(wireName: r'3m')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n3m = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n3m;
  @BuiltValueEnumConst(wireName: r'5m')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n5m = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n5m;
  @BuiltValueEnumConst(wireName: r'15m')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n15m = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n15m;
  @BuiltValueEnumConst(wireName: r'30m')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n30m = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n30m;
  @BuiltValueEnumConst(wireName: r'1h')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n1h = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n1h;
  @BuiltValueEnumConst(wireName: r'4h')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n4h = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n4h;
  @BuiltValueEnumConst(wireName: r'6h')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n6h = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n6h;
  @BuiltValueEnumConst(wireName: r'8h')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n8h = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n8h;
  @BuiltValueEnumConst(wireName: r'12h')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n12h = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n12h;
  @BuiltValueEnumConst(wireName: r'1d')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n1d = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n1d;
  @BuiltValueEnumConst(wireName: r'1w')
  static const BacktestingCreateJobRequestDtoBaseTimeframeEnum n1w = _$backtestingCreateJobRequestDtoBaseTimeframeEnum_n1w;

  static Serializer<BacktestingCreateJobRequestDtoBaseTimeframeEnum> get serializer => _$backtestingCreateJobRequestDtoBaseTimeframeEnumSerializer;

  const BacktestingCreateJobRequestDtoBaseTimeframeEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobRequestDtoBaseTimeframeEnum> get values => _$backtestingCreateJobRequestDtoBaseTimeframeEnumValues;
  static BacktestingCreateJobRequestDtoBaseTimeframeEnum valueOf(String name) => _$backtestingCreateJobRequestDtoBaseTimeframeEnumValueOf(name);
}

class BacktestingCreateJobRequestDtoStateTimeframesEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'1m')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n1m = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n1m;
  @BuiltValueEnumConst(wireName: r'3m')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n3m = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n3m;
  @BuiltValueEnumConst(wireName: r'5m')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n5m = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n5m;
  @BuiltValueEnumConst(wireName: r'15m')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n15m = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n15m;
  @BuiltValueEnumConst(wireName: r'30m')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n30m = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n30m;
  @BuiltValueEnumConst(wireName: r'1h')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n1h = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n1h;
  @BuiltValueEnumConst(wireName: r'4h')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n4h = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n4h;
  @BuiltValueEnumConst(wireName: r'6h')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n6h = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n6h;
  @BuiltValueEnumConst(wireName: r'8h')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n8h = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n8h;
  @BuiltValueEnumConst(wireName: r'12h')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n12h = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n12h;
  @BuiltValueEnumConst(wireName: r'1d')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n1d = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n1d;
  @BuiltValueEnumConst(wireName: r'1w')
  static const BacktestingCreateJobRequestDtoStateTimeframesEnum n1w = _$backtestingCreateJobRequestDtoStateTimeframesEnum_n1w;

  static Serializer<BacktestingCreateJobRequestDtoStateTimeframesEnum> get serializer => _$backtestingCreateJobRequestDtoStateTimeframesEnumSerializer;

  const BacktestingCreateJobRequestDtoStateTimeframesEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobRequestDtoStateTimeframesEnum> get values => _$backtestingCreateJobRequestDtoStateTimeframesEnumValues;
  static BacktestingCreateJobRequestDtoStateTimeframesEnum valueOf(String name) => _$backtestingCreateJobRequestDtoStateTimeframesEnumValueOf(name);
}


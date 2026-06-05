//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_range_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_input_summary_dto.g.dart';

/// BacktestingCreateJobInputSummaryDto
///
/// Properties:
/// * [symbols] 
/// * [baseTimeframe] 
/// * [stateTimeframes] 
/// * [initialCash] 
/// * [leverage] 
/// * [marketType] 
/// * [dataRange] 
/// * [requestedRange] 
/// * [appliedRange] 
/// * [allowPartial] 
/// * [isPartial] 
/// * [strategyId] 
/// * [strategyInstanceId] 
/// * [strategyTemplateId] 
/// * [snapshotId] 
/// * [snapshotHash] 
/// * [scriptHash] 
/// * [specHash] 
@BuiltValue()
abstract class BacktestingCreateJobInputSummaryDto implements Built<BacktestingCreateJobInputSummaryDto, BacktestingCreateJobInputSummaryDtoBuilder> {
  @BuiltValueField(wireName: r'symbols')
  BuiltList<String> get symbols;

  @BuiltValueField(wireName: r'baseTimeframe')
  String get baseTimeframe;

  @BuiltValueField(wireName: r'stateTimeframes')
  BuiltList<String> get stateTimeframes;

  @BuiltValueField(wireName: r'initialCash')
  num get initialCash;

  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  @BuiltValueField(wireName: r'marketType')
  BacktestingCreateJobInputSummaryDtoMarketTypeEnum get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  @BuiltValueField(wireName: r'dataRange')
  BacktestingCreateJobRangeDto get dataRange;

  @BuiltValueField(wireName: r'requestedRange')
  BacktestingCreateJobRangeDto get requestedRange;

  @BuiltValueField(wireName: r'appliedRange')
  BacktestingCreateJobRangeDto? get appliedRange;

  @BuiltValueField(wireName: r'allowPartial')
  bool get allowPartial;

  @BuiltValueField(wireName: r'isPartial')
  bool get isPartial;

  @BuiltValueField(wireName: r'strategyId')
  String get strategyId;

  @BuiltValueField(wireName: r'strategyInstanceId')
  String? get strategyInstanceId;

  @BuiltValueField(wireName: r'strategyTemplateId')
  String? get strategyTemplateId;

  @BuiltValueField(wireName: r'snapshotId')
  String? get snapshotId;

  @BuiltValueField(wireName: r'snapshotHash')
  String? get snapshotHash;

  @BuiltValueField(wireName: r'scriptHash')
  String? get scriptHash;

  @BuiltValueField(wireName: r'specHash')
  String? get specHash;

  BacktestingCreateJobInputSummaryDto._();

  factory BacktestingCreateJobInputSummaryDto([void updates(BacktestingCreateJobInputSummaryDtoBuilder b)]) = _$BacktestingCreateJobInputSummaryDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobInputSummaryDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobInputSummaryDto> get serializer => _$BacktestingCreateJobInputSummaryDtoSerializer();
}

class _$BacktestingCreateJobInputSummaryDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobInputSummaryDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobInputSummaryDto, _$BacktestingCreateJobInputSummaryDto];

  @override
  final String wireName = r'BacktestingCreateJobInputSummaryDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobInputSummaryDto object, {
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
      specifiedType: const FullType(String),
    );
    yield r'stateTimeframes';
    yield serializers.serialize(
      object.stateTimeframes,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
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
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'marketType';
    yield serializers.serialize(
      object.marketType,
      specifiedType: const FullType(BacktestingCreateJobInputSummaryDtoMarketTypeEnum),
    );
    yield r'dataRange';
    yield serializers.serialize(
      object.dataRange,
      specifiedType: const FullType(BacktestingCreateJobRangeDto),
    );
    yield r'requestedRange';
    yield serializers.serialize(
      object.requestedRange,
      specifiedType: const FullType(BacktestingCreateJobRangeDto),
    );
    if (object.appliedRange != null) {
      yield r'appliedRange';
      yield serializers.serialize(
        object.appliedRange,
        specifiedType: const FullType(BacktestingCreateJobRangeDto),
      );
    }
    yield r'allowPartial';
    yield serializers.serialize(
      object.allowPartial,
      specifiedType: const FullType(bool),
    );
    yield r'isPartial';
    yield serializers.serialize(
      object.isPartial,
      specifiedType: const FullType(bool),
    );
    yield r'strategyId';
    yield serializers.serialize(
      object.strategyId,
      specifiedType: const FullType(String),
    );
    if (object.strategyInstanceId != null) {
      yield r'strategyInstanceId';
      yield serializers.serialize(
        object.strategyInstanceId,
        specifiedType: const FullType(String),
      );
    }
    if (object.strategyTemplateId != null) {
      yield r'strategyTemplateId';
      yield serializers.serialize(
        object.strategyTemplateId,
        specifiedType: const FullType(String),
      );
    }
    if (object.snapshotId != null) {
      yield r'snapshotId';
      yield serializers.serialize(
        object.snapshotId,
        specifiedType: const FullType(String),
      );
    }
    if (object.snapshotHash != null) {
      yield r'snapshotHash';
      yield serializers.serialize(
        object.snapshotHash,
        specifiedType: const FullType(String),
      );
    }
    if (object.scriptHash != null) {
      yield r'scriptHash';
      yield serializers.serialize(
        object.scriptHash,
        specifiedType: const FullType(String),
      );
    }
    if (object.specHash != null) {
      yield r'specHash';
      yield serializers.serialize(
        object.specHash,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobInputSummaryDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobInputSummaryDtoBuilder result,
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
            specifiedType: const FullType(String),
          ) as String;
          result.baseTimeframe = valueDes;
          break;
        case r'stateTimeframes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
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
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.leverage = valueDes;
          break;
        case r'marketType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobInputSummaryDtoMarketTypeEnum),
          ) as BacktestingCreateJobInputSummaryDtoMarketTypeEnum;
          result.marketType = valueDes;
          break;
        case r'dataRange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRangeDto),
          ) as BacktestingCreateJobRangeDto;
          result.dataRange.replace(valueDes);
          break;
        case r'requestedRange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRangeDto),
          ) as BacktestingCreateJobRangeDto;
          result.requestedRange.replace(valueDes);
          break;
        case r'appliedRange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRangeDto),
          ) as BacktestingCreateJobRangeDto;
          result.appliedRange.replace(valueDes);
          break;
        case r'allowPartial':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.allowPartial = valueDes;
          break;
        case r'isPartial':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isPartial = valueDes;
          break;
        case r'strategyId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.strategyId = valueDes;
          break;
        case r'strategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.strategyInstanceId = valueDes;
          break;
        case r'strategyTemplateId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.strategyTemplateId = valueDes;
          break;
        case r'snapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.snapshotId = valueDes;
          break;
        case r'snapshotHash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.snapshotHash = valueDes;
          break;
        case r'scriptHash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.scriptHash = valueDes;
          break;
        case r'specHash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.specHash = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobInputSummaryDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobInputSummaryDtoBuilder();
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

class BacktestingCreateJobInputSummaryDtoMarketTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'spot')
  static const BacktestingCreateJobInputSummaryDtoMarketTypeEnum spot = _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_spot;
  @BuiltValueEnumConst(wireName: r'perp')
  static const BacktestingCreateJobInputSummaryDtoMarketTypeEnum perp = _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_perp;

  static Serializer<BacktestingCreateJobInputSummaryDtoMarketTypeEnum> get serializer => _$backtestingCreateJobInputSummaryDtoMarketTypeEnumSerializer;

  const BacktestingCreateJobInputSummaryDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobInputSummaryDtoMarketTypeEnum> get values => _$backtestingCreateJobInputSummaryDtoMarketTypeEnumValues;
  static BacktestingCreateJobInputSummaryDtoMarketTypeEnum valueOf(String name) => _$backtestingCreateJobInputSummaryDtoMarketTypeEnumValueOf(name);
}


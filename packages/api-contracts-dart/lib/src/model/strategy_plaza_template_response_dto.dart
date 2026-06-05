//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_display_metrics_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_template_response_dto.g.dart';

/// StrategyPlazaTemplateResponseDto
///
/// Properties:
/// * [id] 
/// * [name] 
/// * [description] 
/// * [logicDescription] 
/// * [tags] 
/// * [riskLevel] 
/// * [scenario] 
/// * [exchange] 
/// * [environment] 
/// * [marketType] 
/// * [symbol] 
/// * [timeframe] 
/// * [positionPct] 
/// * [leverage] 
/// * [status] 
/// * [displayOrder] 
/// * [displayMetrics] 
@BuiltValue()
abstract class StrategyPlazaTemplateResponseDto implements Built<StrategyPlazaTemplateResponseDto, StrategyPlazaTemplateResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'description')
  String get description;

  @BuiltValueField(wireName: r'logicDescription')
  String get logicDescription;

  @BuiltValueField(wireName: r'tags')
  BuiltList<String> get tags;

  @BuiltValueField(wireName: r'riskLevel')
  StrategyPlazaTemplateResponseDtoRiskLevelEnum get riskLevel;
  // enum riskLevelEnum {  low,  medium,  high,  };

  @BuiltValueField(wireName: r'scenario')
  String get scenario;

  @BuiltValueField(wireName: r'exchange')
  StrategyPlazaTemplateResponseDtoExchangeEnum get exchange;
  // enum exchangeEnum {  okx,  };

  @BuiltValueField(wireName: r'environment')
  StrategyPlazaTemplateResponseDtoEnvironmentEnum get environment;
  // enum environmentEnum {  demo,  };

  @BuiltValueField(wireName: r'marketType')
  StrategyPlazaTemplateResponseDtoMarketTypeEnum get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  @BuiltValueField(wireName: r'timeframe')
  String get timeframe;

  @BuiltValueField(wireName: r'positionPct')
  num get positionPct;

  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  @BuiltValueField(wireName: r'status')
  StrategyPlazaTemplateResponseDtoStatusEnum get status;
  // enum statusEnum {  live,  hidden,  };

  @BuiltValueField(wireName: r'displayOrder')
  num get displayOrder;

  @BuiltValueField(wireName: r'displayMetrics')
  StrategyPlazaDisplayMetricsResponseDto get displayMetrics;

  StrategyPlazaTemplateResponseDto._();

  factory StrategyPlazaTemplateResponseDto([void updates(StrategyPlazaTemplateResponseDtoBuilder b)]) = _$StrategyPlazaTemplateResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaTemplateResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaTemplateResponseDto> get serializer => _$StrategyPlazaTemplateResponseDtoSerializer();
}

class _$StrategyPlazaTemplateResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaTemplateResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaTemplateResponseDto, _$StrategyPlazaTemplateResponseDto];

  @override
  final String wireName = r'StrategyPlazaTemplateResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaTemplateResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'description';
    yield serializers.serialize(
      object.description,
      specifiedType: const FullType(String),
    );
    yield r'logicDescription';
    yield serializers.serialize(
      object.logicDescription,
      specifiedType: const FullType(String),
    );
    yield r'tags';
    yield serializers.serialize(
      object.tags,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'riskLevel';
    yield serializers.serialize(
      object.riskLevel,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDtoRiskLevelEnum),
    );
    yield r'scenario';
    yield serializers.serialize(
      object.scenario,
      specifiedType: const FullType(String),
    );
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDtoExchangeEnum),
    );
    yield r'environment';
    yield serializers.serialize(
      object.environment,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDtoEnvironmentEnum),
    );
    yield r'marketType';
    yield serializers.serialize(
      object.marketType,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDtoMarketTypeEnum),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'timeframe';
    yield serializers.serialize(
      object.timeframe,
      specifiedType: const FullType(String),
    );
    yield r'positionPct';
    yield serializers.serialize(
      object.positionPct,
      specifiedType: const FullType(num),
    );
    if (object.leverage != null) {
      yield r'leverage';
      yield serializers.serialize(
        object.leverage,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(StrategyPlazaTemplateResponseDtoStatusEnum),
    );
    yield r'displayOrder';
    yield serializers.serialize(
      object.displayOrder,
      specifiedType: const FullType(num),
    );
    yield r'displayMetrics';
    yield serializers.serialize(
      object.displayMetrics,
      specifiedType: const FullType(StrategyPlazaDisplayMetricsResponseDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaTemplateResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaTemplateResponseDtoBuilder result,
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
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
          break;
        case r'logicDescription':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.logicDescription = valueDes;
          break;
        case r'tags':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.tags.replace(valueDes);
          break;
        case r'riskLevel':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDtoRiskLevelEnum),
          ) as StrategyPlazaTemplateResponseDtoRiskLevelEnum;
          result.riskLevel = valueDes;
          break;
        case r'scenario':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.scenario = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDtoExchangeEnum),
          ) as StrategyPlazaTemplateResponseDtoExchangeEnum;
          result.exchange = valueDes;
          break;
        case r'environment':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDtoEnvironmentEnum),
          ) as StrategyPlazaTemplateResponseDtoEnvironmentEnum;
          result.environment = valueDes;
          break;
        case r'marketType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDtoMarketTypeEnum),
          ) as StrategyPlazaTemplateResponseDtoMarketTypeEnum;
          result.marketType = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'timeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timeframe = valueDes;
          break;
        case r'positionPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionPct = valueDes;
          break;
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.leverage = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaTemplateResponseDtoStatusEnum),
          ) as StrategyPlazaTemplateResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'displayOrder':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.displayOrder = valueDes;
          break;
        case r'displayMetrics':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaDisplayMetricsResponseDto),
          ) as StrategyPlazaDisplayMetricsResponseDto;
          result.displayMetrics.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaTemplateResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaTemplateResponseDtoBuilder();
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

class StrategyPlazaTemplateResponseDtoRiskLevelEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'low')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum low = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_low;
  @BuiltValueEnumConst(wireName: r'medium')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum medium = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_medium;
  @BuiltValueEnumConst(wireName: r'high')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum high = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_high;

  static Serializer<StrategyPlazaTemplateResponseDtoRiskLevelEnum> get serializer => _$strategyPlazaTemplateResponseDtoRiskLevelEnumSerializer;

  const StrategyPlazaTemplateResponseDtoRiskLevelEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoRiskLevelEnum> get values => _$strategyPlazaTemplateResponseDtoRiskLevelEnumValues;
  static StrategyPlazaTemplateResponseDtoRiskLevelEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoRiskLevelEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoExchangeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'okx')
  static const StrategyPlazaTemplateResponseDtoExchangeEnum okx = _$strategyPlazaTemplateResponseDtoExchangeEnum_okx;

  static Serializer<StrategyPlazaTemplateResponseDtoExchangeEnum> get serializer => _$strategyPlazaTemplateResponseDtoExchangeEnumSerializer;

  const StrategyPlazaTemplateResponseDtoExchangeEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoExchangeEnum> get values => _$strategyPlazaTemplateResponseDtoExchangeEnumValues;
  static StrategyPlazaTemplateResponseDtoExchangeEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoExchangeEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoEnvironmentEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'demo')
  static const StrategyPlazaTemplateResponseDtoEnvironmentEnum demo = _$strategyPlazaTemplateResponseDtoEnvironmentEnum_demo;

  static Serializer<StrategyPlazaTemplateResponseDtoEnvironmentEnum> get serializer => _$strategyPlazaTemplateResponseDtoEnvironmentEnumSerializer;

  const StrategyPlazaTemplateResponseDtoEnvironmentEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoEnvironmentEnum> get values => _$strategyPlazaTemplateResponseDtoEnvironmentEnumValues;
  static StrategyPlazaTemplateResponseDtoEnvironmentEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoEnvironmentEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoMarketTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'spot')
  static const StrategyPlazaTemplateResponseDtoMarketTypeEnum spot = _$strategyPlazaTemplateResponseDtoMarketTypeEnum_spot;
  @BuiltValueEnumConst(wireName: r'perp')
  static const StrategyPlazaTemplateResponseDtoMarketTypeEnum perp = _$strategyPlazaTemplateResponseDtoMarketTypeEnum_perp;

  static Serializer<StrategyPlazaTemplateResponseDtoMarketTypeEnum> get serializer => _$strategyPlazaTemplateResponseDtoMarketTypeEnumSerializer;

  const StrategyPlazaTemplateResponseDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoMarketTypeEnum> get values => _$strategyPlazaTemplateResponseDtoMarketTypeEnumValues;
  static StrategyPlazaTemplateResponseDtoMarketTypeEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoMarketTypeEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'live')
  static const StrategyPlazaTemplateResponseDtoStatusEnum live = _$strategyPlazaTemplateResponseDtoStatusEnum_live;
  @BuiltValueEnumConst(wireName: r'hidden')
  static const StrategyPlazaTemplateResponseDtoStatusEnum hidden = _$strategyPlazaTemplateResponseDtoStatusEnum_hidden;

  static Serializer<StrategyPlazaTemplateResponseDtoStatusEnum> get serializer => _$strategyPlazaTemplateResponseDtoStatusEnumSerializer;

  const StrategyPlazaTemplateResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoStatusEnum> get values => _$strategyPlazaTemplateResponseDtoStatusEnumValues;
  static StrategyPlazaTemplateResponseDtoStatusEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoStatusEnumValueOf(name);
}


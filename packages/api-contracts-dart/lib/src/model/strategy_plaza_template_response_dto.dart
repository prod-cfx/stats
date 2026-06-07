//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/strategy_plaza_signal_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_display_metrics_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_template_response_dto.g.dart';

/// StrategyPlazaTemplateResponseDto
///
/// Properties:
/// * [id] - 策略模板 ID
/// * [name] - 策略模板名称
/// * [description] - 策略描述
/// * [logicDescription] - 策略逻辑说明
/// * [tags] - 标签列表
/// * [riskLevel] - 风险等级
/// * [scenario] - 适用场景
/// * [exchange] - 交易所
/// * [environment] - 运行环境
/// * [marketType] - 市场类型
/// * [symbol] - 交易对符号
/// * [timeframe] - K 线周期
/// * [positionPct] - 仓位百分比（%）
/// * [leverage] - 杠杆倍数（现货为 null）
/// * [status] - 展示状态
/// * [displayOrder] - 展示排序值
/// * [displayMetrics] - 展示用回测指标
/// * [sparkline] - 列表/hero 迷你曲线
/// * [params] - 策略参数展示值
/// * [signals] - 策略信号列表
/// * [equityCurve] - 权益曲线
@BuiltValue()
abstract class StrategyPlazaTemplateResponseDto implements Built<StrategyPlazaTemplateResponseDto, StrategyPlazaTemplateResponseDtoBuilder> {
  /// 策略模板 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 策略模板名称
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 策略描述
  @BuiltValueField(wireName: r'description')
  String get description;

  /// 策略逻辑说明
  @BuiltValueField(wireName: r'logicDescription')
  String get logicDescription;

  /// 标签列表
  @BuiltValueField(wireName: r'tags')
  BuiltList<String> get tags;

  /// 风险等级
  @BuiltValueField(wireName: r'riskLevel')
  StrategyPlazaTemplateResponseDtoRiskLevelEnum get riskLevel;
  // enum riskLevelEnum {  low,  medium,  high,  };

  /// 适用场景
  @BuiltValueField(wireName: r'scenario')
  String get scenario;

  /// 交易所
  @BuiltValueField(wireName: r'exchange')
  StrategyPlazaTemplateResponseDtoExchangeEnum get exchange;
  // enum exchangeEnum {  okx,  };

  /// 运行环境
  @BuiltValueField(wireName: r'environment')
  StrategyPlazaTemplateResponseDtoEnvironmentEnum get environment;
  // enum environmentEnum {  demo,  };

  /// 市场类型
  @BuiltValueField(wireName: r'marketType')
  StrategyPlazaTemplateResponseDtoMarketTypeEnum get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  /// 交易对符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// K 线周期
  @BuiltValueField(wireName: r'timeframe')
  String get timeframe;

  /// 仓位百分比（%）
  @BuiltValueField(wireName: r'positionPct')
  num get positionPct;

  /// 杠杆倍数（现货为 null）
  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  /// 展示状态
  @BuiltValueField(wireName: r'status')
  StrategyPlazaTemplateResponseDtoStatusEnum get status;
  // enum statusEnum {  live,  hidden,  };

  /// 展示排序值
  @BuiltValueField(wireName: r'displayOrder')
  num get displayOrder;

  /// 展示用回测指标
  @BuiltValueField(wireName: r'displayMetrics')
  StrategyPlazaDisplayMetricsResponseDto get displayMetrics;

  /// 列表/hero 迷你曲线
  @BuiltValueField(wireName: r'sparkline')
  BuiltList<num>? get sparkline;

  /// 策略参数展示值
  @BuiltValueField(wireName: r'params')
  BuiltMap<String, num>? get params;

  /// 策略信号列表
  @BuiltValueField(wireName: r'signals')
  BuiltList<StrategyPlazaSignalResponseDto>? get signals;

  /// 权益曲线
  @BuiltValueField(wireName: r'equityCurve')
  BuiltList<num>? get equityCurve;

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
    if (object.sparkline != null) {
      yield r'sparkline';
      yield serializers.serialize(
        object.sparkline,
        specifiedType: const FullType(BuiltList, [FullType(num)]),
      );
    }
    if (object.params != null) {
      yield r'params';
      yield serializers.serialize(
        object.params,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType(num)]),
      );
    }
    if (object.signals != null) {
      yield r'signals';
      yield serializers.serialize(
        object.signals,
        specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaSignalResponseDto)]),
      );
    }
    if (object.equityCurve != null) {
      yield r'equityCurve';
      yield serializers.serialize(
        object.equityCurve,
        specifiedType: const FullType(BuiltList, [FullType(num)]),
      );
    }
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
        case r'sparkline':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(num)]),
          ) as BuiltList<num>;
          result.sparkline.replace(valueDes);
          break;
        case r'params':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType(num)]),
          ) as BuiltMap<String, num>;
          result.params.replace(valueDes);
          break;
        case r'signals':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaSignalResponseDto)]),
          ) as BuiltList<StrategyPlazaSignalResponseDto>;
          result.signals.replace(valueDes);
          break;
        case r'equityCurve':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(num)]),
          ) as BuiltList<num>;
          result.equityCurve.replace(valueDes);
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

  /// 风险等级
  @BuiltValueEnumConst(wireName: r'low')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum low = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_low;
  /// 风险等级
  @BuiltValueEnumConst(wireName: r'medium')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum medium = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_medium;
  /// 风险等级
  @BuiltValueEnumConst(wireName: r'high')
  static const StrategyPlazaTemplateResponseDtoRiskLevelEnum high = _$strategyPlazaTemplateResponseDtoRiskLevelEnum_high;

  static Serializer<StrategyPlazaTemplateResponseDtoRiskLevelEnum> get serializer => _$strategyPlazaTemplateResponseDtoRiskLevelEnumSerializer;

  const StrategyPlazaTemplateResponseDtoRiskLevelEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoRiskLevelEnum> get values => _$strategyPlazaTemplateResponseDtoRiskLevelEnumValues;
  static StrategyPlazaTemplateResponseDtoRiskLevelEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoRiskLevelEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoExchangeEnum extends EnumClass {

  /// 交易所
  @BuiltValueEnumConst(wireName: r'okx')
  static const StrategyPlazaTemplateResponseDtoExchangeEnum okx = _$strategyPlazaTemplateResponseDtoExchangeEnum_okx;

  static Serializer<StrategyPlazaTemplateResponseDtoExchangeEnum> get serializer => _$strategyPlazaTemplateResponseDtoExchangeEnumSerializer;

  const StrategyPlazaTemplateResponseDtoExchangeEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoExchangeEnum> get values => _$strategyPlazaTemplateResponseDtoExchangeEnumValues;
  static StrategyPlazaTemplateResponseDtoExchangeEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoExchangeEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoEnvironmentEnum extends EnumClass {

  /// 运行环境
  @BuiltValueEnumConst(wireName: r'demo')
  static const StrategyPlazaTemplateResponseDtoEnvironmentEnum demo = _$strategyPlazaTemplateResponseDtoEnvironmentEnum_demo;

  static Serializer<StrategyPlazaTemplateResponseDtoEnvironmentEnum> get serializer => _$strategyPlazaTemplateResponseDtoEnvironmentEnumSerializer;

  const StrategyPlazaTemplateResponseDtoEnvironmentEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoEnvironmentEnum> get values => _$strategyPlazaTemplateResponseDtoEnvironmentEnumValues;
  static StrategyPlazaTemplateResponseDtoEnvironmentEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoEnvironmentEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoMarketTypeEnum extends EnumClass {

  /// 市场类型
  @BuiltValueEnumConst(wireName: r'spot')
  static const StrategyPlazaTemplateResponseDtoMarketTypeEnum spot = _$strategyPlazaTemplateResponseDtoMarketTypeEnum_spot;
  /// 市场类型
  @BuiltValueEnumConst(wireName: r'perp')
  static const StrategyPlazaTemplateResponseDtoMarketTypeEnum perp = _$strategyPlazaTemplateResponseDtoMarketTypeEnum_perp;

  static Serializer<StrategyPlazaTemplateResponseDtoMarketTypeEnum> get serializer => _$strategyPlazaTemplateResponseDtoMarketTypeEnumSerializer;

  const StrategyPlazaTemplateResponseDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoMarketTypeEnum> get values => _$strategyPlazaTemplateResponseDtoMarketTypeEnumValues;
  static StrategyPlazaTemplateResponseDtoMarketTypeEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoMarketTypeEnumValueOf(name);
}

class StrategyPlazaTemplateResponseDtoStatusEnum extends EnumClass {

  /// 展示状态
  @BuiltValueEnumConst(wireName: r'live')
  static const StrategyPlazaTemplateResponseDtoStatusEnum live = _$strategyPlazaTemplateResponseDtoStatusEnum_live;
  /// 展示状态
  @BuiltValueEnumConst(wireName: r'hidden')
  static const StrategyPlazaTemplateResponseDtoStatusEnum hidden = _$strategyPlazaTemplateResponseDtoStatusEnum_hidden;

  static Serializer<StrategyPlazaTemplateResponseDtoStatusEnum> get serializer => _$strategyPlazaTemplateResponseDtoStatusEnumSerializer;

  const StrategyPlazaTemplateResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaTemplateResponseDtoStatusEnum> get values => _$strategyPlazaTemplateResponseDtoStatusEnumValues;
  static StrategyPlazaTemplateResponseDtoStatusEnum valueOf(String name) => _$strategyPlazaTemplateResponseDtoStatusEnumValueOf(name);
}


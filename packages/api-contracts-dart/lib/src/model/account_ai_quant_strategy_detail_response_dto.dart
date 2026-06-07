//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_strategy_detail_response_dto.g.dart';

/// AccountAiQuantStrategyDetailResponseDto
///
/// Properties:
/// * [id] - 策略 ID
/// * [name] - 策略名称
/// * [status] - 策略运行状态
/// * [exchange] 
/// * [symbol] 
/// * [timeframe] 
/// * [positionPct] 
/// * [paramSchema] 
/// * [paramValues] 
/// * [schemaVersion] 
/// * [isSubscribed] - 当前用户是否已订阅该策略
/// * [metrics] - 策略展示指标集合
/// * [updatedAt] - 更新时间（ISO 8601）
/// * [totalPnl] 
/// * [todayPnl] 
/// * [equitySeries] 
/// * [snapshot] 
/// * [timeline] 
/// * [accountOverview] 
/// * [positionOverview] 
/// * [latestOrders] 
/// * [deployment] 
@BuiltValue()
abstract class AccountAiQuantStrategyDetailResponseDto implements Built<AccountAiQuantStrategyDetailResponseDto, AccountAiQuantStrategyDetailResponseDtoBuilder> {
  /// 策略 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 策略名称
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 策略运行状态
  @BuiltValueField(wireName: r'status')
  AccountAiQuantStrategyDetailResponseDtoStatusEnum get status;
  // enum statusEnum {  running,  stopped,  draft,  };

  @BuiltValueField(wireName: r'exchange')
  String? get exchange;

  @BuiltValueField(wireName: r'symbol')
  String? get symbol;

  @BuiltValueField(wireName: r'timeframe')
  String? get timeframe;

  @BuiltValueField(wireName: r'positionPct')
  num? get positionPct;

  @BuiltValueField(wireName: r'paramSchema')
  BuiltMap<String, JsonObject?>? get paramSchema;

  @BuiltValueField(wireName: r'paramValues')
  BuiltMap<String, JsonObject?>? get paramValues;

  @BuiltValueField(wireName: r'schemaVersion')
  String? get schemaVersion;

  /// 当前用户是否已订阅该策略
  @BuiltValueField(wireName: r'isSubscribed')
  bool get isSubscribed;

  /// 策略展示指标集合
  @BuiltValueField(wireName: r'metrics')
  BuiltMap<String, JsonObject?> get metrics;

  /// 更新时间（ISO 8601）
  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  @BuiltValueField(wireName: r'totalPnl')
  num? get totalPnl;

  @BuiltValueField(wireName: r'todayPnl')
  num? get todayPnl;

  @BuiltValueField(wireName: r'equitySeries')
  BuiltList<BuiltMap<String, JsonObject?>> get equitySeries;

  @BuiltValueField(wireName: r'snapshot')
  BuiltMap<String, JsonObject?> get snapshot;

  @BuiltValueField(wireName: r'timeline')
  BuiltList<BuiltMap<String, JsonObject?>> get timeline;

  @BuiltValueField(wireName: r'accountOverview')
  BuiltMap<String, JsonObject?> get accountOverview;

  @BuiltValueField(wireName: r'positionOverview')
  BuiltMap<String, JsonObject?> get positionOverview;

  @BuiltValueField(wireName: r'latestOrders')
  BuiltList<BuiltMap<String, JsonObject?>> get latestOrders;

  @BuiltValueField(wireName: r'deployment')
  BuiltMap<String, JsonObject?>? get deployment;

  AccountAiQuantStrategyDetailResponseDto._();

  factory AccountAiQuantStrategyDetailResponseDto([void updates(AccountAiQuantStrategyDetailResponseDtoBuilder b)]) = _$AccountAiQuantStrategyDetailResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantStrategyDetailResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantStrategyDetailResponseDto> get serializer => _$AccountAiQuantStrategyDetailResponseDtoSerializer();
}

class _$AccountAiQuantStrategyDetailResponseDtoSerializer implements PrimitiveSerializer<AccountAiQuantStrategyDetailResponseDto> {
  @override
  final Iterable<Type> types = const [AccountAiQuantStrategyDetailResponseDto, _$AccountAiQuantStrategyDetailResponseDto];

  @override
  final String wireName = r'AccountAiQuantStrategyDetailResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantStrategyDetailResponseDto object, {
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
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDtoStatusEnum),
    );
    if (object.exchange != null) {
      yield r'exchange';
      yield serializers.serialize(
        object.exchange,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.symbol != null) {
      yield r'symbol';
      yield serializers.serialize(
        object.symbol,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.timeframe != null) {
      yield r'timeframe';
      yield serializers.serialize(
        object.timeframe,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.positionPct != null) {
      yield r'positionPct';
      yield serializers.serialize(
        object.positionPct,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.paramSchema != null) {
      yield r'paramSchema';
      yield serializers.serialize(
        object.paramSchema,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.paramValues != null) {
      yield r'paramValues';
      yield serializers.serialize(
        object.paramValues,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.schemaVersion != null) {
      yield r'schemaVersion';
      yield serializers.serialize(
        object.schemaVersion,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'isSubscribed';
    yield serializers.serialize(
      object.isSubscribed,
      specifiedType: const FullType(bool),
    );
    yield r'metrics';
    yield serializers.serialize(
      object.metrics,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(String),
    );
    if (object.totalPnl != null) {
      yield r'totalPnl';
      yield serializers.serialize(
        object.totalPnl,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.todayPnl != null) {
      yield r'todayPnl';
      yield serializers.serialize(
        object.todayPnl,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'equitySeries';
    yield serializers.serialize(
      object.equitySeries,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    yield r'snapshot';
    yield serializers.serialize(
      object.snapshot,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'timeline';
    yield serializers.serialize(
      object.timeline,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    yield r'accountOverview';
    yield serializers.serialize(
      object.accountOverview,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'positionOverview';
    yield serializers.serialize(
      object.positionOverview,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'latestOrders';
    yield serializers.serialize(
      object.latestOrders,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    if (object.deployment != null) {
      yield r'deployment';
      yield serializers.serialize(
        object.deployment,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantStrategyDetailResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantStrategyDetailResponseDtoBuilder result,
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
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AccountAiQuantStrategyDetailResponseDtoStatusEnum),
          ) as AccountAiQuantStrategyDetailResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.exchange = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.symbol = valueDes;
          break;
        case r'timeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.timeframe = valueDes;
          break;
        case r'positionPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.positionPct = valueDes;
          break;
        case r'paramSchema':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.paramSchema.replace(valueDes);
          break;
        case r'paramValues':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.paramValues.replace(valueDes);
          break;
        case r'schemaVersion':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.schemaVersion = valueDes;
          break;
        case r'isSubscribed':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isSubscribed = valueDes;
          break;
        case r'metrics':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.metrics.replace(valueDes);
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.updatedAt = valueDes;
          break;
        case r'totalPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.totalPnl = valueDes;
          break;
        case r'todayPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.todayPnl = valueDes;
          break;
        case r'equitySeries':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.equitySeries.replace(valueDes);
          break;
        case r'snapshot':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.snapshot.replace(valueDes);
          break;
        case r'timeline':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.timeline.replace(valueDes);
          break;
        case r'accountOverview':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.accountOverview.replace(valueDes);
          break;
        case r'positionOverview':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.positionOverview.replace(valueDes);
          break;
        case r'latestOrders':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.latestOrders.replace(valueDes);
          break;
        case r'deployment':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.deployment.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountAiQuantStrategyDetailResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantStrategyDetailResponseDtoBuilder();
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

class AccountAiQuantStrategyDetailResponseDtoStatusEnum extends EnumClass {

  /// 策略运行状态
  @BuiltValueEnumConst(wireName: r'running')
  static const AccountAiQuantStrategyDetailResponseDtoStatusEnum running = _$accountAiQuantStrategyDetailResponseDtoStatusEnum_running;
  /// 策略运行状态
  @BuiltValueEnumConst(wireName: r'stopped')
  static const AccountAiQuantStrategyDetailResponseDtoStatusEnum stopped = _$accountAiQuantStrategyDetailResponseDtoStatusEnum_stopped;
  /// 策略运行状态
  @BuiltValueEnumConst(wireName: r'draft')
  static const AccountAiQuantStrategyDetailResponseDtoStatusEnum draft = _$accountAiQuantStrategyDetailResponseDtoStatusEnum_draft;

  static Serializer<AccountAiQuantStrategyDetailResponseDtoStatusEnum> get serializer => _$accountAiQuantStrategyDetailResponseDtoStatusEnumSerializer;

  const AccountAiQuantStrategyDetailResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<AccountAiQuantStrategyDetailResponseDtoStatusEnum> get values => _$accountAiQuantStrategyDetailResponseDtoStatusEnumValues;
  static AccountAiQuantStrategyDetailResponseDtoStatusEnum valueOf(String name) => _$accountAiQuantStrategyDetailResponseDtoStatusEnumValueOf(name);
}


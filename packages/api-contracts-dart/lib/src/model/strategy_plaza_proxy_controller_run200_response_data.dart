//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/account_ai_quant_strategy_detail_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_run_existing_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';
import 'package:one_of/one_of.dart';

part 'strategy_plaza_proxy_controller_run200_response_data.g.dart';

/// StrategyPlazaProxyControllerRun200ResponseData
///
/// Properties:
/// * [id] 
/// * [name] 
/// * [status] 
/// * [exchange] 
/// * [symbol] 
/// * [timeframe] 
/// * [positionPct] 
/// * [paramSchema] 
/// * [paramValues] 
/// * [schemaVersion] 
/// * [isSubscribed] 
/// * [metrics] 
/// * [updatedAt] 
/// * [totalPnl] 
/// * [todayPnl] 
/// * [equitySeries] 
/// * [snapshot] 
/// * [timeline] 
/// * [accountOverview] 
/// * [positionOverview] 
/// * [latestOrders] 
/// * [deployment] 
/// * [result] 
/// * [strategy] 
@BuiltValue()
abstract class StrategyPlazaProxyControllerRun200ResponseData implements Built<StrategyPlazaProxyControllerRun200ResponseData, StrategyPlazaProxyControllerRun200ResponseDataBuilder> {
  /// One Of [AccountAiQuantStrategyDetailResponseDto], [StrategyPlazaRunExistingResponseDto]
  OneOf get oneOf;

  StrategyPlazaProxyControllerRun200ResponseData._();

  factory StrategyPlazaProxyControllerRun200ResponseData([void updates(StrategyPlazaProxyControllerRun200ResponseDataBuilder b)]) = _$StrategyPlazaProxyControllerRun200ResponseData;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaProxyControllerRun200ResponseDataBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaProxyControllerRun200ResponseData> get serializer => _$StrategyPlazaProxyControllerRun200ResponseDataSerializer();
}

class _$StrategyPlazaProxyControllerRun200ResponseDataSerializer implements PrimitiveSerializer<StrategyPlazaProxyControllerRun200ResponseData> {
  @override
  final Iterable<Type> types = const [StrategyPlazaProxyControllerRun200ResponseData, _$StrategyPlazaProxyControllerRun200ResponseData];

  @override
  final String wireName = r'StrategyPlazaProxyControllerRun200ResponseData';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaProxyControllerRun200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaProxyControllerRun200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final oneOf = object.oneOf;
    return serializers.serialize(oneOf.value, specifiedType: FullType(oneOf.valueType))!;
  }

  @override
  StrategyPlazaProxyControllerRun200ResponseData deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaProxyControllerRun200ResponseDataBuilder();
    Object? oneOfDataSrc;
    final targetType = const FullType(OneOf, [FullType(AccountAiQuantStrategyDetailResponseDto), FullType(StrategyPlazaRunExistingResponseDto), ]);
    oneOfDataSrc = serialized;
    result.oneOf = serializers.deserialize(oneOfDataSrc, specifiedType: targetType) as OneOf;
    return result.build();
  }
}

class StrategyPlazaProxyControllerRun200ResponseDataStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'running')
  static const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum running = _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_running;
  @BuiltValueEnumConst(wireName: r'stopped')
  static const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum stopped = _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_stopped;
  @BuiltValueEnumConst(wireName: r'draft')
  static const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum draft = _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_draft;

  static Serializer<StrategyPlazaProxyControllerRun200ResponseDataStatusEnum> get serializer => _$strategyPlazaProxyControllerRun200ResponseDataStatusEnumSerializer;

  const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataStatusEnum> get values => _$strategyPlazaProxyControllerRun200ResponseDataStatusEnumValues;
  static StrategyPlazaProxyControllerRun200ResponseDataStatusEnum valueOf(String name) => _$strategyPlazaProxyControllerRun200ResponseDataStatusEnumValueOf(name);
}

class StrategyPlazaProxyControllerRun200ResponseDataResultEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'existing')
  static const StrategyPlazaProxyControllerRun200ResponseDataResultEnum existing = _$strategyPlazaProxyControllerRun200ResponseDataResultEnum_existing;

  static Serializer<StrategyPlazaProxyControllerRun200ResponseDataResultEnum> get serializer => _$strategyPlazaProxyControllerRun200ResponseDataResultEnumSerializer;

  const StrategyPlazaProxyControllerRun200ResponseDataResultEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataResultEnum> get values => _$strategyPlazaProxyControllerRun200ResponseDataResultEnumValues;
  static StrategyPlazaProxyControllerRun200ResponseDataResultEnum valueOf(String name) => _$strategyPlazaProxyControllerRun200ResponseDataResultEnumValueOf(name);
}


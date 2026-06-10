//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_official_backtest_confidence_response_dto.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_official_backtest_equity_point_response_dto.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_official_backtest_trade_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:backend_api_contracts/src/model/strategy_plaza_official_backtest_metrics_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_official_backtest_response_dto.g.dart';

/// StrategyPlazaOfficialBacktestResponseDto
///
/// Properties:
/// * [generatedAt] 
/// * [backtestFrom] 
/// * [backtestTo] 
/// * [source_] 
/// * [dataSource] 
/// * [eventDataSources] 
/// * [candleCount] 
/// * [metrics] 
/// * [equityCurve] 
/// * [trades] 
/// * [confidence] 
/// * [disclaimer] 
@BuiltValue()
abstract class StrategyPlazaOfficialBacktestResponseDto implements Built<StrategyPlazaOfficialBacktestResponseDto, StrategyPlazaOfficialBacktestResponseDtoBuilder> {
  @BuiltValueField(wireName: r'generatedAt')
  String get generatedAt;

  @BuiltValueField(wireName: r'backtestFrom')
  num get backtestFrom;

  @BuiltValueField(wireName: r'backtestTo')
  num get backtestTo;

  @BuiltValueField(wireName: r'source')
  String get source_;

  @BuiltValueField(wireName: r'dataSource')
  BuiltMap<String, JsonObject?> get dataSource;

  @BuiltValueField(wireName: r'eventDataSources')
  BuiltList<JsonObject>? get eventDataSources;

  @BuiltValueField(wireName: r'candleCount')
  num get candleCount;

  @BuiltValueField(wireName: r'metrics')
  StrategyPlazaOfficialBacktestMetricsResponseDto get metrics;

  @BuiltValueField(wireName: r'equityCurve')
  BuiltList<StrategyPlazaOfficialBacktestEquityPointResponseDto> get equityCurve;

  @BuiltValueField(wireName: r'trades')
  BuiltList<StrategyPlazaOfficialBacktestTradeResponseDto> get trades;

  @BuiltValueField(wireName: r'confidence')
  StrategyPlazaOfficialBacktestConfidenceResponseDto get confidence;

  @BuiltValueField(wireName: r'disclaimer')
  String get disclaimer;

  StrategyPlazaOfficialBacktestResponseDto._();

  factory StrategyPlazaOfficialBacktestResponseDto([void updates(StrategyPlazaOfficialBacktestResponseDtoBuilder b)]) = _$StrategyPlazaOfficialBacktestResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaOfficialBacktestResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaOfficialBacktestResponseDto> get serializer => _$StrategyPlazaOfficialBacktestResponseDtoSerializer();
}

class _$StrategyPlazaOfficialBacktestResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaOfficialBacktestResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaOfficialBacktestResponseDto, _$StrategyPlazaOfficialBacktestResponseDto];

  @override
  final String wireName = r'StrategyPlazaOfficialBacktestResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaOfficialBacktestResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'generatedAt';
    yield serializers.serialize(
      object.generatedAt,
      specifiedType: const FullType(String),
    );
    yield r'backtestFrom';
    yield serializers.serialize(
      object.backtestFrom,
      specifiedType: const FullType(num),
    );
    yield r'backtestTo';
    yield serializers.serialize(
      object.backtestTo,
      specifiedType: const FullType(num),
    );
    yield r'source';
    yield serializers.serialize(
      object.source_,
      specifiedType: const FullType(String),
    );
    yield r'dataSource';
    yield serializers.serialize(
      object.dataSource,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    if (object.eventDataSources != null) {
      yield r'eventDataSources';
      yield serializers.serialize(
        object.eventDataSources,
        specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
      );
    }
    yield r'candleCount';
    yield serializers.serialize(
      object.candleCount,
      specifiedType: const FullType(num),
    );
    yield r'metrics';
    yield serializers.serialize(
      object.metrics,
      specifiedType: const FullType(StrategyPlazaOfficialBacktestMetricsResponseDto),
    );
    yield r'equityCurve';
    yield serializers.serialize(
      object.equityCurve,
      specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaOfficialBacktestEquityPointResponseDto)]),
    );
    yield r'trades';
    yield serializers.serialize(
      object.trades,
      specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaOfficialBacktestTradeResponseDto)]),
    );
    yield r'confidence';
    yield serializers.serialize(
      object.confidence,
      specifiedType: const FullType(StrategyPlazaOfficialBacktestConfidenceResponseDto),
    );
    yield r'disclaimer';
    yield serializers.serialize(
      object.disclaimer,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaOfficialBacktestResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'generatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.generatedAt = valueDes;
          break;
        case r'backtestFrom':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.backtestFrom = valueDes;
          break;
        case r'backtestTo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.backtestTo = valueDes;
          break;
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.source_ = valueDes;
          break;
        case r'dataSource':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.dataSource.replace(valueDes);
          break;
        case r'eventDataSources':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
          ) as BuiltList<JsonObject>;
          result.eventDataSources.replace(valueDes);
          break;
        case r'candleCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.candleCount = valueDes;
          break;
        case r'metrics':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaOfficialBacktestMetricsResponseDto),
          ) as StrategyPlazaOfficialBacktestMetricsResponseDto;
          result.metrics.replace(valueDes);
          break;
        case r'equityCurve':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaOfficialBacktestEquityPointResponseDto)]),
          ) as BuiltList<StrategyPlazaOfficialBacktestEquityPointResponseDto>;
          result.equityCurve.replace(valueDes);
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(StrategyPlazaOfficialBacktestTradeResponseDto)]),
          ) as BuiltList<StrategyPlazaOfficialBacktestTradeResponseDto>;
          result.trades.replace(valueDes);
          break;
        case r'confidence':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaOfficialBacktestConfidenceResponseDto),
          ) as StrategyPlazaOfficialBacktestConfidenceResponseDto;
          result.confidence.replace(valueDes);
          break;
        case r'disclaimer':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.disclaimer = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaOfficialBacktestResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaOfficialBacktestResponseDtoBuilder();
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


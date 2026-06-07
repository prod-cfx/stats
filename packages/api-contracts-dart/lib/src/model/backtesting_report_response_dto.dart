//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_report_response_dto.g.dart';

/// BacktestingReportResponseDto
///
/// Properties:
/// * [summary] 
/// * [equityCurve] 
/// * [trades] 
/// * [markers] 
/// * [bySymbol] 
/// * [openPositions] 
/// * [pendingSignals] 
@BuiltValue()
abstract class BacktestingReportResponseDto implements Built<BacktestingReportResponseDto, BacktestingReportResponseDtoBuilder> {
  @BuiltValueField(wireName: r'summary')
  BuiltMap<String, JsonObject?> get summary;

  @BuiltValueField(wireName: r'equityCurve')
  BuiltList<BuiltMap<String, JsonObject?>> get equityCurve;

  @BuiltValueField(wireName: r'trades')
  BuiltList<BuiltMap<String, JsonObject?>> get trades;

  @BuiltValueField(wireName: r'markers')
  BuiltList<BuiltMap<String, JsonObject?>> get markers;

  @BuiltValueField(wireName: r'bySymbol')
  BuiltList<BuiltMap<String, JsonObject?>> get bySymbol;

  @BuiltValueField(wireName: r'openPositions')
  BuiltList<BuiltMap<String, JsonObject?>>? get openPositions;

  @BuiltValueField(wireName: r'pendingSignals')
  BuiltList<BuiltMap<String, JsonObject?>>? get pendingSignals;

  BacktestingReportResponseDto._();

  factory BacktestingReportResponseDto([void updates(BacktestingReportResponseDtoBuilder b)]) = _$BacktestingReportResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingReportResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingReportResponseDto> get serializer => _$BacktestingReportResponseDtoSerializer();
}

class _$BacktestingReportResponseDtoSerializer implements PrimitiveSerializer<BacktestingReportResponseDto> {
  @override
  final Iterable<Type> types = const [BacktestingReportResponseDto, _$BacktestingReportResponseDto];

  @override
  final String wireName = r'BacktestingReportResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingReportResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'summary';
    yield serializers.serialize(
      object.summary,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'equityCurve';
    yield serializers.serialize(
      object.equityCurve,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    yield r'trades';
    yield serializers.serialize(
      object.trades,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    yield r'markers';
    yield serializers.serialize(
      object.markers,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    yield r'bySymbol';
    yield serializers.serialize(
      object.bySymbol,
      specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
    );
    if (object.openPositions != null) {
      yield r'openPositions';
      yield serializers.serialize(
        object.openPositions,
        specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
      );
    }
    if (object.pendingSignals != null) {
      yield r'pendingSignals';
      yield serializers.serialize(
        object.pendingSignals,
        specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingReportResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingReportResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'summary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.summary.replace(valueDes);
          break;
        case r'equityCurve':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.equityCurve.replace(valueDes);
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.trades.replace(valueDes);
          break;
        case r'markers':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.markers.replace(valueDes);
          break;
        case r'bySymbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.bySymbol.replace(valueDes);
          break;
        case r'openPositions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.openPositions.replace(valueDes);
          break;
        case r'pendingSignals':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)])]),
          ) as BuiltList<BuiltMap<String, JsonObject?>>;
          result.pendingSignals.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingReportResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingReportResponseDtoBuilder();
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


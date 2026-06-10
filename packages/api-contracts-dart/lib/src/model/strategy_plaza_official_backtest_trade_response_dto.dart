//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_official_backtest_trade_response_dto.g.dart';

/// StrategyPlazaOfficialBacktestTradeResponseDto
///
/// Properties:
/// * [id] 
/// * [side] 
/// * [entryTs] 
/// * [entryPrice] 
/// * [exitTs] 
/// * [exitPrice] 
/// * [returnPct] 
/// * [reasonOpen] 
/// * [reasonClose] 
/// * [reasonOpenDisplay] 
/// * [reasonCloseDisplay] 
@BuiltValue()
abstract class StrategyPlazaOfficialBacktestTradeResponseDto implements Built<StrategyPlazaOfficialBacktestTradeResponseDto, StrategyPlazaOfficialBacktestTradeResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'side')
  StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum get side;
  // enum sideEnum {  LONG,  SHORT,  };

  @BuiltValueField(wireName: r'entryTs')
  num get entryTs;

  @BuiltValueField(wireName: r'entryPrice')
  num get entryPrice;

  @BuiltValueField(wireName: r'exitTs')
  num get exitTs;

  @BuiltValueField(wireName: r'exitPrice')
  num get exitPrice;

  @BuiltValueField(wireName: r'returnPct')
  num get returnPct;

  @BuiltValueField(wireName: r'reasonOpen')
  String? get reasonOpen;

  @BuiltValueField(wireName: r'reasonClose')
  String? get reasonClose;

  @BuiltValueField(wireName: r'reasonOpenDisplay')
  String? get reasonOpenDisplay;

  @BuiltValueField(wireName: r'reasonCloseDisplay')
  String? get reasonCloseDisplay;

  StrategyPlazaOfficialBacktestTradeResponseDto._();

  factory StrategyPlazaOfficialBacktestTradeResponseDto([void updates(StrategyPlazaOfficialBacktestTradeResponseDtoBuilder b)]) = _$StrategyPlazaOfficialBacktestTradeResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaOfficialBacktestTradeResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaOfficialBacktestTradeResponseDto> get serializer => _$StrategyPlazaOfficialBacktestTradeResponseDtoSerializer();
}

class _$StrategyPlazaOfficialBacktestTradeResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaOfficialBacktestTradeResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaOfficialBacktestTradeResponseDto, _$StrategyPlazaOfficialBacktestTradeResponseDto];

  @override
  final String wireName = r'StrategyPlazaOfficialBacktestTradeResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaOfficialBacktestTradeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum),
    );
    yield r'entryTs';
    yield serializers.serialize(
      object.entryTs,
      specifiedType: const FullType(num),
    );
    yield r'entryPrice';
    yield serializers.serialize(
      object.entryPrice,
      specifiedType: const FullType(num),
    );
    yield r'exitTs';
    yield serializers.serialize(
      object.exitTs,
      specifiedType: const FullType(num),
    );
    yield r'exitPrice';
    yield serializers.serialize(
      object.exitPrice,
      specifiedType: const FullType(num),
    );
    yield r'returnPct';
    yield serializers.serialize(
      object.returnPct,
      specifiedType: const FullType(num),
    );
    if (object.reasonOpen != null) {
      yield r'reasonOpen';
      yield serializers.serialize(
        object.reasonOpen,
        specifiedType: const FullType(String),
      );
    }
    if (object.reasonClose != null) {
      yield r'reasonClose';
      yield serializers.serialize(
        object.reasonClose,
        specifiedType: const FullType(String),
      );
    }
    if (object.reasonOpenDisplay != null) {
      yield r'reasonOpenDisplay';
      yield serializers.serialize(
        object.reasonOpenDisplay,
        specifiedType: const FullType(String),
      );
    }
    if (object.reasonCloseDisplay != null) {
      yield r'reasonCloseDisplay';
      yield serializers.serialize(
        object.reasonCloseDisplay,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestTradeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaOfficialBacktestTradeResponseDtoBuilder result,
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
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum),
          ) as StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum;
          result.side = valueDes;
          break;
        case r'entryTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.entryTs = valueDes;
          break;
        case r'entryPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.entryPrice = valueDes;
          break;
        case r'exitTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.exitTs = valueDes;
          break;
        case r'exitPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.exitPrice = valueDes;
          break;
        case r'returnPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.returnPct = valueDes;
          break;
        case r'reasonOpen':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.reasonOpen = valueDes;
          break;
        case r'reasonClose':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.reasonClose = valueDes;
          break;
        case r'reasonOpenDisplay':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.reasonOpenDisplay = valueDes;
          break;
        case r'reasonCloseDisplay':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.reasonCloseDisplay = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaOfficialBacktestTradeResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaOfficialBacktestTradeResponseDtoBuilder();
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

class StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'LONG')
  static const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum LONG = _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_LONG;
  @BuiltValueEnumConst(wireName: r'SHORT')
  static const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum SHORT = _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_SHORT;

  static Serializer<StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum> get serializer => _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumSerializer;

  const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum> get values => _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumValues;
  static StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum valueOf(String name) => _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumValueOf(name);
}


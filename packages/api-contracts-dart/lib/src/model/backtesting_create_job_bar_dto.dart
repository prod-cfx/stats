//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_bar_dto.g.dart';

/// BacktestingCreateJobBarDto
///
/// Properties:
/// * [symbol] 
/// * [timeframe] 
/// * [openTime] 
/// * [closeTime] 
/// * [open] 
/// * [high] 
/// * [low] 
/// * [close] 
/// * [volume] 
@BuiltValue()
abstract class BacktestingCreateJobBarDto implements Built<BacktestingCreateJobBarDto, BacktestingCreateJobBarDtoBuilder> {
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  @BuiltValueField(wireName: r'timeframe')
  BacktestingCreateJobBarDtoTimeframeEnum get timeframe;
  // enum timeframeEnum {  1m,  3m,  5m,  15m,  30m,  1h,  4h,  6h,  8h,  12h,  1d,  1w,  };

  @BuiltValueField(wireName: r'openTime')
  num get openTime;

  @BuiltValueField(wireName: r'closeTime')
  num get closeTime;

  @BuiltValueField(wireName: r'open')
  num get open;

  @BuiltValueField(wireName: r'high')
  num get high;

  @BuiltValueField(wireName: r'low')
  num get low;

  @BuiltValueField(wireName: r'close')
  num get close;

  @BuiltValueField(wireName: r'volume')
  num get volume;

  BacktestingCreateJobBarDto._();

  factory BacktestingCreateJobBarDto([void updates(BacktestingCreateJobBarDtoBuilder b)]) = _$BacktestingCreateJobBarDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobBarDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobBarDto> get serializer => _$BacktestingCreateJobBarDtoSerializer();
}

class _$BacktestingCreateJobBarDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobBarDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobBarDto, _$BacktestingCreateJobBarDto];

  @override
  final String wireName = r'BacktestingCreateJobBarDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobBarDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'timeframe';
    yield serializers.serialize(
      object.timeframe,
      specifiedType: const FullType(BacktestingCreateJobBarDtoTimeframeEnum),
    );
    yield r'openTime';
    yield serializers.serialize(
      object.openTime,
      specifiedType: const FullType(num),
    );
    yield r'closeTime';
    yield serializers.serialize(
      object.closeTime,
      specifiedType: const FullType(num),
    );
    yield r'open';
    yield serializers.serialize(
      object.open,
      specifiedType: const FullType(num),
    );
    yield r'high';
    yield serializers.serialize(
      object.high,
      specifiedType: const FullType(num),
    );
    yield r'low';
    yield serializers.serialize(
      object.low,
      specifiedType: const FullType(num),
    );
    yield r'close';
    yield serializers.serialize(
      object.close,
      specifiedType: const FullType(num),
    );
    yield r'volume';
    yield serializers.serialize(
      object.volume,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobBarDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobBarDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
            specifiedType: const FullType(BacktestingCreateJobBarDtoTimeframeEnum),
          ) as BacktestingCreateJobBarDtoTimeframeEnum;
          result.timeframe = valueDes;
          break;
        case r'openTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openTime = valueDes;
          break;
        case r'closeTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.closeTime = valueDes;
          break;
        case r'open':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.open = valueDes;
          break;
        case r'high':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.high = valueDes;
          break;
        case r'low':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.low = valueDes;
          break;
        case r'close':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.close = valueDes;
          break;
        case r'volume':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.volume = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobBarDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobBarDtoBuilder();
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

class BacktestingCreateJobBarDtoTimeframeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'1m')
  static const BacktestingCreateJobBarDtoTimeframeEnum n1m = _$backtestingCreateJobBarDtoTimeframeEnum_n1m;
  @BuiltValueEnumConst(wireName: r'3m')
  static const BacktestingCreateJobBarDtoTimeframeEnum n3m = _$backtestingCreateJobBarDtoTimeframeEnum_n3m;
  @BuiltValueEnumConst(wireName: r'5m')
  static const BacktestingCreateJobBarDtoTimeframeEnum n5m = _$backtestingCreateJobBarDtoTimeframeEnum_n5m;
  @BuiltValueEnumConst(wireName: r'15m')
  static const BacktestingCreateJobBarDtoTimeframeEnum n15m = _$backtestingCreateJobBarDtoTimeframeEnum_n15m;
  @BuiltValueEnumConst(wireName: r'30m')
  static const BacktestingCreateJobBarDtoTimeframeEnum n30m = _$backtestingCreateJobBarDtoTimeframeEnum_n30m;
  @BuiltValueEnumConst(wireName: r'1h')
  static const BacktestingCreateJobBarDtoTimeframeEnum n1h = _$backtestingCreateJobBarDtoTimeframeEnum_n1h;
  @BuiltValueEnumConst(wireName: r'4h')
  static const BacktestingCreateJobBarDtoTimeframeEnum n4h = _$backtestingCreateJobBarDtoTimeframeEnum_n4h;
  @BuiltValueEnumConst(wireName: r'6h')
  static const BacktestingCreateJobBarDtoTimeframeEnum n6h = _$backtestingCreateJobBarDtoTimeframeEnum_n6h;
  @BuiltValueEnumConst(wireName: r'8h')
  static const BacktestingCreateJobBarDtoTimeframeEnum n8h = _$backtestingCreateJobBarDtoTimeframeEnum_n8h;
  @BuiltValueEnumConst(wireName: r'12h')
  static const BacktestingCreateJobBarDtoTimeframeEnum n12h = _$backtestingCreateJobBarDtoTimeframeEnum_n12h;
  @BuiltValueEnumConst(wireName: r'1d')
  static const BacktestingCreateJobBarDtoTimeframeEnum n1d = _$backtestingCreateJobBarDtoTimeframeEnum_n1d;
  @BuiltValueEnumConst(wireName: r'1w')
  static const BacktestingCreateJobBarDtoTimeframeEnum n1w = _$backtestingCreateJobBarDtoTimeframeEnum_n1w;

  static Serializer<BacktestingCreateJobBarDtoTimeframeEnum> get serializer => _$backtestingCreateJobBarDtoTimeframeEnumSerializer;

  const BacktestingCreateJobBarDtoTimeframeEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobBarDtoTimeframeEnum> get values => _$backtestingCreateJobBarDtoTimeframeEnumValues;
  static BacktestingCreateJobBarDtoTimeframeEnum valueOf(String name) => _$backtestingCreateJobBarDtoTimeframeEnumValueOf(name);
}


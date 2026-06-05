//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'kline_bar_dto.g.dart';

/// KlineBarDto
///
/// Properties:
/// * [time] - 时间戳（毫秒）
/// * [open] - 开盘价
/// * [high] - 最高价
/// * [low] - 最低价
/// * [close] - 收盘价
/// * [volume] - 成交量（USD）
@BuiltValue()
abstract class KlineBarDto implements Built<KlineBarDto, KlineBarDtoBuilder> {
  /// 时间戳（毫秒）
  @BuiltValueField(wireName: r'time')
  num get time;

  /// 开盘价
  @BuiltValueField(wireName: r'open')
  num get open;

  /// 最高价
  @BuiltValueField(wireName: r'high')
  num get high;

  /// 最低价
  @BuiltValueField(wireName: r'low')
  num get low;

  /// 收盘价
  @BuiltValueField(wireName: r'close')
  num get close;

  /// 成交量（USD）
  @BuiltValueField(wireName: r'volume')
  num get volume;

  KlineBarDto._();

  factory KlineBarDto([void updates(KlineBarDtoBuilder b)]) = _$KlineBarDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(KlineBarDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<KlineBarDto> get serializer => _$KlineBarDtoSerializer();
}

class _$KlineBarDtoSerializer implements PrimitiveSerializer<KlineBarDto> {
  @override
  final Iterable<Type> types = const [KlineBarDto, _$KlineBarDto];

  @override
  final String wireName = r'KlineBarDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    KlineBarDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'time';
    yield serializers.serialize(
      object.time,
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
    KlineBarDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required KlineBarDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'time':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.time = valueDes;
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
  KlineBarDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = KlineBarDtoBuilder();
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


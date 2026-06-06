//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'oi_aggregate_row_dto.g.dart';

/// OiAggregateRowDto
///
/// Properties:
/// * [exchange] - 交易所名称
/// * [qty] - 未平仓合约数量
/// * [usd] - 未平仓合约价值(USD)
/// * [pct] - 占总持仓量百分比
/// * [h1] - 1小时变化百分比
/// * [h4] - 4小时变化百分比
/// * [h24] - 24小时变化百分比
/// * [oiVol] - 持仓量名义价值(USD)
@BuiltValue()
abstract class OiAggregateRowDto implements Built<OiAggregateRowDto, OiAggregateRowDtoBuilder> {
  /// 交易所名称
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 未平仓合约数量
  @BuiltValueField(wireName: r'qty')
  num get qty;

  /// 未平仓合约价值(USD)
  @BuiltValueField(wireName: r'usd')
  num get usd;

  /// 占总持仓量百分比
  @BuiltValueField(wireName: r'pct')
  num get pct;

  /// 1小时变化百分比
  @BuiltValueField(wireName: r'h1')
  num get h1;

  /// 4小时变化百分比
  @BuiltValueField(wireName: r'h4')
  num get h4;

  /// 24小时变化百分比
  @BuiltValueField(wireName: r'h24')
  num get h24;

  /// 持仓量名义价值(USD)
  @BuiltValueField(wireName: r'oiVol')
  num get oiVol;

  OiAggregateRowDto._();

  factory OiAggregateRowDto([void updates(OiAggregateRowDtoBuilder b)]) = _$OiAggregateRowDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OiAggregateRowDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OiAggregateRowDto> get serializer => _$OiAggregateRowDtoSerializer();
}

class _$OiAggregateRowDtoSerializer implements PrimitiveSerializer<OiAggregateRowDto> {
  @override
  final Iterable<Type> types = const [OiAggregateRowDto, _$OiAggregateRowDto];

  @override
  final String wireName = r'OiAggregateRowDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OiAggregateRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(String),
    );
    yield r'qty';
    yield serializers.serialize(
      object.qty,
      specifiedType: const FullType(num),
    );
    yield r'usd';
    yield serializers.serialize(
      object.usd,
      specifiedType: const FullType(num),
    );
    yield r'pct';
    yield serializers.serialize(
      object.pct,
      specifiedType: const FullType(num),
    );
    yield r'h1';
    yield serializers.serialize(
      object.h1,
      specifiedType: const FullType(num),
    );
    yield r'h4';
    yield serializers.serialize(
      object.h4,
      specifiedType: const FullType(num),
    );
    yield r'h24';
    yield serializers.serialize(
      object.h24,
      specifiedType: const FullType(num),
    );
    yield r'oiVol';
    yield serializers.serialize(
      object.oiVol,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OiAggregateRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OiAggregateRowDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchange = valueDes;
          break;
        case r'qty':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.qty = valueDes;
          break;
        case r'usd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.usd = valueDes;
          break;
        case r'pct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.pct = valueDes;
          break;
        case r'h1':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.h1 = valueDes;
          break;
        case r'h4':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.h4 = valueDes;
          break;
        case r'h24':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.h24 = valueDes;
          break;
        case r'oiVol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.oiVol = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OiAggregateRowDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OiAggregateRowDtoBuilder();
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


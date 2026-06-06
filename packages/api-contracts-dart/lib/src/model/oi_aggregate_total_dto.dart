//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'oi_aggregate_total_dto.g.dart';

/// OiAggregateTotalDto
///
/// Properties:
/// * [qty] - 总未平仓合约数量
/// * [usd] - 总未平仓合约价值(USD)
/// * [h24] - 24小时变化百分比
@BuiltValue()
abstract class OiAggregateTotalDto implements Built<OiAggregateTotalDto, OiAggregateTotalDtoBuilder> {
  /// 总未平仓合约数量
  @BuiltValueField(wireName: r'qty')
  num get qty;

  /// 总未平仓合约价值(USD)
  @BuiltValueField(wireName: r'usd')
  num get usd;

  /// 24小时变化百分比
  @BuiltValueField(wireName: r'h24')
  num get h24;

  OiAggregateTotalDto._();

  factory OiAggregateTotalDto([void updates(OiAggregateTotalDtoBuilder b)]) = _$OiAggregateTotalDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OiAggregateTotalDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OiAggregateTotalDto> get serializer => _$OiAggregateTotalDtoSerializer();
}

class _$OiAggregateTotalDtoSerializer implements PrimitiveSerializer<OiAggregateTotalDto> {
  @override
  final Iterable<Type> types = const [OiAggregateTotalDto, _$OiAggregateTotalDto];

  @override
  final String wireName = r'OiAggregateTotalDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OiAggregateTotalDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
    yield r'h24';
    yield serializers.serialize(
      object.h24,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OiAggregateTotalDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OiAggregateTotalDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        case r'h24':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.h24 = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OiAggregateTotalDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OiAggregateTotalDtoBuilder();
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


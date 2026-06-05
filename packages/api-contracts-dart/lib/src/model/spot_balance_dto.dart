//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'spot_balance_dto.g.dart';

/// SpotBalanceDto
///
/// Properties:
/// * [coin] - 币种符号
/// * [total] - 总余额
/// * [hold] - 挂单锁定金额
/// * [available] - 可用余额
/// * [value] - 价值（USD）
@BuiltValue()
abstract class SpotBalanceDto implements Built<SpotBalanceDto, SpotBalanceDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'coin')
  String get coin;

  /// 总余额
  @BuiltValueField(wireName: r'total')
  num get total;

  /// 挂单锁定金额
  @BuiltValueField(wireName: r'hold')
  num get hold;

  /// 可用余额
  @BuiltValueField(wireName: r'available')
  num get available;

  /// 价值（USD）
  @BuiltValueField(wireName: r'value')
  num get value;

  SpotBalanceDto._();

  factory SpotBalanceDto([void updates(SpotBalanceDtoBuilder b)]) = _$SpotBalanceDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SpotBalanceDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SpotBalanceDto> get serializer => _$SpotBalanceDtoSerializer();
}

class _$SpotBalanceDtoSerializer implements PrimitiveSerializer<SpotBalanceDto> {
  @override
  final Iterable<Type> types = const [SpotBalanceDto, _$SpotBalanceDto];

  @override
  final String wireName = r'SpotBalanceDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SpotBalanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'coin';
    yield serializers.serialize(
      object.coin,
      specifiedType: const FullType(String),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(num),
    );
    yield r'hold';
    yield serializers.serialize(
      object.hold,
      specifiedType: const FullType(num),
    );
    yield r'available';
    yield serializers.serialize(
      object.available,
      specifiedType: const FullType(num),
    );
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SpotBalanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SpotBalanceDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'coin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.coin = valueDes;
          break;
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.total = valueDes;
          break;
        case r'hold':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.hold = valueDes;
          break;
        case r'available':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.available = valueDes;
          break;
        case r'value':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.value = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SpotBalanceDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SpotBalanceDtoBuilder();
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


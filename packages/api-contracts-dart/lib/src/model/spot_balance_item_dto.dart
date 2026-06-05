//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'spot_balance_item_dto.g.dart';

/// SpotBalanceItemDto
///
/// Properties:
/// * [coin] - 币种符号
/// * [total] - 总余额
/// * [hold] - 挂单锁定金额
/// * [value] - 价值（USD）
/// * [sharePercent] - 占比（%）
@BuiltValue()
abstract class SpotBalanceItemDto implements Built<SpotBalanceItemDto, SpotBalanceItemDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'coin')
  String get coin;

  /// 总余额
  @BuiltValueField(wireName: r'total')
  num get total;

  /// 挂单锁定金额
  @BuiltValueField(wireName: r'hold')
  num get hold;

  /// 价值（USD）
  @BuiltValueField(wireName: r'value')
  num get value;

  /// 占比（%）
  @BuiltValueField(wireName: r'sharePercent')
  num get sharePercent;

  SpotBalanceItemDto._();

  factory SpotBalanceItemDto([void updates(SpotBalanceItemDtoBuilder b)]) = _$SpotBalanceItemDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SpotBalanceItemDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SpotBalanceItemDto> get serializer => _$SpotBalanceItemDtoSerializer();
}

class _$SpotBalanceItemDtoSerializer implements PrimitiveSerializer<SpotBalanceItemDto> {
  @override
  final Iterable<Type> types = const [SpotBalanceItemDto, _$SpotBalanceItemDto];

  @override
  final String wireName = r'SpotBalanceItemDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SpotBalanceItemDto object, {
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
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(num),
    );
    yield r'sharePercent';
    yield serializers.serialize(
      object.sharePercent,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SpotBalanceItemDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SpotBalanceItemDtoBuilder result,
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
        case r'value':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.value = valueDes;
          break;
        case r'sharePercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.sharePercent = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SpotBalanceItemDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SpotBalanceItemDtoBuilder();
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


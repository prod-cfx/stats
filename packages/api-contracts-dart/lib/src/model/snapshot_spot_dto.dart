//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/spot_balance_item_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'snapshot_spot_dto.g.dart';

/// SnapshotSpotDto
///
/// Properties:
/// * [totalValue] - 现货总价值（USD）
/// * [balances] - 现货余额列表
@BuiltValue()
abstract class SnapshotSpotDto implements Built<SnapshotSpotDto, SnapshotSpotDtoBuilder> {
  /// 现货总价值（USD）
  @BuiltValueField(wireName: r'totalValue')
  num get totalValue;

  /// 现货余额列表
  @BuiltValueField(wireName: r'balances')
  BuiltList<SpotBalanceItemDto> get balances;

  SnapshotSpotDto._();

  factory SnapshotSpotDto([void updates(SnapshotSpotDtoBuilder b)]) = _$SnapshotSpotDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SnapshotSpotDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SnapshotSpotDto> get serializer => _$SnapshotSpotDtoSerializer();
}

class _$SnapshotSpotDtoSerializer implements PrimitiveSerializer<SnapshotSpotDto> {
  @override
  final Iterable<Type> types = const [SnapshotSpotDto, _$SnapshotSpotDto];

  @override
  final String wireName = r'SnapshotSpotDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SnapshotSpotDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'totalValue';
    yield serializers.serialize(
      object.totalValue,
      specifiedType: const FullType(num),
    );
    yield r'balances';
    yield serializers.serialize(
      object.balances,
      specifiedType: const FullType(BuiltList, [FullType(SpotBalanceItemDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SnapshotSpotDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SnapshotSpotDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'totalValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalValue = valueDes;
          break;
        case r'balances':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(SpotBalanceItemDto)]),
          ) as BuiltList<SpotBalanceItemDto>;
          result.balances.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SnapshotSpotDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SnapshotSpotDtoBuilder();
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


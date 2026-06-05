//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'snapshot_perp_dto.g.dart';

/// SnapshotPerpDto
///
/// Properties:
/// * [accountValue] - 账户总价值（USD）
/// * [totalMarginUsed] - 已用保证金（USD）
/// * [totalPositionValue] - 总持仓名义价值（USD）
/// * [withdrawable] - 可提取金额（USD）
/// * [marginUsagePercent] - 保证金使用率（%）
/// * [leverageRatio] - 杠杆倍数
/// * [unrealizedPnl] - 未实现盈亏（USD）
/// * [roi] - ROI（%）
@BuiltValue()
abstract class SnapshotPerpDto implements Built<SnapshotPerpDto, SnapshotPerpDtoBuilder> {
  /// 账户总价值（USD）
  @BuiltValueField(wireName: r'accountValue')
  num get accountValue;

  /// 已用保证金（USD）
  @BuiltValueField(wireName: r'totalMarginUsed')
  num get totalMarginUsed;

  /// 总持仓名义价值（USD）
  @BuiltValueField(wireName: r'totalPositionValue')
  num get totalPositionValue;

  /// 可提取金额（USD）
  @BuiltValueField(wireName: r'withdrawable')
  num get withdrawable;

  /// 保证金使用率（%）
  @BuiltValueField(wireName: r'marginUsagePercent')
  num get marginUsagePercent;

  /// 杠杆倍数
  @BuiltValueField(wireName: r'leverageRatio')
  num get leverageRatio;

  /// 未实现盈亏（USD）
  @BuiltValueField(wireName: r'unrealizedPnl')
  num get unrealizedPnl;

  /// ROI（%）
  @BuiltValueField(wireName: r'roi')
  num get roi;

  SnapshotPerpDto._();

  factory SnapshotPerpDto([void updates(SnapshotPerpDtoBuilder b)]) = _$SnapshotPerpDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SnapshotPerpDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SnapshotPerpDto> get serializer => _$SnapshotPerpDtoSerializer();
}

class _$SnapshotPerpDtoSerializer implements PrimitiveSerializer<SnapshotPerpDto> {
  @override
  final Iterable<Type> types = const [SnapshotPerpDto, _$SnapshotPerpDto];

  @override
  final String wireName = r'SnapshotPerpDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SnapshotPerpDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'accountValue';
    yield serializers.serialize(
      object.accountValue,
      specifiedType: const FullType(num),
    );
    yield r'totalMarginUsed';
    yield serializers.serialize(
      object.totalMarginUsed,
      specifiedType: const FullType(num),
    );
    yield r'totalPositionValue';
    yield serializers.serialize(
      object.totalPositionValue,
      specifiedType: const FullType(num),
    );
    yield r'withdrawable';
    yield serializers.serialize(
      object.withdrawable,
      specifiedType: const FullType(num),
    );
    yield r'marginUsagePercent';
    yield serializers.serialize(
      object.marginUsagePercent,
      specifiedType: const FullType(num),
    );
    yield r'leverageRatio';
    yield serializers.serialize(
      object.leverageRatio,
      specifiedType: const FullType(num),
    );
    yield r'unrealizedPnl';
    yield serializers.serialize(
      object.unrealizedPnl,
      specifiedType: const FullType(num),
    );
    yield r'roi';
    yield serializers.serialize(
      object.roi,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SnapshotPerpDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SnapshotPerpDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'accountValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.accountValue = valueDes;
          break;
        case r'totalMarginUsed':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalMarginUsed = valueDes;
          break;
        case r'totalPositionValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalPositionValue = valueDes;
          break;
        case r'withdrawable':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.withdrawable = valueDes;
          break;
        case r'marginUsagePercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.marginUsagePercent = valueDes;
          break;
        case r'leverageRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.leverageRatio = valueDes;
          break;
        case r'unrealizedPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.unrealizedPnl = valueDes;
          break;
        case r'roi':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.roi = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SnapshotPerpDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SnapshotPerpDtoBuilder();
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


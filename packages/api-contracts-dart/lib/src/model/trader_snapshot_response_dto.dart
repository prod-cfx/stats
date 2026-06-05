//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/snapshot_spot_dto.dart';
import 'package:backend_api_contracts/src/model/snapshot_total_dto.dart';
import 'package:backend_api_contracts/src/model/snapshot_perp_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trader_snapshot_response_dto.g.dart';

/// TraderSnapshotResponseDto
///
/// Properties:
/// * [perp] - 永续合约账户快照
/// * [spot] - 现货账户快照
/// * [total] - 账户汇总数据
@BuiltValue()
abstract class TraderSnapshotResponseDto implements Built<TraderSnapshotResponseDto, TraderSnapshotResponseDtoBuilder> {
  /// 永续合约账户快照
  @BuiltValueField(wireName: r'perp')
  SnapshotPerpDto get perp;

  /// 现货账户快照
  @BuiltValueField(wireName: r'spot')
  SnapshotSpotDto get spot;

  /// 账户汇总数据
  @BuiltValueField(wireName: r'total')
  SnapshotTotalDto get total;

  TraderSnapshotResponseDto._();

  factory TraderSnapshotResponseDto([void updates(TraderSnapshotResponseDtoBuilder b)]) = _$TraderSnapshotResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TraderSnapshotResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TraderSnapshotResponseDto> get serializer => _$TraderSnapshotResponseDtoSerializer();
}

class _$TraderSnapshotResponseDtoSerializer implements PrimitiveSerializer<TraderSnapshotResponseDto> {
  @override
  final Iterable<Type> types = const [TraderSnapshotResponseDto, _$TraderSnapshotResponseDto];

  @override
  final String wireName = r'TraderSnapshotResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TraderSnapshotResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'perp';
    yield serializers.serialize(
      object.perp,
      specifiedType: const FullType(SnapshotPerpDto),
    );
    yield r'spot';
    yield serializers.serialize(
      object.spot,
      specifiedType: const FullType(SnapshotSpotDto),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(SnapshotTotalDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TraderSnapshotResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TraderSnapshotResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'perp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SnapshotPerpDto),
          ) as SnapshotPerpDto;
          result.perp.replace(valueDes);
          break;
        case r'spot':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SnapshotSpotDto),
          ) as SnapshotSpotDto;
          result.spot.replace(valueDes);
          break;
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SnapshotTotalDto),
          ) as SnapshotTotalDto;
          result.total.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TraderSnapshotResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TraderSnapshotResponseDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/aggregated_volume_row_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_volume_snapshot_response_dto.g.dart';

/// AggregatedVolumeSnapshotResponseDto
///
/// Properties:
/// * [symbol] - 币种符号
/// * [total] - 总成交量（USD）
/// * [rows] - 各交易所行
@BuiltValue()
abstract class AggregatedVolumeSnapshotResponseDto implements Built<AggregatedVolumeSnapshotResponseDto, AggregatedVolumeSnapshotResponseDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 总成交量（USD）
  @BuiltValueField(wireName: r'total')
  num get total;

  /// 各交易所行
  @BuiltValueField(wireName: r'rows')
  BuiltList<AggregatedVolumeRowDto> get rows;

  AggregatedVolumeSnapshotResponseDto._();

  factory AggregatedVolumeSnapshotResponseDto([void updates(AggregatedVolumeSnapshotResponseDtoBuilder b)]) = _$AggregatedVolumeSnapshotResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedVolumeSnapshotResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedVolumeSnapshotResponseDto> get serializer => _$AggregatedVolumeSnapshotResponseDtoSerializer();
}

class _$AggregatedVolumeSnapshotResponseDtoSerializer implements PrimitiveSerializer<AggregatedVolumeSnapshotResponseDto> {
  @override
  final Iterable<Type> types = const [AggregatedVolumeSnapshotResponseDto, _$AggregatedVolumeSnapshotResponseDto];

  @override
  final String wireName = r'AggregatedVolumeSnapshotResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedVolumeSnapshotResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(num),
    );
    yield r'rows';
    yield serializers.serialize(
      object.rows,
      specifiedType: const FullType(BuiltList, [FullType(AggregatedVolumeRowDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedVolumeSnapshotResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedVolumeSnapshotResponseDtoBuilder result,
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
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.total = valueDes;
          break;
        case r'rows':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AggregatedVolumeRowDto)]),
          ) as BuiltList<AggregatedVolumeRowDto>;
          result.rows.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedVolumeSnapshotResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedVolumeSnapshotResponseDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/oi_aggregate_row_dto.dart';
import 'package:backend_api_contracts/src/model/oi_aggregate_total_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'oi_aggregate_snapshot_dto.g.dart';

/// OiAggregateSnapshotDto
///
/// Properties:
/// * [symbol] - 币种符号
/// * [dataTimestamp] - 数据时间戳
/// * [total] - 总计行
/// * [rows] - 各交易所行
@BuiltValue()
abstract class OiAggregateSnapshotDto implements Built<OiAggregateSnapshotDto, OiAggregateSnapshotDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 数据时间戳
  @BuiltValueField(wireName: r'dataTimestamp')
  String get dataTimestamp;

  /// 总计行
  @BuiltValueField(wireName: r'total')
  OiAggregateTotalDto get total;

  /// 各交易所行
  @BuiltValueField(wireName: r'rows')
  BuiltList<OiAggregateRowDto> get rows;

  OiAggregateSnapshotDto._();

  factory OiAggregateSnapshotDto([void updates(OiAggregateSnapshotDtoBuilder b)]) = _$OiAggregateSnapshotDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OiAggregateSnapshotDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OiAggregateSnapshotDto> get serializer => _$OiAggregateSnapshotDtoSerializer();
}

class _$OiAggregateSnapshotDtoSerializer implements PrimitiveSerializer<OiAggregateSnapshotDto> {
  @override
  final Iterable<Type> types = const [OiAggregateSnapshotDto, _$OiAggregateSnapshotDto];

  @override
  final String wireName = r'OiAggregateSnapshotDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OiAggregateSnapshotDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'dataTimestamp';
    yield serializers.serialize(
      object.dataTimestamp,
      specifiedType: const FullType(String),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(OiAggregateTotalDto),
    );
    yield r'rows';
    yield serializers.serialize(
      object.rows,
      specifiedType: const FullType(BuiltList, [FullType(OiAggregateRowDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OiAggregateSnapshotDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OiAggregateSnapshotDtoBuilder result,
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
        case r'dataTimestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.dataTimestamp = valueDes;
          break;
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OiAggregateTotalDto),
          ) as OiAggregateTotalDto;
          result.total.replace(valueDes);
          break;
        case r'rows':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OiAggregateRowDto)]),
          ) as BuiltList<OiAggregateRowDto>;
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
  OiAggregateSnapshotDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OiAggregateSnapshotDtoBuilder();
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


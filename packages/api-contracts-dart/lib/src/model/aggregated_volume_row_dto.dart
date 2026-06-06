//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_volume_row_dto.g.dart';

/// AggregatedVolumeRowDto
///
/// Properties:
/// * [exchange] - 交易所名称
/// * [value] - 24h 成交量（USD）
@BuiltValue()
abstract class AggregatedVolumeRowDto implements Built<AggregatedVolumeRowDto, AggregatedVolumeRowDtoBuilder> {
  /// 交易所名称
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 24h 成交量（USD）
  @BuiltValueField(wireName: r'value')
  num get value;

  AggregatedVolumeRowDto._();

  factory AggregatedVolumeRowDto([void updates(AggregatedVolumeRowDtoBuilder b)]) = _$AggregatedVolumeRowDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedVolumeRowDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedVolumeRowDto> get serializer => _$AggregatedVolumeRowDtoSerializer();
}

class _$AggregatedVolumeRowDtoSerializer implements PrimitiveSerializer<AggregatedVolumeRowDto> {
  @override
  final Iterable<Type> types = const [AggregatedVolumeRowDto, _$AggregatedVolumeRowDto];

  @override
  final String wireName = r'AggregatedVolumeRowDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedVolumeRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(String),
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
    AggregatedVolumeRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedVolumeRowDtoBuilder result,
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
  AggregatedVolumeRowDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedVolumeRowDtoBuilder();
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


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/venue_detail_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_level_dto.g.dart';

/// AggregatedLevelDto
///
/// Properties:
/// * [price] - 价格
/// * [sizeTotal] - 总数量
/// * [details] - 各交易所明细
@BuiltValue()
abstract class AggregatedLevelDto implements Built<AggregatedLevelDto, AggregatedLevelDtoBuilder> {
  /// 价格
  @BuiltValueField(wireName: r'price')
  num get price;

  /// 总数量
  @BuiltValueField(wireName: r'sizeTotal')
  num get sizeTotal;

  /// 各交易所明细
  @BuiltValueField(wireName: r'details')
  BuiltList<VenueDetailDto> get details;

  AggregatedLevelDto._();

  factory AggregatedLevelDto([void updates(AggregatedLevelDtoBuilder b)]) = _$AggregatedLevelDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedLevelDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedLevelDto> get serializer => _$AggregatedLevelDtoSerializer();
}

class _$AggregatedLevelDtoSerializer implements PrimitiveSerializer<AggregatedLevelDto> {
  @override
  final Iterable<Type> types = const [AggregatedLevelDto, _$AggregatedLevelDto];

  @override
  final String wireName = r'AggregatedLevelDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedLevelDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(num),
    );
    yield r'sizeTotal';
    yield serializers.serialize(
      object.sizeTotal,
      specifiedType: const FullType(num),
    );
    yield r'details';
    yield serializers.serialize(
      object.details,
      specifiedType: const FullType(BuiltList, [FullType(VenueDetailDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedLevelDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedLevelDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.price = valueDes;
          break;
        case r'sizeTotal':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.sizeTotal = valueDes;
          break;
        case r'details':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(VenueDetailDto)]),
          ) as BuiltList<VenueDetailDto>;
          result.details.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedLevelDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedLevelDtoBuilder();
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


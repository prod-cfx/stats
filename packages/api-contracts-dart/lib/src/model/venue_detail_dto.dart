//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'venue_detail_dto.g.dart';

/// VenueDetailDto
///
/// Properties:
/// * [venueId] - 交易所ID
/// * [size] - 该交易所在此价格的数量
@BuiltValue()
abstract class VenueDetailDto implements Built<VenueDetailDto, VenueDetailDtoBuilder> {
  /// 交易所ID
  @BuiltValueField(wireName: r'venueId')
  String get venueId;

  /// 该交易所在此价格的数量
  @BuiltValueField(wireName: r'size')
  num get size;

  VenueDetailDto._();

  factory VenueDetailDto([void updates(VenueDetailDtoBuilder b)]) = _$VenueDetailDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(VenueDetailDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<VenueDetailDto> get serializer => _$VenueDetailDtoSerializer();
}

class _$VenueDetailDtoSerializer implements PrimitiveSerializer<VenueDetailDto> {
  @override
  final Iterable<Type> types = const [VenueDetailDto, _$VenueDetailDto];

  @override
  final String wireName = r'VenueDetailDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    VenueDetailDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'venueId';
    yield serializers.serialize(
      object.venueId,
      specifiedType: const FullType(String),
    );
    yield r'size';
    yield serializers.serialize(
      object.size,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    VenueDetailDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required VenueDetailDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'venueId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.venueId = valueDes;
          break;
        case r'size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.size = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  VenueDetailDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = VenueDetailDtoBuilder();
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


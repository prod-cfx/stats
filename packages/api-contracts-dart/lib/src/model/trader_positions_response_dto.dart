//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/perp_position_dto.dart';
import 'package:backend_api_contracts/src/model/spot_balance_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trader_positions_response_dto.g.dart';

/// TraderPositionsResponseDto
///
/// Properties:
/// * [perp] - 永续合约持仓列表
/// * [spot] - 现货余额列表
@BuiltValue()
abstract class TraderPositionsResponseDto implements Built<TraderPositionsResponseDto, TraderPositionsResponseDtoBuilder> {
  /// 永续合约持仓列表
  @BuiltValueField(wireName: r'perp')
  BuiltList<PerpPositionDto> get perp;

  /// 现货余额列表
  @BuiltValueField(wireName: r'spot')
  BuiltList<SpotBalanceDto> get spot;

  TraderPositionsResponseDto._();

  factory TraderPositionsResponseDto([void updates(TraderPositionsResponseDtoBuilder b)]) = _$TraderPositionsResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TraderPositionsResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TraderPositionsResponseDto> get serializer => _$TraderPositionsResponseDtoSerializer();
}

class _$TraderPositionsResponseDtoSerializer implements PrimitiveSerializer<TraderPositionsResponseDto> {
  @override
  final Iterable<Type> types = const [TraderPositionsResponseDto, _$TraderPositionsResponseDto];

  @override
  final String wireName = r'TraderPositionsResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TraderPositionsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'perp';
    yield serializers.serialize(
      object.perp,
      specifiedType: const FullType(BuiltList, [FullType(PerpPositionDto)]),
    );
    yield r'spot';
    yield serializers.serialize(
      object.spot,
      specifiedType: const FullType(BuiltList, [FullType(SpotBalanceDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TraderPositionsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TraderPositionsResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'perp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(PerpPositionDto)]),
          ) as BuiltList<PerpPositionDto>;
          result.perp.replace(valueDes);
          break;
        case r'spot':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(SpotBalanceDto)]),
          ) as BuiltList<SpotBalanceDto>;
          result.spot.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TraderPositionsResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TraderPositionsResponseDtoBuilder();
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


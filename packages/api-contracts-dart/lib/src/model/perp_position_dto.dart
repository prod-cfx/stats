//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/leverage_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'perp_position_dto.g.dart';

/// PerpPositionDto
///
/// Properties:
/// * [coin] - 币种符号
/// * [side] - 仓位方向
/// * [size] - 持仓数量（负数表示空头）
/// * [entryPrice] - 入场价格
/// * [markPrice] - 标记价格（当前市场价）
/// * [liquidationPrice] - 清算价格
/// * [positionValue] - 持仓价值（USD）
/// * [marginUsed] - 已用保证金（USD）
/// * [leverage] - 杠杆信息
/// * [unrealizedPnl] - 未实现盈亏（USD）
/// * [unrealizedPnlPercent] - 未实现盈亏百分比（%）
/// * [fundingRate] - 累计资金费率（USD）
/// * [roi] - ROI（%）
@BuiltValue()
abstract class PerpPositionDto implements Built<PerpPositionDto, PerpPositionDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'coin')
  String get coin;

  /// 仓位方向
  @BuiltValueField(wireName: r'side')
  PerpPositionDtoSideEnum get side;
  // enum sideEnum {  LONG,  SHORT,  };

  /// 持仓数量（负数表示空头）
  @BuiltValueField(wireName: r'size')
  num get size;

  /// 入场价格
  @BuiltValueField(wireName: r'entryPrice')
  num get entryPrice;

  /// 标记价格（当前市场价）
  @BuiltValueField(wireName: r'markPrice')
  num get markPrice;

  /// 清算价格
  @BuiltValueField(wireName: r'liquidationPrice')
  num get liquidationPrice;

  /// 持仓价值（USD）
  @BuiltValueField(wireName: r'positionValue')
  num get positionValue;

  /// 已用保证金（USD）
  @BuiltValueField(wireName: r'marginUsed')
  num get marginUsed;

  /// 杠杆信息
  @BuiltValueField(wireName: r'leverage')
  LeverageDto get leverage;

  /// 未实现盈亏（USD）
  @BuiltValueField(wireName: r'unrealizedPnl')
  num get unrealizedPnl;

  /// 未实现盈亏百分比（%）
  @BuiltValueField(wireName: r'unrealizedPnlPercent')
  num get unrealizedPnlPercent;

  /// 累计资金费率（USD）
  @BuiltValueField(wireName: r'fundingRate')
  num? get fundingRate;

  /// ROI（%）
  @BuiltValueField(wireName: r'roi')
  num get roi;

  PerpPositionDto._();

  factory PerpPositionDto([void updates(PerpPositionDtoBuilder b)]) = _$PerpPositionDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PerpPositionDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PerpPositionDto> get serializer => _$PerpPositionDtoSerializer();
}

class _$PerpPositionDtoSerializer implements PrimitiveSerializer<PerpPositionDto> {
  @override
  final Iterable<Type> types = const [PerpPositionDto, _$PerpPositionDto];

  @override
  final String wireName = r'PerpPositionDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PerpPositionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'coin';
    yield serializers.serialize(
      object.coin,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(PerpPositionDtoSideEnum),
    );
    yield r'size';
    yield serializers.serialize(
      object.size,
      specifiedType: const FullType(num),
    );
    yield r'entryPrice';
    yield serializers.serialize(
      object.entryPrice,
      specifiedType: const FullType(num),
    );
    yield r'markPrice';
    yield serializers.serialize(
      object.markPrice,
      specifiedType: const FullType(num),
    );
    yield r'liquidationPrice';
    yield serializers.serialize(
      object.liquidationPrice,
      specifiedType: const FullType(num),
    );
    yield r'positionValue';
    yield serializers.serialize(
      object.positionValue,
      specifiedType: const FullType(num),
    );
    yield r'marginUsed';
    yield serializers.serialize(
      object.marginUsed,
      specifiedType: const FullType(num),
    );
    yield r'leverage';
    yield serializers.serialize(
      object.leverage,
      specifiedType: const FullType(LeverageDto),
    );
    yield r'unrealizedPnl';
    yield serializers.serialize(
      object.unrealizedPnl,
      specifiedType: const FullType(num),
    );
    yield r'unrealizedPnlPercent';
    yield serializers.serialize(
      object.unrealizedPnlPercent,
      specifiedType: const FullType(num),
    );
    if (object.fundingRate != null) {
      yield r'fundingRate';
      yield serializers.serialize(
        object.fundingRate,
        specifiedType: const FullType(num),
      );
    }
    yield r'roi';
    yield serializers.serialize(
      object.roi,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    PerpPositionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required PerpPositionDtoBuilder result,
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
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(PerpPositionDtoSideEnum),
          ) as PerpPositionDtoSideEnum;
          result.side = valueDes;
          break;
        case r'size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.size = valueDes;
          break;
        case r'entryPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.entryPrice = valueDes;
          break;
        case r'markPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.markPrice = valueDes;
          break;
        case r'liquidationPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.liquidationPrice = valueDes;
          break;
        case r'positionValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionValue = valueDes;
          break;
        case r'marginUsed':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.marginUsed = valueDes;
          break;
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LeverageDto),
          ) as LeverageDto;
          result.leverage.replace(valueDes);
          break;
        case r'unrealizedPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.unrealizedPnl = valueDes;
          break;
        case r'unrealizedPnlPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.unrealizedPnlPercent = valueDes;
          break;
        case r'fundingRate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.fundingRate = valueDes;
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
  PerpPositionDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PerpPositionDtoBuilder();
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

class PerpPositionDtoSideEnum extends EnumClass {

  /// 仓位方向
  @BuiltValueEnumConst(wireName: r'LONG')
  static const PerpPositionDtoSideEnum LONG = _$perpPositionDtoSideEnum_LONG;
  /// 仓位方向
  @BuiltValueEnumConst(wireName: r'SHORT')
  static const PerpPositionDtoSideEnum SHORT = _$perpPositionDtoSideEnum_SHORT;

  static Serializer<PerpPositionDtoSideEnum> get serializer => _$perpPositionDtoSideEnumSerializer;

  const PerpPositionDtoSideEnum._(String name): super(name);

  static BuiltSet<PerpPositionDtoSideEnum> get values => _$perpPositionDtoSideEnumValues;
  static PerpPositionDtoSideEnum valueOf(String name) => _$perpPositionDtoSideEnumValueOf(name);
}


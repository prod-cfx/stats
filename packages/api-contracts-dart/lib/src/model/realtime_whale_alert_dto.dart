//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_alert_side.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'realtime_whale_alert_dto.g.dart';

/// RealtimeWhaleAlertDto
///
/// Properties:
/// * [userAddress] - 鲸鱼地址（Hyperliquid 用户地址）
/// * [symbol] - 币种符号，例如 BTC / ETH
/// * [positionSize] - 持仓大小（正数=多头，负数=空头）
/// * [entryPrice] - 入场价格（USD）
/// * [liqPrice] - 清算价格（USD）
/// * [positionValueUsd] - 持仓名义价值（USD）
/// * [positionAction] - 持仓操作类型：1 = 开仓, 2 = 平仓
/// * [createTime] - 持仓创建/变动时间（ISO 时间字符串）
/// * [side] - 持仓方向：Long / Short（由 position_size 正负推导，>= 0 视为 Long，< 0 视为 Short）
@BuiltValue()
abstract class RealtimeWhaleAlertDto implements Built<RealtimeWhaleAlertDto, RealtimeWhaleAlertDtoBuilder> {
  /// 鲸鱼地址（Hyperliquid 用户地址）
  @BuiltValueField(wireName: r'user_address')
  String get userAddress;

  /// 币种符号，例如 BTC / ETH
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 持仓大小（正数=多头，负数=空头）
  @BuiltValueField(wireName: r'position_size')
  num get positionSize;

  /// 入场价格（USD）
  @BuiltValueField(wireName: r'entry_price')
  num get entryPrice;

  /// 清算价格（USD）
  @BuiltValueField(wireName: r'liq_price')
  num get liqPrice;

  /// 持仓名义价值（USD）
  @BuiltValueField(wireName: r'position_value_usd')
  num get positionValueUsd;

  /// 持仓操作类型：1 = 开仓, 2 = 平仓
  @BuiltValueField(wireName: r'position_action')
  num get positionAction;

  /// 持仓创建/变动时间（ISO 时间字符串）
  @BuiltValueField(wireName: r'create_time')
  String get createTime;

  /// 持仓方向：Long / Short（由 position_size 正负推导，>= 0 视为 Long，< 0 视为 Short）
  @BuiltValueField(wireName: r'side')
  WhaleAlertSide get side;
  // enum sideEnum {  Long,  Short,  };

  RealtimeWhaleAlertDto._();

  factory RealtimeWhaleAlertDto([void updates(RealtimeWhaleAlertDtoBuilder b)]) = _$RealtimeWhaleAlertDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RealtimeWhaleAlertDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RealtimeWhaleAlertDto> get serializer => _$RealtimeWhaleAlertDtoSerializer();
}

class _$RealtimeWhaleAlertDtoSerializer implements PrimitiveSerializer<RealtimeWhaleAlertDto> {
  @override
  final Iterable<Type> types = const [RealtimeWhaleAlertDto, _$RealtimeWhaleAlertDto];

  @override
  final String wireName = r'RealtimeWhaleAlertDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RealtimeWhaleAlertDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'user_address';
    yield serializers.serialize(
      object.userAddress,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'position_size';
    yield serializers.serialize(
      object.positionSize,
      specifiedType: const FullType(num),
    );
    yield r'entry_price';
    yield serializers.serialize(
      object.entryPrice,
      specifiedType: const FullType(num),
    );
    yield r'liq_price';
    yield serializers.serialize(
      object.liqPrice,
      specifiedType: const FullType(num),
    );
    yield r'position_value_usd';
    yield serializers.serialize(
      object.positionValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'position_action';
    yield serializers.serialize(
      object.positionAction,
      specifiedType: const FullType(num),
    );
    yield r'create_time';
    yield serializers.serialize(
      object.createTime,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(WhaleAlertSide),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RealtimeWhaleAlertDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RealtimeWhaleAlertDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'user_address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userAddress = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'position_size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionSize = valueDes;
          break;
        case r'entry_price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.entryPrice = valueDes;
          break;
        case r'liq_price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.liqPrice = valueDes;
          break;
        case r'position_value_usd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionValueUsd = valueDes;
          break;
        case r'position_action':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionAction = valueDes;
          break;
        case r'create_time':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createTime = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleAlertSide),
          ) as WhaleAlertSide;
          result.side = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RealtimeWhaleAlertDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RealtimeWhaleAlertDtoBuilder();
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


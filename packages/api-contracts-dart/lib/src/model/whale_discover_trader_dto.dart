//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/whale_discover_trader_ai_tag_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_discover_trader_dto.g.dart';

/// WhaleDiscoverTraderDto
///
/// Properties:
/// * [variant] - 卡片展示变体：推荐卡片或详情卡片
/// * [address] - 鲸鱼地址（链上地址）
/// * [handle] - 可选的社交/昵称 handle，例如 @machibigbrother
/// * [tag] - 推荐卡片右上角的小标签，例如 $10B HYPERUNIT WHALE
/// * [totalValueUsd] - 总持仓名义价值（USD），基于最近一段时间内 Hyperliquid whale alert 数据的名义金额聚合，不代表账户实际资产净值
/// * [pnlUsd] - 实现盈亏（USD）。当前实现为基于名义价值和多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。
/// * [pnlLabelKey] - 盈亏标签 key，用于前端展示对应时间维度
/// * [trades] - 成交笔数（近一段时间内的鲸鱼预警条数）
/// * [positions] - 涉及的标的数量（近一段时间内出现过持仓预警的币种个数）
/// * [winRatePct] - 胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于 discover 视图展示，不代表真实历史胜率。
/// * [winRateLabelKey] - 胜率标签 key，用于前端展示对应时间维度
/// * [avatarColor] - 头像圆圈的主色调
/// * [aiTags] - AI 风格标签列表（可选）
@BuiltValue()
abstract class WhaleDiscoverTraderDto implements Built<WhaleDiscoverTraderDto, WhaleDiscoverTraderDtoBuilder> {
  /// 卡片展示变体：推荐卡片或详情卡片
  @BuiltValueField(wireName: r'variant')
  WhaleDiscoverTraderDtoVariantEnum get variant;
  // enum variantEnum {  recommended,  detail,  };

  /// 鲸鱼地址（链上地址）
  @BuiltValueField(wireName: r'address')
  String get address;

  /// 可选的社交/昵称 handle，例如 @machibigbrother
  @BuiltValueField(wireName: r'handle')
  String? get handle;

  /// 推荐卡片右上角的小标签，例如 $10B HYPERUNIT WHALE
  @BuiltValueField(wireName: r'tag')
  String? get tag;

  /// 总持仓名义价值（USD），基于最近一段时间内 Hyperliquid whale alert 数据的名义金额聚合，不代表账户实际资产净值
  @BuiltValueField(wireName: r'totalValueUsd')
  num get totalValueUsd;

  /// 实现盈亏（USD）。当前实现为基于名义价值和多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。
  @BuiltValueField(wireName: r'pnlUsd')
  num get pnlUsd;

  /// 盈亏标签 key，用于前端展示对应时间维度
  @BuiltValueField(wireName: r'pnlLabelKey')
  WhaleDiscoverTraderDtoPnlLabelKeyEnum? get pnlLabelKey;
  // enum pnlLabelKeyEnum {  realizedPnl,  realizedPnl1m,  };

  /// 成交笔数（近一段时间内的鲸鱼预警条数）
  @BuiltValueField(wireName: r'trades')
  num? get trades;

  /// 涉及的标的数量（近一段时间内出现过持仓预警的币种个数）
  @BuiltValueField(wireName: r'positions')
  num? get positions;

  /// 胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于 discover 视图展示，不代表真实历史胜率。
  @BuiltValueField(wireName: r'winRatePct')
  num get winRatePct;

  /// 胜率标签 key，用于前端展示对应时间维度
  @BuiltValueField(wireName: r'winRateLabelKey')
  WhaleDiscoverTraderDtoWinRateLabelKeyEnum? get winRateLabelKey;
  // enum winRateLabelKeyEnum {  winRate,  winRate1m,  };

  /// 头像圆圈的主色调
  @BuiltValueField(wireName: r'avatarColor')
  String get avatarColor;

  /// AI 风格标签列表（可选）
  @BuiltValueField(wireName: r'aiTags')
  BuiltList<WhaleDiscoverTraderAiTagDto>? get aiTags;

  WhaleDiscoverTraderDto._();

  factory WhaleDiscoverTraderDto([void updates(WhaleDiscoverTraderDtoBuilder b)]) = _$WhaleDiscoverTraderDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleDiscoverTraderDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleDiscoverTraderDto> get serializer => _$WhaleDiscoverTraderDtoSerializer();
}

class _$WhaleDiscoverTraderDtoSerializer implements PrimitiveSerializer<WhaleDiscoverTraderDto> {
  @override
  final Iterable<Type> types = const [WhaleDiscoverTraderDto, _$WhaleDiscoverTraderDto];

  @override
  final String wireName = r'WhaleDiscoverTraderDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleDiscoverTraderDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'variant';
    yield serializers.serialize(
      object.variant,
      specifiedType: const FullType(WhaleDiscoverTraderDtoVariantEnum),
    );
    yield r'address';
    yield serializers.serialize(
      object.address,
      specifiedType: const FullType(String),
    );
    if (object.handle != null) {
      yield r'handle';
      yield serializers.serialize(
        object.handle,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.tag != null) {
      yield r'tag';
      yield serializers.serialize(
        object.tag,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'totalValueUsd';
    yield serializers.serialize(
      object.totalValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'pnlUsd';
    yield serializers.serialize(
      object.pnlUsd,
      specifiedType: const FullType(num),
    );
    if (object.pnlLabelKey != null) {
      yield r'pnlLabelKey';
      yield serializers.serialize(
        object.pnlLabelKey,
        specifiedType: const FullType(WhaleDiscoverTraderDtoPnlLabelKeyEnum),
      );
    }
    if (object.trades != null) {
      yield r'trades';
      yield serializers.serialize(
        object.trades,
        specifiedType: const FullType(num),
      );
    }
    if (object.positions != null) {
      yield r'positions';
      yield serializers.serialize(
        object.positions,
        specifiedType: const FullType(num),
      );
    }
    yield r'winRatePct';
    yield serializers.serialize(
      object.winRatePct,
      specifiedType: const FullType(num),
    );
    if (object.winRateLabelKey != null) {
      yield r'winRateLabelKey';
      yield serializers.serialize(
        object.winRateLabelKey,
        specifiedType: const FullType(WhaleDiscoverTraderDtoWinRateLabelKeyEnum),
      );
    }
    yield r'avatarColor';
    yield serializers.serialize(
      object.avatarColor,
      specifiedType: const FullType(String),
    );
    if (object.aiTags != null) {
      yield r'aiTags';
      yield serializers.serialize(
        object.aiTags,
        specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderAiTagDto)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverTraderDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleDiscoverTraderDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'variant':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleDiscoverTraderDtoVariantEnum),
          ) as WhaleDiscoverTraderDtoVariantEnum;
          result.variant = valueDes;
          break;
        case r'address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.address = valueDes;
          break;
        case r'handle':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.handle = valueDes;
          break;
        case r'tag':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.tag = valueDes;
          break;
        case r'totalValueUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalValueUsd = valueDes;
          break;
        case r'pnlUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.pnlUsd = valueDes;
          break;
        case r'pnlLabelKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleDiscoverTraderDtoPnlLabelKeyEnum),
          ) as WhaleDiscoverTraderDtoPnlLabelKeyEnum;
          result.pnlLabelKey = valueDes;
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.trades = valueDes;
          break;
        case r'positions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positions = valueDes;
          break;
        case r'winRatePct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.winRatePct = valueDes;
          break;
        case r'winRateLabelKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleDiscoverTraderDtoWinRateLabelKeyEnum),
          ) as WhaleDiscoverTraderDtoWinRateLabelKeyEnum;
          result.winRateLabelKey = valueDes;
          break;
        case r'avatarColor':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.avatarColor = valueDes;
          break;
        case r'aiTags':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderAiTagDto)]),
          ) as BuiltList<WhaleDiscoverTraderAiTagDto>;
          result.aiTags.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleDiscoverTraderDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleDiscoverTraderDtoBuilder();
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

class WhaleDiscoverTraderDtoVariantEnum extends EnumClass {

  /// 卡片展示变体：推荐卡片或详情卡片
  @BuiltValueEnumConst(wireName: r'recommended')
  static const WhaleDiscoverTraderDtoVariantEnum recommended = _$whaleDiscoverTraderDtoVariantEnum_recommended;
  /// 卡片展示变体：推荐卡片或详情卡片
  @BuiltValueEnumConst(wireName: r'detail')
  static const WhaleDiscoverTraderDtoVariantEnum detail = _$whaleDiscoverTraderDtoVariantEnum_detail;

  static Serializer<WhaleDiscoverTraderDtoVariantEnum> get serializer => _$whaleDiscoverTraderDtoVariantEnumSerializer;

  const WhaleDiscoverTraderDtoVariantEnum._(String name): super(name);

  static BuiltSet<WhaleDiscoverTraderDtoVariantEnum> get values => _$whaleDiscoverTraderDtoVariantEnumValues;
  static WhaleDiscoverTraderDtoVariantEnum valueOf(String name) => _$whaleDiscoverTraderDtoVariantEnumValueOf(name);
}

class WhaleDiscoverTraderDtoPnlLabelKeyEnum extends EnumClass {

  /// 盈亏标签 key，用于前端展示对应时间维度
  @BuiltValueEnumConst(wireName: r'realizedPnl')
  static const WhaleDiscoverTraderDtoPnlLabelKeyEnum realizedPnl = _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl;
  /// 盈亏标签 key，用于前端展示对应时间维度
  @BuiltValueEnumConst(wireName: r'realizedPnl1m')
  static const WhaleDiscoverTraderDtoPnlLabelKeyEnum realizedPnl1m = _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl1m;

  static Serializer<WhaleDiscoverTraderDtoPnlLabelKeyEnum> get serializer => _$whaleDiscoverTraderDtoPnlLabelKeyEnumSerializer;

  const WhaleDiscoverTraderDtoPnlLabelKeyEnum._(String name): super(name);

  static BuiltSet<WhaleDiscoverTraderDtoPnlLabelKeyEnum> get values => _$whaleDiscoverTraderDtoPnlLabelKeyEnumValues;
  static WhaleDiscoverTraderDtoPnlLabelKeyEnum valueOf(String name) => _$whaleDiscoverTraderDtoPnlLabelKeyEnumValueOf(name);
}

class WhaleDiscoverTraderDtoWinRateLabelKeyEnum extends EnumClass {

  /// 胜率标签 key，用于前端展示对应时间维度
  @BuiltValueEnumConst(wireName: r'winRate')
  static const WhaleDiscoverTraderDtoWinRateLabelKeyEnum winRate = _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate;
  /// 胜率标签 key，用于前端展示对应时间维度
  @BuiltValueEnumConst(wireName: r'winRate1m')
  static const WhaleDiscoverTraderDtoWinRateLabelKeyEnum winRate1m = _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate1m;

  static Serializer<WhaleDiscoverTraderDtoWinRateLabelKeyEnum> get serializer => _$whaleDiscoverTraderDtoWinRateLabelKeyEnumSerializer;

  const WhaleDiscoverTraderDtoWinRateLabelKeyEnum._(String name): super(name);

  static BuiltSet<WhaleDiscoverTraderDtoWinRateLabelKeyEnum> get values => _$whaleDiscoverTraderDtoWinRateLabelKeyEnumValues;
  static WhaleDiscoverTraderDtoWinRateLabelKeyEnum valueOf(String name) => _$whaleDiscoverTraderDtoWinRateLabelKeyEnumValueOf(name);
}


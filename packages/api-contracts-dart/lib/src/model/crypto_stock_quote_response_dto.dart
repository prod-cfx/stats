//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'crypto_stock_quote_response_dto.g.dart';

/// CryptoStockQuoteResponseDto
///
/// Properties:
/// * [id] - 记录 ID
/// * [symbol] - 股票代码
/// * [name] - 股票名称
/// * [exchange] - 交易所代码
/// * [price] - 当前价格
/// * [openPrice] - 开盘价
/// * [highPrice] - 最高价
/// * [lowPrice] - 最低价
/// * [closePrice] - 收盘价（前一交易日）
/// * [volume] - 成交量
/// * [turnover] - 成交额
/// * [priceChange] - 涨跌额
/// * [priceChangePercent] - 涨跌幅（百分比）
/// * [marketCap] - 市值
/// * [peRatio] - 市盈率
/// * [high52Week] - 52周最高价
/// * [low52Week] - 52周最低价
/// * [assetSymbol] - 底层加密资产符号（例如 BTC、ETH、USDC），用于币股联动视图
/// * [assetLogoUrl] - 底层加密资产 Logo URL
/// * [companyLogoUrl] - 公司 Logo URL
/// * [holdingsValue] - 持有的加密资产名义价值（可带货币符号，前端可根据需要自行解析）
/// * [holdingsAmount] - 持有的加密资产数量描述（可包含单位和简写，例如 \"671.27K BTC\"）
/// * [mNav] - mNAV（市值/净资产比），字符串形式，前端可按需解析为数值
/// * [holdingValue] - 持仓金额 (USD)，数据库原始值
/// * [holdingQuantity] - 持仓数量，数据库原始值
/// * [companyType] - 公司类型标签
/// * [infoParagraphs] - 公司介绍文案段落列表（用于前端弹窗展示）
/// * [source_] - 数据源
/// * [quoteTimestamp] - 报价时间戳
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class CryptoStockQuoteResponseDto implements Built<CryptoStockQuoteResponseDto, CryptoStockQuoteResponseDtoBuilder> {
  /// 记录 ID
  @BuiltValueField(wireName: r'id')
  num get id;

  /// 股票代码
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 股票名称
  @BuiltValueField(wireName: r'name')
  String? get name;

  /// 交易所代码
  @BuiltValueField(wireName: r'exchange')
  String? get exchange;

  /// 当前价格
  @BuiltValueField(wireName: r'price')
  String get price;

  /// 开盘价
  @BuiltValueField(wireName: r'openPrice')
  String? get openPrice;

  /// 最高价
  @BuiltValueField(wireName: r'highPrice')
  String? get highPrice;

  /// 最低价
  @BuiltValueField(wireName: r'lowPrice')
  String? get lowPrice;

  /// 收盘价（前一交易日）
  @BuiltValueField(wireName: r'closePrice')
  String? get closePrice;

  /// 成交量
  @BuiltValueField(wireName: r'volume')
  String? get volume;

  /// 成交额
  @BuiltValueField(wireName: r'turnover')
  String? get turnover;

  /// 涨跌额
  @BuiltValueField(wireName: r'priceChange')
  String? get priceChange;

  /// 涨跌幅（百分比）
  @BuiltValueField(wireName: r'priceChangePercent')
  String? get priceChangePercent;

  /// 市值
  @BuiltValueField(wireName: r'marketCap')
  String? get marketCap;

  /// 市盈率
  @BuiltValueField(wireName: r'peRatio')
  String? get peRatio;

  /// 52周最高价
  @BuiltValueField(wireName: r'high52Week')
  String? get high52Week;

  /// 52周最低价
  @BuiltValueField(wireName: r'low52Week')
  String? get low52Week;

  /// 底层加密资产符号（例如 BTC、ETH、USDC），用于币股联动视图
  @BuiltValueField(wireName: r'assetSymbol')
  String? get assetSymbol;

  /// 底层加密资产 Logo URL
  @BuiltValueField(wireName: r'assetLogoUrl')
  String? get assetLogoUrl;

  /// 公司 Logo URL
  @BuiltValueField(wireName: r'companyLogoUrl')
  String? get companyLogoUrl;

  /// 持有的加密资产名义价值（可带货币符号，前端可根据需要自行解析）
  @BuiltValueField(wireName: r'holdingsValue')
  String? get holdingsValue;

  /// 持有的加密资产数量描述（可包含单位和简写，例如 \"671.27K BTC\"）
  @BuiltValueField(wireName: r'holdingsAmount')
  String? get holdingsAmount;

  /// mNAV（市值/净资产比），字符串形式，前端可按需解析为数值
  @BuiltValueField(wireName: r'mNav')
  String? get mNav;

  /// 持仓金额 (USD)，数据库原始值
  @BuiltValueField(wireName: r'holdingValue')
  String? get holdingValue;

  /// 持仓数量，数据库原始值
  @BuiltValueField(wireName: r'holdingQuantity')
  String? get holdingQuantity;

  /// 公司类型标签
  @BuiltValueField(wireName: r'companyType')
  String? get companyType;

  /// 公司介绍文案段落列表（用于前端弹窗展示）
  @BuiltValueField(wireName: r'infoParagraphs')
  BuiltList<String>? get infoParagraphs;

  /// 数据源
  @BuiltValueField(wireName: r'source')
  String get source_;

  /// 报价时间戳
  @BuiltValueField(wireName: r'quoteTimestamp')
  DateTime get quoteTimestamp;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  CryptoStockQuoteResponseDto._();

  factory CryptoStockQuoteResponseDto([void updates(CryptoStockQuoteResponseDtoBuilder b)]) = _$CryptoStockQuoteResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CryptoStockQuoteResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CryptoStockQuoteResponseDto> get serializer => _$CryptoStockQuoteResponseDtoSerializer();
}

class _$CryptoStockQuoteResponseDtoSerializer implements PrimitiveSerializer<CryptoStockQuoteResponseDto> {
  @override
  final Iterable<Type> types = const [CryptoStockQuoteResponseDto, _$CryptoStockQuoteResponseDto];

  @override
  final String wireName = r'CryptoStockQuoteResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CryptoStockQuoteResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(num),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.exchange != null) {
      yield r'exchange';
      yield serializers.serialize(
        object.exchange,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(String),
    );
    if (object.openPrice != null) {
      yield r'openPrice';
      yield serializers.serialize(
        object.openPrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.highPrice != null) {
      yield r'highPrice';
      yield serializers.serialize(
        object.highPrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.lowPrice != null) {
      yield r'lowPrice';
      yield serializers.serialize(
        object.lowPrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.closePrice != null) {
      yield r'closePrice';
      yield serializers.serialize(
        object.closePrice,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.volume != null) {
      yield r'volume';
      yield serializers.serialize(
        object.volume,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.turnover != null) {
      yield r'turnover';
      yield serializers.serialize(
        object.turnover,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.priceChange != null) {
      yield r'priceChange';
      yield serializers.serialize(
        object.priceChange,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.priceChangePercent != null) {
      yield r'priceChangePercent';
      yield serializers.serialize(
        object.priceChangePercent,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.marketCap != null) {
      yield r'marketCap';
      yield serializers.serialize(
        object.marketCap,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.peRatio != null) {
      yield r'peRatio';
      yield serializers.serialize(
        object.peRatio,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.high52Week != null) {
      yield r'high52Week';
      yield serializers.serialize(
        object.high52Week,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.low52Week != null) {
      yield r'low52Week';
      yield serializers.serialize(
        object.low52Week,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.assetSymbol != null) {
      yield r'assetSymbol';
      yield serializers.serialize(
        object.assetSymbol,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.assetLogoUrl != null) {
      yield r'assetLogoUrl';
      yield serializers.serialize(
        object.assetLogoUrl,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.companyLogoUrl != null) {
      yield r'companyLogoUrl';
      yield serializers.serialize(
        object.companyLogoUrl,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.holdingsValue != null) {
      yield r'holdingsValue';
      yield serializers.serialize(
        object.holdingsValue,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.holdingsAmount != null) {
      yield r'holdingsAmount';
      yield serializers.serialize(
        object.holdingsAmount,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.mNav != null) {
      yield r'mNav';
      yield serializers.serialize(
        object.mNav,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.holdingValue != null) {
      yield r'holdingValue';
      yield serializers.serialize(
        object.holdingValue,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.holdingQuantity != null) {
      yield r'holdingQuantity';
      yield serializers.serialize(
        object.holdingQuantity,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.companyType != null) {
      yield r'companyType';
      yield serializers.serialize(
        object.companyType,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.infoParagraphs != null) {
      yield r'infoParagraphs';
      yield serializers.serialize(
        object.infoParagraphs,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    yield r'source';
    yield serializers.serialize(
      object.source_,
      specifiedType: const FullType(String),
    );
    yield r'quoteTimestamp';
    yield serializers.serialize(
      object.quoteTimestamp,
      specifiedType: const FullType(DateTime),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CryptoStockQuoteResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CryptoStockQuoteResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.id = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.name = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.exchange = valueDes;
          break;
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.price = valueDes;
          break;
        case r'openPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.openPrice = valueDes;
          break;
        case r'highPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.highPrice = valueDes;
          break;
        case r'lowPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.lowPrice = valueDes;
          break;
        case r'closePrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.closePrice = valueDes;
          break;
        case r'volume':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.volume = valueDes;
          break;
        case r'turnover':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.turnover = valueDes;
          break;
        case r'priceChange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.priceChange = valueDes;
          break;
        case r'priceChangePercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.priceChangePercent = valueDes;
          break;
        case r'marketCap':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.marketCap = valueDes;
          break;
        case r'peRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.peRatio = valueDes;
          break;
        case r'high52Week':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.high52Week = valueDes;
          break;
        case r'low52Week':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.low52Week = valueDes;
          break;
        case r'assetSymbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.assetSymbol = valueDes;
          break;
        case r'assetLogoUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.assetLogoUrl = valueDes;
          break;
        case r'companyLogoUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.companyLogoUrl = valueDes;
          break;
        case r'holdingsValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.holdingsValue = valueDes;
          break;
        case r'holdingsAmount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.holdingsAmount = valueDes;
          break;
        case r'mNav':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.mNav = valueDes;
          break;
        case r'holdingValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.holdingValue = valueDes;
          break;
        case r'holdingQuantity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.holdingQuantity = valueDes;
          break;
        case r'companyType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.companyType = valueDes;
          break;
        case r'infoParagraphs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.infoParagraphs.replace(valueDes);
          break;
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.source_ = valueDes;
          break;
        case r'quoteTimestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.quoteTimestamp = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CryptoStockQuoteResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CryptoStockQuoteResponseDtoBuilder();
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


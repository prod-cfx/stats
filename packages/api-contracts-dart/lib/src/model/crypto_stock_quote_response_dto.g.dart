// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'crypto_stock_quote_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CryptoStockQuoteResponseDto extends CryptoStockQuoteResponseDto {
  @override
  final num id;
  @override
  final String symbol;
  @override
  final String? name;
  @override
  final String? exchange;
  @override
  final String price;
  @override
  final String? openPrice;
  @override
  final String? highPrice;
  @override
  final String? lowPrice;
  @override
  final String? closePrice;
  @override
  final String? volume;
  @override
  final String? turnover;
  @override
  final String? priceChange;
  @override
  final String? priceChangePercent;
  @override
  final String? marketCap;
  @override
  final String? peRatio;
  @override
  final String? high52Week;
  @override
  final String? low52Week;
  @override
  final String? assetSymbol;
  @override
  final String? assetLogoUrl;
  @override
  final String? companyLogoUrl;
  @override
  final String? holdingsValue;
  @override
  final String? holdingsAmount;
  @override
  final String? mNav;
  @override
  final String? holdingValue;
  @override
  final String? holdingQuantity;
  @override
  final String? companyType;
  @override
  final BuiltList<String>? infoParagraphs;
  @override
  final String source_;
  @override
  final DateTime quoteTimestamp;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$CryptoStockQuoteResponseDto([
    void Function(CryptoStockQuoteResponseDtoBuilder)? updates,
  ]) => (CryptoStockQuoteResponseDtoBuilder()..update(updates))._build();

  _$CryptoStockQuoteResponseDto._({
    required this.id,
    required this.symbol,
    this.name,
    this.exchange,
    required this.price,
    this.openPrice,
    this.highPrice,
    this.lowPrice,
    this.closePrice,
    this.volume,
    this.turnover,
    this.priceChange,
    this.priceChangePercent,
    this.marketCap,
    this.peRatio,
    this.high52Week,
    this.low52Week,
    this.assetSymbol,
    this.assetLogoUrl,
    this.companyLogoUrl,
    this.holdingsValue,
    this.holdingsAmount,
    this.mNav,
    this.holdingValue,
    this.holdingQuantity,
    this.companyType,
    this.infoParagraphs,
    required this.source_,
    required this.quoteTimestamp,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  CryptoStockQuoteResponseDto rebuild(
    void Function(CryptoStockQuoteResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CryptoStockQuoteResponseDtoBuilder toBuilder() =>
      CryptoStockQuoteResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CryptoStockQuoteResponseDto &&
        id == other.id &&
        symbol == other.symbol &&
        name == other.name &&
        exchange == other.exchange &&
        price == other.price &&
        openPrice == other.openPrice &&
        highPrice == other.highPrice &&
        lowPrice == other.lowPrice &&
        closePrice == other.closePrice &&
        volume == other.volume &&
        turnover == other.turnover &&
        priceChange == other.priceChange &&
        priceChangePercent == other.priceChangePercent &&
        marketCap == other.marketCap &&
        peRatio == other.peRatio &&
        high52Week == other.high52Week &&
        low52Week == other.low52Week &&
        assetSymbol == other.assetSymbol &&
        assetLogoUrl == other.assetLogoUrl &&
        companyLogoUrl == other.companyLogoUrl &&
        holdingsValue == other.holdingsValue &&
        holdingsAmount == other.holdingsAmount &&
        mNav == other.mNav &&
        holdingValue == other.holdingValue &&
        holdingQuantity == other.holdingQuantity &&
        companyType == other.companyType &&
        infoParagraphs == other.infoParagraphs &&
        source_ == other.source_ &&
        quoteTimestamp == other.quoteTimestamp &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, openPrice.hashCode);
    _$hash = $jc(_$hash, highPrice.hashCode);
    _$hash = $jc(_$hash, lowPrice.hashCode);
    _$hash = $jc(_$hash, closePrice.hashCode);
    _$hash = $jc(_$hash, volume.hashCode);
    _$hash = $jc(_$hash, turnover.hashCode);
    _$hash = $jc(_$hash, priceChange.hashCode);
    _$hash = $jc(_$hash, priceChangePercent.hashCode);
    _$hash = $jc(_$hash, marketCap.hashCode);
    _$hash = $jc(_$hash, peRatio.hashCode);
    _$hash = $jc(_$hash, high52Week.hashCode);
    _$hash = $jc(_$hash, low52Week.hashCode);
    _$hash = $jc(_$hash, assetSymbol.hashCode);
    _$hash = $jc(_$hash, assetLogoUrl.hashCode);
    _$hash = $jc(_$hash, companyLogoUrl.hashCode);
    _$hash = $jc(_$hash, holdingsValue.hashCode);
    _$hash = $jc(_$hash, holdingsAmount.hashCode);
    _$hash = $jc(_$hash, mNav.hashCode);
    _$hash = $jc(_$hash, holdingValue.hashCode);
    _$hash = $jc(_$hash, holdingQuantity.hashCode);
    _$hash = $jc(_$hash, companyType.hashCode);
    _$hash = $jc(_$hash, infoParagraphs.hashCode);
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, quoteTimestamp.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CryptoStockQuoteResponseDto')
          ..add('id', id)
          ..add('symbol', symbol)
          ..add('name', name)
          ..add('exchange', exchange)
          ..add('price', price)
          ..add('openPrice', openPrice)
          ..add('highPrice', highPrice)
          ..add('lowPrice', lowPrice)
          ..add('closePrice', closePrice)
          ..add('volume', volume)
          ..add('turnover', turnover)
          ..add('priceChange', priceChange)
          ..add('priceChangePercent', priceChangePercent)
          ..add('marketCap', marketCap)
          ..add('peRatio', peRatio)
          ..add('high52Week', high52Week)
          ..add('low52Week', low52Week)
          ..add('assetSymbol', assetSymbol)
          ..add('assetLogoUrl', assetLogoUrl)
          ..add('companyLogoUrl', companyLogoUrl)
          ..add('holdingsValue', holdingsValue)
          ..add('holdingsAmount', holdingsAmount)
          ..add('mNav', mNav)
          ..add('holdingValue', holdingValue)
          ..add('holdingQuantity', holdingQuantity)
          ..add('companyType', companyType)
          ..add('infoParagraphs', infoParagraphs)
          ..add('source_', source_)
          ..add('quoteTimestamp', quoteTimestamp)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class CryptoStockQuoteResponseDtoBuilder
    implements
        Builder<
          CryptoStockQuoteResponseDto,
          CryptoStockQuoteResponseDtoBuilder
        > {
  _$CryptoStockQuoteResponseDto? _$v;

  num? _id;
  num? get id => _$this._id;
  set id(num? id) => _$this._id = id;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _price;
  String? get price => _$this._price;
  set price(String? price) => _$this._price = price;

  String? _openPrice;
  String? get openPrice => _$this._openPrice;
  set openPrice(String? openPrice) => _$this._openPrice = openPrice;

  String? _highPrice;
  String? get highPrice => _$this._highPrice;
  set highPrice(String? highPrice) => _$this._highPrice = highPrice;

  String? _lowPrice;
  String? get lowPrice => _$this._lowPrice;
  set lowPrice(String? lowPrice) => _$this._lowPrice = lowPrice;

  String? _closePrice;
  String? get closePrice => _$this._closePrice;
  set closePrice(String? closePrice) => _$this._closePrice = closePrice;

  String? _volume;
  String? get volume => _$this._volume;
  set volume(String? volume) => _$this._volume = volume;

  String? _turnover;
  String? get turnover => _$this._turnover;
  set turnover(String? turnover) => _$this._turnover = turnover;

  String? _priceChange;
  String? get priceChange => _$this._priceChange;
  set priceChange(String? priceChange) => _$this._priceChange = priceChange;

  String? _priceChangePercent;
  String? get priceChangePercent => _$this._priceChangePercent;
  set priceChangePercent(String? priceChangePercent) =>
      _$this._priceChangePercent = priceChangePercent;

  String? _marketCap;
  String? get marketCap => _$this._marketCap;
  set marketCap(String? marketCap) => _$this._marketCap = marketCap;

  String? _peRatio;
  String? get peRatio => _$this._peRatio;
  set peRatio(String? peRatio) => _$this._peRatio = peRatio;

  String? _high52Week;
  String? get high52Week => _$this._high52Week;
  set high52Week(String? high52Week) => _$this._high52Week = high52Week;

  String? _low52Week;
  String? get low52Week => _$this._low52Week;
  set low52Week(String? low52Week) => _$this._low52Week = low52Week;

  String? _assetSymbol;
  String? get assetSymbol => _$this._assetSymbol;
  set assetSymbol(String? assetSymbol) => _$this._assetSymbol = assetSymbol;

  String? _assetLogoUrl;
  String? get assetLogoUrl => _$this._assetLogoUrl;
  set assetLogoUrl(String? assetLogoUrl) => _$this._assetLogoUrl = assetLogoUrl;

  String? _companyLogoUrl;
  String? get companyLogoUrl => _$this._companyLogoUrl;
  set companyLogoUrl(String? companyLogoUrl) =>
      _$this._companyLogoUrl = companyLogoUrl;

  String? _holdingsValue;
  String? get holdingsValue => _$this._holdingsValue;
  set holdingsValue(String? holdingsValue) =>
      _$this._holdingsValue = holdingsValue;

  String? _holdingsAmount;
  String? get holdingsAmount => _$this._holdingsAmount;
  set holdingsAmount(String? holdingsAmount) =>
      _$this._holdingsAmount = holdingsAmount;

  String? _mNav;
  String? get mNav => _$this._mNav;
  set mNav(String? mNav) => _$this._mNav = mNav;

  String? _holdingValue;
  String? get holdingValue => _$this._holdingValue;
  set holdingValue(String? holdingValue) => _$this._holdingValue = holdingValue;

  String? _holdingQuantity;
  String? get holdingQuantity => _$this._holdingQuantity;
  set holdingQuantity(String? holdingQuantity) =>
      _$this._holdingQuantity = holdingQuantity;

  String? _companyType;
  String? get companyType => _$this._companyType;
  set companyType(String? companyType) => _$this._companyType = companyType;

  ListBuilder<String>? _infoParagraphs;
  ListBuilder<String> get infoParagraphs =>
      _$this._infoParagraphs ??= ListBuilder<String>();
  set infoParagraphs(ListBuilder<String>? infoParagraphs) =>
      _$this._infoParagraphs = infoParagraphs;

  String? _source_;
  String? get source_ => _$this._source_;
  set source_(String? source_) => _$this._source_ = source_;

  DateTime? _quoteTimestamp;
  DateTime? get quoteTimestamp => _$this._quoteTimestamp;
  set quoteTimestamp(DateTime? quoteTimestamp) =>
      _$this._quoteTimestamp = quoteTimestamp;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  CryptoStockQuoteResponseDtoBuilder() {
    CryptoStockQuoteResponseDto._defaults(this);
  }

  CryptoStockQuoteResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _symbol = $v.symbol;
      _name = $v.name;
      _exchange = $v.exchange;
      _price = $v.price;
      _openPrice = $v.openPrice;
      _highPrice = $v.highPrice;
      _lowPrice = $v.lowPrice;
      _closePrice = $v.closePrice;
      _volume = $v.volume;
      _turnover = $v.turnover;
      _priceChange = $v.priceChange;
      _priceChangePercent = $v.priceChangePercent;
      _marketCap = $v.marketCap;
      _peRatio = $v.peRatio;
      _high52Week = $v.high52Week;
      _low52Week = $v.low52Week;
      _assetSymbol = $v.assetSymbol;
      _assetLogoUrl = $v.assetLogoUrl;
      _companyLogoUrl = $v.companyLogoUrl;
      _holdingsValue = $v.holdingsValue;
      _holdingsAmount = $v.holdingsAmount;
      _mNav = $v.mNav;
      _holdingValue = $v.holdingValue;
      _holdingQuantity = $v.holdingQuantity;
      _companyType = $v.companyType;
      _infoParagraphs = $v.infoParagraphs?.toBuilder();
      _source_ = $v.source_;
      _quoteTimestamp = $v.quoteTimestamp;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CryptoStockQuoteResponseDto other) {
    _$v = other as _$CryptoStockQuoteResponseDto;
  }

  @override
  void update(void Function(CryptoStockQuoteResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CryptoStockQuoteResponseDto build() => _build();

  _$CryptoStockQuoteResponseDto _build() {
    _$CryptoStockQuoteResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$CryptoStockQuoteResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'CryptoStockQuoteResponseDto',
              'id',
            ),
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'CryptoStockQuoteResponseDto',
              'symbol',
            ),
            name: name,
            exchange: exchange,
            price: BuiltValueNullFieldError.checkNotNull(
              price,
              r'CryptoStockQuoteResponseDto',
              'price',
            ),
            openPrice: openPrice,
            highPrice: highPrice,
            lowPrice: lowPrice,
            closePrice: closePrice,
            volume: volume,
            turnover: turnover,
            priceChange: priceChange,
            priceChangePercent: priceChangePercent,
            marketCap: marketCap,
            peRatio: peRatio,
            high52Week: high52Week,
            low52Week: low52Week,
            assetSymbol: assetSymbol,
            assetLogoUrl: assetLogoUrl,
            companyLogoUrl: companyLogoUrl,
            holdingsValue: holdingsValue,
            holdingsAmount: holdingsAmount,
            mNav: mNav,
            holdingValue: holdingValue,
            holdingQuantity: holdingQuantity,
            companyType: companyType,
            infoParagraphs: _infoParagraphs?.build(),
            source_: BuiltValueNullFieldError.checkNotNull(
              source_,
              r'CryptoStockQuoteResponseDto',
              'source_',
            ),
            quoteTimestamp: BuiltValueNullFieldError.checkNotNull(
              quoteTimestamp,
              r'CryptoStockQuoteResponseDto',
              'quoteTimestamp',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'CryptoStockQuoteResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'CryptoStockQuoteResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'infoParagraphs';
        _infoParagraphs?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CryptoStockQuoteResponseDto',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

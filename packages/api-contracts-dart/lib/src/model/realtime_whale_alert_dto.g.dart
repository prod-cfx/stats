// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'realtime_whale_alert_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RealtimeWhaleAlertDto extends RealtimeWhaleAlertDto {
  @override
  final String userAddress;
  @override
  final String symbol;
  @override
  final num positionSize;
  @override
  final num entryPrice;
  @override
  final num liqPrice;
  @override
  final num positionValueUsd;
  @override
  final num positionAction;
  @override
  final String createTime;
  @override
  final WhaleAlertSide side;

  factory _$RealtimeWhaleAlertDto([
    void Function(RealtimeWhaleAlertDtoBuilder)? updates,
  ]) => (RealtimeWhaleAlertDtoBuilder()..update(updates))._build();

  _$RealtimeWhaleAlertDto._({
    required this.userAddress,
    required this.symbol,
    required this.positionSize,
    required this.entryPrice,
    required this.liqPrice,
    required this.positionValueUsd,
    required this.positionAction,
    required this.createTime,
    required this.side,
  }) : super._();
  @override
  RealtimeWhaleAlertDto rebuild(
    void Function(RealtimeWhaleAlertDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  RealtimeWhaleAlertDtoBuilder toBuilder() =>
      RealtimeWhaleAlertDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RealtimeWhaleAlertDto &&
        userAddress == other.userAddress &&
        symbol == other.symbol &&
        positionSize == other.positionSize &&
        entryPrice == other.entryPrice &&
        liqPrice == other.liqPrice &&
        positionValueUsd == other.positionValueUsd &&
        positionAction == other.positionAction &&
        createTime == other.createTime &&
        side == other.side;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userAddress.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, positionSize.hashCode);
    _$hash = $jc(_$hash, entryPrice.hashCode);
    _$hash = $jc(_$hash, liqPrice.hashCode);
    _$hash = $jc(_$hash, positionValueUsd.hashCode);
    _$hash = $jc(_$hash, positionAction.hashCode);
    _$hash = $jc(_$hash, createTime.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RealtimeWhaleAlertDto')
          ..add('userAddress', userAddress)
          ..add('symbol', symbol)
          ..add('positionSize', positionSize)
          ..add('entryPrice', entryPrice)
          ..add('liqPrice', liqPrice)
          ..add('positionValueUsd', positionValueUsd)
          ..add('positionAction', positionAction)
          ..add('createTime', createTime)
          ..add('side', side))
        .toString();
  }
}

class RealtimeWhaleAlertDtoBuilder
    implements Builder<RealtimeWhaleAlertDto, RealtimeWhaleAlertDtoBuilder> {
  _$RealtimeWhaleAlertDto? _$v;

  String? _userAddress;
  String? get userAddress => _$this._userAddress;
  set userAddress(String? userAddress) => _$this._userAddress = userAddress;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  num? _positionSize;
  num? get positionSize => _$this._positionSize;
  set positionSize(num? positionSize) => _$this._positionSize = positionSize;

  num? _entryPrice;
  num? get entryPrice => _$this._entryPrice;
  set entryPrice(num? entryPrice) => _$this._entryPrice = entryPrice;

  num? _liqPrice;
  num? get liqPrice => _$this._liqPrice;
  set liqPrice(num? liqPrice) => _$this._liqPrice = liqPrice;

  num? _positionValueUsd;
  num? get positionValueUsd => _$this._positionValueUsd;
  set positionValueUsd(num? positionValueUsd) =>
      _$this._positionValueUsd = positionValueUsd;

  num? _positionAction;
  num? get positionAction => _$this._positionAction;
  set positionAction(num? positionAction) =>
      _$this._positionAction = positionAction;

  String? _createTime;
  String? get createTime => _$this._createTime;
  set createTime(String? createTime) => _$this._createTime = createTime;

  WhaleAlertSide? _side;
  WhaleAlertSide? get side => _$this._side;
  set side(WhaleAlertSide? side) => _$this._side = side;

  RealtimeWhaleAlertDtoBuilder() {
    RealtimeWhaleAlertDto._defaults(this);
  }

  RealtimeWhaleAlertDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userAddress = $v.userAddress;
      _symbol = $v.symbol;
      _positionSize = $v.positionSize;
      _entryPrice = $v.entryPrice;
      _liqPrice = $v.liqPrice;
      _positionValueUsd = $v.positionValueUsd;
      _positionAction = $v.positionAction;
      _createTime = $v.createTime;
      _side = $v.side;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RealtimeWhaleAlertDto other) {
    _$v = other as _$RealtimeWhaleAlertDto;
  }

  @override
  void update(void Function(RealtimeWhaleAlertDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RealtimeWhaleAlertDto build() => _build();

  _$RealtimeWhaleAlertDto _build() {
    final _$result =
        _$v ??
        _$RealtimeWhaleAlertDto._(
          userAddress: BuiltValueNullFieldError.checkNotNull(
            userAddress,
            r'RealtimeWhaleAlertDto',
            'userAddress',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'RealtimeWhaleAlertDto',
            'symbol',
          ),
          positionSize: BuiltValueNullFieldError.checkNotNull(
            positionSize,
            r'RealtimeWhaleAlertDto',
            'positionSize',
          ),
          entryPrice: BuiltValueNullFieldError.checkNotNull(
            entryPrice,
            r'RealtimeWhaleAlertDto',
            'entryPrice',
          ),
          liqPrice: BuiltValueNullFieldError.checkNotNull(
            liqPrice,
            r'RealtimeWhaleAlertDto',
            'liqPrice',
          ),
          positionValueUsd: BuiltValueNullFieldError.checkNotNull(
            positionValueUsd,
            r'RealtimeWhaleAlertDto',
            'positionValueUsd',
          ),
          positionAction: BuiltValueNullFieldError.checkNotNull(
            positionAction,
            r'RealtimeWhaleAlertDto',
            'positionAction',
          ),
          createTime: BuiltValueNullFieldError.checkNotNull(
            createTime,
            r'RealtimeWhaleAlertDto',
            'createTime',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'RealtimeWhaleAlertDto',
            'side',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

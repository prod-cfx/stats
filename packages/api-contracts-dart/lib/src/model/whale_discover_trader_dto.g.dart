// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_discover_trader_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleDiscoverTraderDtoVariantEnum
_$whaleDiscoverTraderDtoVariantEnum_recommended =
    const WhaleDiscoverTraderDtoVariantEnum._('recommended');
const WhaleDiscoverTraderDtoVariantEnum
_$whaleDiscoverTraderDtoVariantEnum_detail =
    const WhaleDiscoverTraderDtoVariantEnum._('detail');

WhaleDiscoverTraderDtoVariantEnum _$whaleDiscoverTraderDtoVariantEnumValueOf(
  String name,
) {
  switch (name) {
    case 'recommended':
      return _$whaleDiscoverTraderDtoVariantEnum_recommended;
    case 'detail':
      return _$whaleDiscoverTraderDtoVariantEnum_detail;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleDiscoverTraderDtoVariantEnum>
_$whaleDiscoverTraderDtoVariantEnumValues =
    BuiltSet<WhaleDiscoverTraderDtoVariantEnum>(
      const <WhaleDiscoverTraderDtoVariantEnum>[
        _$whaleDiscoverTraderDtoVariantEnum_recommended,
        _$whaleDiscoverTraderDtoVariantEnum_detail,
      ],
    );

const WhaleDiscoverTraderDtoPnlLabelKeyEnum
_$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl =
    const WhaleDiscoverTraderDtoPnlLabelKeyEnum._('realizedPnl');
const WhaleDiscoverTraderDtoPnlLabelKeyEnum
_$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl1m =
    const WhaleDiscoverTraderDtoPnlLabelKeyEnum._('realizedPnl1m');

WhaleDiscoverTraderDtoPnlLabelKeyEnum
_$whaleDiscoverTraderDtoPnlLabelKeyEnumValueOf(String name) {
  switch (name) {
    case 'realizedPnl':
      return _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl;
    case 'realizedPnl1m':
      return _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl1m;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleDiscoverTraderDtoPnlLabelKeyEnum>
_$whaleDiscoverTraderDtoPnlLabelKeyEnumValues =
    BuiltSet<WhaleDiscoverTraderDtoPnlLabelKeyEnum>(
      const <WhaleDiscoverTraderDtoPnlLabelKeyEnum>[
        _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl,
        _$whaleDiscoverTraderDtoPnlLabelKeyEnum_realizedPnl1m,
      ],
    );

const WhaleDiscoverTraderDtoWinRateLabelKeyEnum
_$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate =
    const WhaleDiscoverTraderDtoWinRateLabelKeyEnum._('winRate');
const WhaleDiscoverTraderDtoWinRateLabelKeyEnum
_$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate1m =
    const WhaleDiscoverTraderDtoWinRateLabelKeyEnum._('winRate1m');

WhaleDiscoverTraderDtoWinRateLabelKeyEnum
_$whaleDiscoverTraderDtoWinRateLabelKeyEnumValueOf(String name) {
  switch (name) {
    case 'winRate':
      return _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate;
    case 'winRate1m':
      return _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate1m;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleDiscoverTraderDtoWinRateLabelKeyEnum>
_$whaleDiscoverTraderDtoWinRateLabelKeyEnumValues =
    BuiltSet<WhaleDiscoverTraderDtoWinRateLabelKeyEnum>(
      const <WhaleDiscoverTraderDtoWinRateLabelKeyEnum>[
        _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate,
        _$whaleDiscoverTraderDtoWinRateLabelKeyEnum_winRate1m,
      ],
    );

Serializer<WhaleDiscoverTraderDtoVariantEnum>
_$whaleDiscoverTraderDtoVariantEnumSerializer =
    _$WhaleDiscoverTraderDtoVariantEnumSerializer();
Serializer<WhaleDiscoverTraderDtoPnlLabelKeyEnum>
_$whaleDiscoverTraderDtoPnlLabelKeyEnumSerializer =
    _$WhaleDiscoverTraderDtoPnlLabelKeyEnumSerializer();
Serializer<WhaleDiscoverTraderDtoWinRateLabelKeyEnum>
_$whaleDiscoverTraderDtoWinRateLabelKeyEnumSerializer =
    _$WhaleDiscoverTraderDtoWinRateLabelKeyEnumSerializer();

class _$WhaleDiscoverTraderDtoVariantEnumSerializer
    implements PrimitiveSerializer<WhaleDiscoverTraderDtoVariantEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'recommended': 'recommended',
    'detail': 'detail',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'recommended': 'recommended',
    'detail': 'detail',
  };

  @override
  final Iterable<Type> types = const <Type>[WhaleDiscoverTraderDtoVariantEnum];
  @override
  final String wireName = 'WhaleDiscoverTraderDtoVariantEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverTraderDtoVariantEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleDiscoverTraderDtoVariantEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleDiscoverTraderDtoVariantEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleDiscoverTraderDtoPnlLabelKeyEnumSerializer
    implements PrimitiveSerializer<WhaleDiscoverTraderDtoPnlLabelKeyEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'realizedPnl': 'realizedPnl',
    'realizedPnl1m': 'realizedPnl1m',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'realizedPnl': 'realizedPnl',
    'realizedPnl1m': 'realizedPnl1m',
  };

  @override
  final Iterable<Type> types = const <Type>[
    WhaleDiscoverTraderDtoPnlLabelKeyEnum,
  ];
  @override
  final String wireName = 'WhaleDiscoverTraderDtoPnlLabelKeyEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverTraderDtoPnlLabelKeyEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleDiscoverTraderDtoPnlLabelKeyEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleDiscoverTraderDtoPnlLabelKeyEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleDiscoverTraderDtoWinRateLabelKeyEnumSerializer
    implements PrimitiveSerializer<WhaleDiscoverTraderDtoWinRateLabelKeyEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'winRate': 'winRate',
    'winRate1m': 'winRate1m',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'winRate': 'winRate',
    'winRate1m': 'winRate1m',
  };

  @override
  final Iterable<Type> types = const <Type>[
    WhaleDiscoverTraderDtoWinRateLabelKeyEnum,
  ];
  @override
  final String wireName = 'WhaleDiscoverTraderDtoWinRateLabelKeyEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverTraderDtoWinRateLabelKeyEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleDiscoverTraderDtoWinRateLabelKeyEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleDiscoverTraderDtoWinRateLabelKeyEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleDiscoverTraderDto extends WhaleDiscoverTraderDto {
  @override
  final WhaleDiscoverTraderDtoVariantEnum variant;
  @override
  final String address;
  @override
  final String? handle;
  @override
  final String? tag;
  @override
  final num totalValueUsd;
  @override
  final num pnlUsd;
  @override
  final WhaleDiscoverTraderDtoPnlLabelKeyEnum? pnlLabelKey;
  @override
  final num? trades;
  @override
  final num? positions;
  @override
  final num winRatePct;
  @override
  final WhaleDiscoverTraderDtoWinRateLabelKeyEnum? winRateLabelKey;
  @override
  final String avatarColor;
  @override
  final BuiltList<WhaleDiscoverTraderAiTagDto>? aiTags;

  factory _$WhaleDiscoverTraderDto([
    void Function(WhaleDiscoverTraderDtoBuilder)? updates,
  ]) => (WhaleDiscoverTraderDtoBuilder()..update(updates))._build();

  _$WhaleDiscoverTraderDto._({
    required this.variant,
    required this.address,
    this.handle,
    this.tag,
    required this.totalValueUsd,
    required this.pnlUsd,
    this.pnlLabelKey,
    this.trades,
    this.positions,
    required this.winRatePct,
    this.winRateLabelKey,
    required this.avatarColor,
    this.aiTags,
  }) : super._();
  @override
  WhaleDiscoverTraderDto rebuild(
    void Function(WhaleDiscoverTraderDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleDiscoverTraderDtoBuilder toBuilder() =>
      WhaleDiscoverTraderDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleDiscoverTraderDto &&
        variant == other.variant &&
        address == other.address &&
        handle == other.handle &&
        tag == other.tag &&
        totalValueUsd == other.totalValueUsd &&
        pnlUsd == other.pnlUsd &&
        pnlLabelKey == other.pnlLabelKey &&
        trades == other.trades &&
        positions == other.positions &&
        winRatePct == other.winRatePct &&
        winRateLabelKey == other.winRateLabelKey &&
        avatarColor == other.avatarColor &&
        aiTags == other.aiTags;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, variant.hashCode);
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, handle.hashCode);
    _$hash = $jc(_$hash, tag.hashCode);
    _$hash = $jc(_$hash, totalValueUsd.hashCode);
    _$hash = $jc(_$hash, pnlUsd.hashCode);
    _$hash = $jc(_$hash, pnlLabelKey.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jc(_$hash, positions.hashCode);
    _$hash = $jc(_$hash, winRatePct.hashCode);
    _$hash = $jc(_$hash, winRateLabelKey.hashCode);
    _$hash = $jc(_$hash, avatarColor.hashCode);
    _$hash = $jc(_$hash, aiTags.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleDiscoverTraderDto')
          ..add('variant', variant)
          ..add('address', address)
          ..add('handle', handle)
          ..add('tag', tag)
          ..add('totalValueUsd', totalValueUsd)
          ..add('pnlUsd', pnlUsd)
          ..add('pnlLabelKey', pnlLabelKey)
          ..add('trades', trades)
          ..add('positions', positions)
          ..add('winRatePct', winRatePct)
          ..add('winRateLabelKey', winRateLabelKey)
          ..add('avatarColor', avatarColor)
          ..add('aiTags', aiTags))
        .toString();
  }
}

class WhaleDiscoverTraderDtoBuilder
    implements Builder<WhaleDiscoverTraderDto, WhaleDiscoverTraderDtoBuilder> {
  _$WhaleDiscoverTraderDto? _$v;

  WhaleDiscoverTraderDtoVariantEnum? _variant;
  WhaleDiscoverTraderDtoVariantEnum? get variant => _$this._variant;
  set variant(WhaleDiscoverTraderDtoVariantEnum? variant) =>
      _$this._variant = variant;

  String? _address;
  String? get address => _$this._address;
  set address(String? address) => _$this._address = address;

  String? _handle;
  String? get handle => _$this._handle;
  set handle(String? handle) => _$this._handle = handle;

  String? _tag;
  String? get tag => _$this._tag;
  set tag(String? tag) => _$this._tag = tag;

  num? _totalValueUsd;
  num? get totalValueUsd => _$this._totalValueUsd;
  set totalValueUsd(num? totalValueUsd) =>
      _$this._totalValueUsd = totalValueUsd;

  num? _pnlUsd;
  num? get pnlUsd => _$this._pnlUsd;
  set pnlUsd(num? pnlUsd) => _$this._pnlUsd = pnlUsd;

  WhaleDiscoverTraderDtoPnlLabelKeyEnum? _pnlLabelKey;
  WhaleDiscoverTraderDtoPnlLabelKeyEnum? get pnlLabelKey => _$this._pnlLabelKey;
  set pnlLabelKey(WhaleDiscoverTraderDtoPnlLabelKeyEnum? pnlLabelKey) =>
      _$this._pnlLabelKey = pnlLabelKey;

  num? _trades;
  num? get trades => _$this._trades;
  set trades(num? trades) => _$this._trades = trades;

  num? _positions;
  num? get positions => _$this._positions;
  set positions(num? positions) => _$this._positions = positions;

  num? _winRatePct;
  num? get winRatePct => _$this._winRatePct;
  set winRatePct(num? winRatePct) => _$this._winRatePct = winRatePct;

  WhaleDiscoverTraderDtoWinRateLabelKeyEnum? _winRateLabelKey;
  WhaleDiscoverTraderDtoWinRateLabelKeyEnum? get winRateLabelKey =>
      _$this._winRateLabelKey;
  set winRateLabelKey(
    WhaleDiscoverTraderDtoWinRateLabelKeyEnum? winRateLabelKey,
  ) => _$this._winRateLabelKey = winRateLabelKey;

  String? _avatarColor;
  String? get avatarColor => _$this._avatarColor;
  set avatarColor(String? avatarColor) => _$this._avatarColor = avatarColor;

  ListBuilder<WhaleDiscoverTraderAiTagDto>? _aiTags;
  ListBuilder<WhaleDiscoverTraderAiTagDto> get aiTags =>
      _$this._aiTags ??= ListBuilder<WhaleDiscoverTraderAiTagDto>();
  set aiTags(ListBuilder<WhaleDiscoverTraderAiTagDto>? aiTags) =>
      _$this._aiTags = aiTags;

  WhaleDiscoverTraderDtoBuilder() {
    WhaleDiscoverTraderDto._defaults(this);
  }

  WhaleDiscoverTraderDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _variant = $v.variant;
      _address = $v.address;
      _handle = $v.handle;
      _tag = $v.tag;
      _totalValueUsd = $v.totalValueUsd;
      _pnlUsd = $v.pnlUsd;
      _pnlLabelKey = $v.pnlLabelKey;
      _trades = $v.trades;
      _positions = $v.positions;
      _winRatePct = $v.winRatePct;
      _winRateLabelKey = $v.winRateLabelKey;
      _avatarColor = $v.avatarColor;
      _aiTags = $v.aiTags?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleDiscoverTraderDto other) {
    _$v = other as _$WhaleDiscoverTraderDto;
  }

  @override
  void update(void Function(WhaleDiscoverTraderDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleDiscoverTraderDto build() => _build();

  _$WhaleDiscoverTraderDto _build() {
    _$WhaleDiscoverTraderDto _$result;
    try {
      _$result =
          _$v ??
          _$WhaleDiscoverTraderDto._(
            variant: BuiltValueNullFieldError.checkNotNull(
              variant,
              r'WhaleDiscoverTraderDto',
              'variant',
            ),
            address: BuiltValueNullFieldError.checkNotNull(
              address,
              r'WhaleDiscoverTraderDto',
              'address',
            ),
            handle: handle,
            tag: tag,
            totalValueUsd: BuiltValueNullFieldError.checkNotNull(
              totalValueUsd,
              r'WhaleDiscoverTraderDto',
              'totalValueUsd',
            ),
            pnlUsd: BuiltValueNullFieldError.checkNotNull(
              pnlUsd,
              r'WhaleDiscoverTraderDto',
              'pnlUsd',
            ),
            pnlLabelKey: pnlLabelKey,
            trades: trades,
            positions: positions,
            winRatePct: BuiltValueNullFieldError.checkNotNull(
              winRatePct,
              r'WhaleDiscoverTraderDto',
              'winRatePct',
            ),
            winRateLabelKey: winRateLabelKey,
            avatarColor: BuiltValueNullFieldError.checkNotNull(
              avatarColor,
              r'WhaleDiscoverTraderDto',
              'avatarColor',
            ),
            aiTags: _aiTags?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'aiTags';
        _aiTags?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'WhaleDiscoverTraderDto',
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

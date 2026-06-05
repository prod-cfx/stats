// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_market_card_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$PredictionMarketCardDto extends PredictionMarketCardDto {
  @override
  final String id;
  @override
  final String title;
  @override
  final BuiltList<PredictionMarketOutcomeDto>? options;
  @override
  final String? probability;
  @override
  final String? status;
  @override
  final String? volume24h;
  @override
  final String? volumeTotal;
  @override
  final String? openInterest;
  @override
  final PredictionMarketRulesDto? rules;

  factory _$PredictionMarketCardDto([
    void Function(PredictionMarketCardDtoBuilder)? updates,
  ]) => (PredictionMarketCardDtoBuilder()..update(updates))._build();

  _$PredictionMarketCardDto._({
    required this.id,
    required this.title,
    this.options,
    this.probability,
    this.status,
    this.volume24h,
    this.volumeTotal,
    this.openInterest,
    this.rules,
  }) : super._();
  @override
  PredictionMarketCardDto rebuild(
    void Function(PredictionMarketCardDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  PredictionMarketCardDtoBuilder toBuilder() =>
      PredictionMarketCardDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PredictionMarketCardDto &&
        id == other.id &&
        title == other.title &&
        options == other.options &&
        probability == other.probability &&
        status == other.status &&
        volume24h == other.volume24h &&
        volumeTotal == other.volumeTotal &&
        openInterest == other.openInterest &&
        rules == other.rules;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, title.hashCode);
    _$hash = $jc(_$hash, options.hashCode);
    _$hash = $jc(_$hash, probability.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, volume24h.hashCode);
    _$hash = $jc(_$hash, volumeTotal.hashCode);
    _$hash = $jc(_$hash, openInterest.hashCode);
    _$hash = $jc(_$hash, rules.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'PredictionMarketCardDto')
          ..add('id', id)
          ..add('title', title)
          ..add('options', options)
          ..add('probability', probability)
          ..add('status', status)
          ..add('volume24h', volume24h)
          ..add('volumeTotal', volumeTotal)
          ..add('openInterest', openInterest)
          ..add('rules', rules))
        .toString();
  }
}

class PredictionMarketCardDtoBuilder
    implements
        Builder<PredictionMarketCardDto, PredictionMarketCardDtoBuilder> {
  _$PredictionMarketCardDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _title;
  String? get title => _$this._title;
  set title(String? title) => _$this._title = title;

  ListBuilder<PredictionMarketOutcomeDto>? _options;
  ListBuilder<PredictionMarketOutcomeDto> get options =>
      _$this._options ??= ListBuilder<PredictionMarketOutcomeDto>();
  set options(ListBuilder<PredictionMarketOutcomeDto>? options) =>
      _$this._options = options;

  String? _probability;
  String? get probability => _$this._probability;
  set probability(String? probability) => _$this._probability = probability;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  String? _volume24h;
  String? get volume24h => _$this._volume24h;
  set volume24h(String? volume24h) => _$this._volume24h = volume24h;

  String? _volumeTotal;
  String? get volumeTotal => _$this._volumeTotal;
  set volumeTotal(String? volumeTotal) => _$this._volumeTotal = volumeTotal;

  String? _openInterest;
  String? get openInterest => _$this._openInterest;
  set openInterest(String? openInterest) => _$this._openInterest = openInterest;

  PredictionMarketRulesDtoBuilder? _rules;
  PredictionMarketRulesDtoBuilder get rules =>
      _$this._rules ??= PredictionMarketRulesDtoBuilder();
  set rules(PredictionMarketRulesDtoBuilder? rules) => _$this._rules = rules;

  PredictionMarketCardDtoBuilder() {
    PredictionMarketCardDto._defaults(this);
  }

  PredictionMarketCardDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _title = $v.title;
      _options = $v.options?.toBuilder();
      _probability = $v.probability;
      _status = $v.status;
      _volume24h = $v.volume24h;
      _volumeTotal = $v.volumeTotal;
      _openInterest = $v.openInterest;
      _rules = $v.rules?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PredictionMarketCardDto other) {
    _$v = other as _$PredictionMarketCardDto;
  }

  @override
  void update(void Function(PredictionMarketCardDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PredictionMarketCardDto build() => _build();

  _$PredictionMarketCardDto _build() {
    _$PredictionMarketCardDto _$result;
    try {
      _$result =
          _$v ??
          _$PredictionMarketCardDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'PredictionMarketCardDto',
              'id',
            ),
            title: BuiltValueNullFieldError.checkNotNull(
              title,
              r'PredictionMarketCardDto',
              'title',
            ),
            options: _options?.build(),
            probability: probability,
            status: status,
            volume24h: volume24h,
            volumeTotal: volumeTotal,
            openInterest: openInterest,
            rules: _rules?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'options';
        _options?.build();

        _$failedField = 'rules';
        _rules?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'PredictionMarketCardDto',
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

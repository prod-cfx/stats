// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_market_outcome_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$PredictionMarketOutcomeDto extends PredictionMarketOutcomeDto {
  @override
  final String label;
  @override
  final String probability;

  factory _$PredictionMarketOutcomeDto([
    void Function(PredictionMarketOutcomeDtoBuilder)? updates,
  ]) => (PredictionMarketOutcomeDtoBuilder()..update(updates))._build();

  _$PredictionMarketOutcomeDto._({
    required this.label,
    required this.probability,
  }) : super._();
  @override
  PredictionMarketOutcomeDto rebuild(
    void Function(PredictionMarketOutcomeDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  PredictionMarketOutcomeDtoBuilder toBuilder() =>
      PredictionMarketOutcomeDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PredictionMarketOutcomeDto &&
        label == other.label &&
        probability == other.probability;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, label.hashCode);
    _$hash = $jc(_$hash, probability.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'PredictionMarketOutcomeDto')
          ..add('label', label)
          ..add('probability', probability))
        .toString();
  }
}

class PredictionMarketOutcomeDtoBuilder
    implements
        Builder<PredictionMarketOutcomeDto, PredictionMarketOutcomeDtoBuilder> {
  _$PredictionMarketOutcomeDto? _$v;

  String? _label;
  String? get label => _$this._label;
  set label(String? label) => _$this._label = label;

  String? _probability;
  String? get probability => _$this._probability;
  set probability(String? probability) => _$this._probability = probability;

  PredictionMarketOutcomeDtoBuilder() {
    PredictionMarketOutcomeDto._defaults(this);
  }

  PredictionMarketOutcomeDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _label = $v.label;
      _probability = $v.probability;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PredictionMarketOutcomeDto other) {
    _$v = other as _$PredictionMarketOutcomeDto;
  }

  @override
  void update(void Function(PredictionMarketOutcomeDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PredictionMarketOutcomeDto build() => _build();

  _$PredictionMarketOutcomeDto _build() {
    final _$result =
        _$v ??
        _$PredictionMarketOutcomeDto._(
          label: BuiltValueNullFieldError.checkNotNull(
            label,
            r'PredictionMarketOutcomeDto',
            'label',
          ),
          probability: BuiltValueNullFieldError.checkNotNull(
            probability,
            r'PredictionMarketOutcomeDto',
            'probability',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

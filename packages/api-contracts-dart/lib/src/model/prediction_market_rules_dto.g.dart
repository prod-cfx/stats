// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_market_rules_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$PredictionMarketRulesDto extends PredictionMarketRulesDto {
  @override
  final BuiltList<String> paragraphs;
  @override
  final String? createdAt;

  factory _$PredictionMarketRulesDto([
    void Function(PredictionMarketRulesDtoBuilder)? updates,
  ]) => (PredictionMarketRulesDtoBuilder()..update(updates))._build();

  _$PredictionMarketRulesDto._({required this.paragraphs, this.createdAt})
    : super._();
  @override
  PredictionMarketRulesDto rebuild(
    void Function(PredictionMarketRulesDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  PredictionMarketRulesDtoBuilder toBuilder() =>
      PredictionMarketRulesDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PredictionMarketRulesDto &&
        paragraphs == other.paragraphs &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, paragraphs.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'PredictionMarketRulesDto')
          ..add('paragraphs', paragraphs)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class PredictionMarketRulesDtoBuilder
    implements
        Builder<PredictionMarketRulesDto, PredictionMarketRulesDtoBuilder> {
  _$PredictionMarketRulesDto? _$v;

  ListBuilder<String>? _paragraphs;
  ListBuilder<String> get paragraphs =>
      _$this._paragraphs ??= ListBuilder<String>();
  set paragraphs(ListBuilder<String>? paragraphs) =>
      _$this._paragraphs = paragraphs;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  PredictionMarketRulesDtoBuilder() {
    PredictionMarketRulesDto._defaults(this);
  }

  PredictionMarketRulesDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _paragraphs = $v.paragraphs.toBuilder();
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PredictionMarketRulesDto other) {
    _$v = other as _$PredictionMarketRulesDto;
  }

  @override
  void update(void Function(PredictionMarketRulesDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PredictionMarketRulesDto build() => _build();

  _$PredictionMarketRulesDto _build() {
    _$PredictionMarketRulesDto _$result;
    try {
      _$result =
          _$v ??
          _$PredictionMarketRulesDto._(
            paragraphs: paragraphs.build(),
            createdAt: createdAt,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'paragraphs';
        paragraphs.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'PredictionMarketRulesDto',
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

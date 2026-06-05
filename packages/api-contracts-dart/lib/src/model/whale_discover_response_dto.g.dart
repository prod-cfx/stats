// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_discover_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleDiscoverResponseDto extends WhaleDiscoverResponseDto {
  @override
  final BuiltList<WhaleDiscoverTraderDto> recommended;
  @override
  final BuiltList<WhaleDiscoverTraderDto> details;

  factory _$WhaleDiscoverResponseDto([
    void Function(WhaleDiscoverResponseDtoBuilder)? updates,
  ]) => (WhaleDiscoverResponseDtoBuilder()..update(updates))._build();

  _$WhaleDiscoverResponseDto._({
    required this.recommended,
    required this.details,
  }) : super._();
  @override
  WhaleDiscoverResponseDto rebuild(
    void Function(WhaleDiscoverResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleDiscoverResponseDtoBuilder toBuilder() =>
      WhaleDiscoverResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleDiscoverResponseDto &&
        recommended == other.recommended &&
        details == other.details;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, recommended.hashCode);
    _$hash = $jc(_$hash, details.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleDiscoverResponseDto')
          ..add('recommended', recommended)
          ..add('details', details))
        .toString();
  }
}

class WhaleDiscoverResponseDtoBuilder
    implements
        Builder<WhaleDiscoverResponseDto, WhaleDiscoverResponseDtoBuilder> {
  _$WhaleDiscoverResponseDto? _$v;

  ListBuilder<WhaleDiscoverTraderDto>? _recommended;
  ListBuilder<WhaleDiscoverTraderDto> get recommended =>
      _$this._recommended ??= ListBuilder<WhaleDiscoverTraderDto>();
  set recommended(ListBuilder<WhaleDiscoverTraderDto>? recommended) =>
      _$this._recommended = recommended;

  ListBuilder<WhaleDiscoverTraderDto>? _details;
  ListBuilder<WhaleDiscoverTraderDto> get details =>
      _$this._details ??= ListBuilder<WhaleDiscoverTraderDto>();
  set details(ListBuilder<WhaleDiscoverTraderDto>? details) =>
      _$this._details = details;

  WhaleDiscoverResponseDtoBuilder() {
    WhaleDiscoverResponseDto._defaults(this);
  }

  WhaleDiscoverResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _recommended = $v.recommended.toBuilder();
      _details = $v.details.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleDiscoverResponseDto other) {
    _$v = other as _$WhaleDiscoverResponseDto;
  }

  @override
  void update(void Function(WhaleDiscoverResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleDiscoverResponseDto build() => _build();

  _$WhaleDiscoverResponseDto _build() {
    _$WhaleDiscoverResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$WhaleDiscoverResponseDto._(
            recommended: recommended.build(),
            details: details.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'recommended';
        recommended.build();
        _$failedField = 'details';
        details.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'WhaleDiscoverResponseDto',
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

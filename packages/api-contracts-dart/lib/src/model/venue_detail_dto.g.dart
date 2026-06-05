// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'venue_detail_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$VenueDetailDto extends VenueDetailDto {
  @override
  final String venueId;
  @override
  final num size;

  factory _$VenueDetailDto([void Function(VenueDetailDtoBuilder)? updates]) =>
      (VenueDetailDtoBuilder()..update(updates))._build();

  _$VenueDetailDto._({required this.venueId, required this.size}) : super._();
  @override
  VenueDetailDto rebuild(void Function(VenueDetailDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  VenueDetailDtoBuilder toBuilder() => VenueDetailDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is VenueDetailDto &&
        venueId == other.venueId &&
        size == other.size;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, venueId.hashCode);
    _$hash = $jc(_$hash, size.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'VenueDetailDto')
          ..add('venueId', venueId)
          ..add('size', size))
        .toString();
  }
}

class VenueDetailDtoBuilder
    implements Builder<VenueDetailDto, VenueDetailDtoBuilder> {
  _$VenueDetailDto? _$v;

  String? _venueId;
  String? get venueId => _$this._venueId;
  set venueId(String? venueId) => _$this._venueId = venueId;

  num? _size;
  num? get size => _$this._size;
  set size(num? size) => _$this._size = size;

  VenueDetailDtoBuilder() {
    VenueDetailDto._defaults(this);
  }

  VenueDetailDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _venueId = $v.venueId;
      _size = $v.size;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(VenueDetailDto other) {
    _$v = other as _$VenueDetailDto;
  }

  @override
  void update(void Function(VenueDetailDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  VenueDetailDto build() => _build();

  _$VenueDetailDto _build() {
    final _$result =
        _$v ??
        _$VenueDetailDto._(
          venueId: BuiltValueNullFieldError.checkNotNull(
            venueId,
            r'VenueDetailDto',
            'venueId',
          ),
          size: BuiltValueNullFieldError.checkNotNull(
            size,
            r'VenueDetailDto',
            'size',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

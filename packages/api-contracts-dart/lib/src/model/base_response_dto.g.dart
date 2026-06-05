// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'base_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

abstract mixin class BaseResponseDtoBuilder {
  void replace(BaseResponseDto other);
  void update(void Function(BaseResponseDtoBuilder) updates);
  JsonObject? get data;
  set data(JsonObject? data);

  String? get message;
  set message(String? message);
}

class _$$BaseResponseDto extends $BaseResponseDto {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$$BaseResponseDto([
    void Function($BaseResponseDtoBuilder)? updates,
  ]) => ($BaseResponseDtoBuilder()..update(updates))._build();

  _$$BaseResponseDto._({required this.data, this.message}) : super._();
  @override
  $BaseResponseDto rebuild(void Function($BaseResponseDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  $BaseResponseDtoBuilder toBuilder() =>
      $BaseResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is $BaseResponseDto &&
        data == other.data &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'$BaseResponseDto')
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class $BaseResponseDtoBuilder
    implements
        Builder<$BaseResponseDto, $BaseResponseDtoBuilder>,
        BaseResponseDtoBuilder {
  _$$BaseResponseDto? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  $BaseResponseDtoBuilder() {
    $BaseResponseDto._defaults(this);
  }

  $BaseResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(covariant $BaseResponseDto other) {
    _$v = other as _$$BaseResponseDto;
  }

  @override
  void update(void Function($BaseResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  $BaseResponseDto build() => _build();

  _$$BaseResponseDto _build() {
    final _$result =
        _$v ??
        _$$BaseResponseDto._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'$BaseResponseDto',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

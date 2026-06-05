// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_desktop_exchange_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramDesktopExchangeRequestDto
    extends TelegramDesktopExchangeRequestDto {
  @override
  final String intentId;
  @override
  final String? betaCode;

  factory _$TelegramDesktopExchangeRequestDto([
    void Function(TelegramDesktopExchangeRequestDtoBuilder)? updates,
  ]) => (TelegramDesktopExchangeRequestDtoBuilder()..update(updates))._build();

  _$TelegramDesktopExchangeRequestDto._({required this.intentId, this.betaCode})
    : super._();
  @override
  TelegramDesktopExchangeRequestDto rebuild(
    void Function(TelegramDesktopExchangeRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramDesktopExchangeRequestDtoBuilder toBuilder() =>
      TelegramDesktopExchangeRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramDesktopExchangeRequestDto &&
        intentId == other.intentId &&
        betaCode == other.betaCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, intentId.hashCode);
    _$hash = $jc(_$hash, betaCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TelegramDesktopExchangeRequestDto')
          ..add('intentId', intentId)
          ..add('betaCode', betaCode))
        .toString();
  }
}

class TelegramDesktopExchangeRequestDtoBuilder
    implements
        Builder<
          TelegramDesktopExchangeRequestDto,
          TelegramDesktopExchangeRequestDtoBuilder
        > {
  _$TelegramDesktopExchangeRequestDto? _$v;

  String? _intentId;
  String? get intentId => _$this._intentId;
  set intentId(String? intentId) => _$this._intentId = intentId;

  String? _betaCode;
  String? get betaCode => _$this._betaCode;
  set betaCode(String? betaCode) => _$this._betaCode = betaCode;

  TelegramDesktopExchangeRequestDtoBuilder() {
    TelegramDesktopExchangeRequestDto._defaults(this);
  }

  TelegramDesktopExchangeRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _intentId = $v.intentId;
      _betaCode = $v.betaCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramDesktopExchangeRequestDto other) {
    _$v = other as _$TelegramDesktopExchangeRequestDto;
  }

  @override
  void update(
    void Function(TelegramDesktopExchangeRequestDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  TelegramDesktopExchangeRequestDto build() => _build();

  _$TelegramDesktopExchangeRequestDto _build() {
    final _$result =
        _$v ??
        _$TelegramDesktopExchangeRequestDto._(
          intentId: BuiltValueNullFieldError.checkNotNull(
            intentId,
            r'TelegramDesktopExchangeRequestDto',
            'intentId',
          ),
          betaCode: betaCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

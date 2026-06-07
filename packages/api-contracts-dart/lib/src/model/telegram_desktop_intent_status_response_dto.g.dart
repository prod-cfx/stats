// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_desktop_intent_status_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TelegramDesktopIntentStatusResponseDtoStatusEnum
_$telegramDesktopIntentStatusResponseDtoStatusEnum_pending =
    const TelegramDesktopIntentStatusResponseDtoStatusEnum._('pending');
const TelegramDesktopIntentStatusResponseDtoStatusEnum
_$telegramDesktopIntentStatusResponseDtoStatusEnum_confirmed =
    const TelegramDesktopIntentStatusResponseDtoStatusEnum._('confirmed');
const TelegramDesktopIntentStatusResponseDtoStatusEnum
_$telegramDesktopIntentStatusResponseDtoStatusEnum_expired =
    const TelegramDesktopIntentStatusResponseDtoStatusEnum._('expired');

TelegramDesktopIntentStatusResponseDtoStatusEnum
_$telegramDesktopIntentStatusResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'pending':
      return _$telegramDesktopIntentStatusResponseDtoStatusEnum_pending;
    case 'confirmed':
      return _$telegramDesktopIntentStatusResponseDtoStatusEnum_confirmed;
    case 'expired':
      return _$telegramDesktopIntentStatusResponseDtoStatusEnum_expired;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TelegramDesktopIntentStatusResponseDtoStatusEnum>
_$telegramDesktopIntentStatusResponseDtoStatusEnumValues =
    BuiltSet<TelegramDesktopIntentStatusResponseDtoStatusEnum>(
      const <TelegramDesktopIntentStatusResponseDtoStatusEnum>[
        _$telegramDesktopIntentStatusResponseDtoStatusEnum_pending,
        _$telegramDesktopIntentStatusResponseDtoStatusEnum_confirmed,
        _$telegramDesktopIntentStatusResponseDtoStatusEnum_expired,
      ],
    );

Serializer<TelegramDesktopIntentStatusResponseDtoStatusEnum>
_$telegramDesktopIntentStatusResponseDtoStatusEnumSerializer =
    _$TelegramDesktopIntentStatusResponseDtoStatusEnumSerializer();

class _$TelegramDesktopIntentStatusResponseDtoStatusEnumSerializer
    implements
        PrimitiveSerializer<TelegramDesktopIntentStatusResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'pending': 'pending',
    'confirmed': 'confirmed',
    'expired': 'expired',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'pending': 'pending',
    'confirmed': 'confirmed',
    'expired': 'expired',
  };

  @override
  final Iterable<Type> types = const <Type>[
    TelegramDesktopIntentStatusResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'TelegramDesktopIntentStatusResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    TelegramDesktopIntentStatusResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TelegramDesktopIntentStatusResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TelegramDesktopIntentStatusResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TelegramDesktopIntentStatusResponseDto
    extends TelegramDesktopIntentStatusResponseDto {
  @override
  final TelegramDesktopIntentStatusResponseDtoStatusEnum status;

  factory _$TelegramDesktopIntentStatusResponseDto([
    void Function(TelegramDesktopIntentStatusResponseDtoBuilder)? updates,
  ]) => (TelegramDesktopIntentStatusResponseDtoBuilder()..update(updates))
      ._build();

  _$TelegramDesktopIntentStatusResponseDto._({required this.status})
    : super._();
  @override
  TelegramDesktopIntentStatusResponseDto rebuild(
    void Function(TelegramDesktopIntentStatusResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramDesktopIntentStatusResponseDtoBuilder toBuilder() =>
      TelegramDesktopIntentStatusResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramDesktopIntentStatusResponseDto &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'TelegramDesktopIntentStatusResponseDto',
    )..add('status', status)).toString();
  }
}

class TelegramDesktopIntentStatusResponseDtoBuilder
    implements
        Builder<
          TelegramDesktopIntentStatusResponseDto,
          TelegramDesktopIntentStatusResponseDtoBuilder
        > {
  _$TelegramDesktopIntentStatusResponseDto? _$v;

  TelegramDesktopIntentStatusResponseDtoStatusEnum? _status;
  TelegramDesktopIntentStatusResponseDtoStatusEnum? get status =>
      _$this._status;
  set status(TelegramDesktopIntentStatusResponseDtoStatusEnum? status) =>
      _$this._status = status;

  TelegramDesktopIntentStatusResponseDtoBuilder() {
    TelegramDesktopIntentStatusResponseDto._defaults(this);
  }

  TelegramDesktopIntentStatusResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramDesktopIntentStatusResponseDto other) {
    _$v = other as _$TelegramDesktopIntentStatusResponseDto;
  }

  @override
  void update(
    void Function(TelegramDesktopIntentStatusResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  TelegramDesktopIntentStatusResponseDto build() => _build();

  _$TelegramDesktopIntentStatusResponseDto _build() {
    final _$result =
        _$v ??
        _$TelegramDesktopIntentStatusResponseDto._(
          status: BuiltValueNullFieldError.checkNotNull(
            status,
            r'TelegramDesktopIntentStatusResponseDto',
            'status',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

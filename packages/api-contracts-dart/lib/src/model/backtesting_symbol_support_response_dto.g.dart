// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_symbol_support_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingSymbolSupportResponseDtoStatusEnum
_$backtestingSymbolSupportResponseDtoStatusEnum_supported =
    const BacktestingSymbolSupportResponseDtoStatusEnum._('supported');
const BacktestingSymbolSupportResponseDtoStatusEnum
_$backtestingSymbolSupportResponseDtoStatusEnum_refreshedThenSupported =
    const BacktestingSymbolSupportResponseDtoStatusEnum._(
      'refreshedThenSupported',
    );
const BacktestingSymbolSupportResponseDtoStatusEnum
_$backtestingSymbolSupportResponseDtoStatusEnum_notSupported =
    const BacktestingSymbolSupportResponseDtoStatusEnum._('notSupported');

BacktestingSymbolSupportResponseDtoStatusEnum
_$backtestingSymbolSupportResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'supported':
      return _$backtestingSymbolSupportResponseDtoStatusEnum_supported;
    case 'refreshedThenSupported':
      return _$backtestingSymbolSupportResponseDtoStatusEnum_refreshedThenSupported;
    case 'notSupported':
      return _$backtestingSymbolSupportResponseDtoStatusEnum_notSupported;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingSymbolSupportResponseDtoStatusEnum>
_$backtestingSymbolSupportResponseDtoStatusEnumValues =
    BuiltSet<BacktestingSymbolSupportResponseDtoStatusEnum>(
      const <BacktestingSymbolSupportResponseDtoStatusEnum>[
        _$backtestingSymbolSupportResponseDtoStatusEnum_supported,
        _$backtestingSymbolSupportResponseDtoStatusEnum_refreshedThenSupported,
        _$backtestingSymbolSupportResponseDtoStatusEnum_notSupported,
      ],
    );

Serializer<BacktestingSymbolSupportResponseDtoStatusEnum>
_$backtestingSymbolSupportResponseDtoStatusEnumSerializer =
    _$BacktestingSymbolSupportResponseDtoStatusEnumSerializer();

class _$BacktestingSymbolSupportResponseDtoStatusEnumSerializer
    implements
        PrimitiveSerializer<BacktestingSymbolSupportResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'supported': 'supported',
    'refreshedThenSupported': 'refreshed_then_supported',
    'notSupported': 'not_supported',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'supported': 'supported',
    'refreshed_then_supported': 'refreshedThenSupported',
    'not_supported': 'notSupported',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingSymbolSupportResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'BacktestingSymbolSupportResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingSymbolSupportResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingSymbolSupportResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingSymbolSupportResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingSymbolSupportResponseDto
    extends BacktestingSymbolSupportResponseDto {
  @override
  final BacktestingSymbolSupportResponseDtoStatusEnum status;
  @override
  final String? reasonCode;
  @override
  final BuiltMap<String, JsonObject?>? args;

  factory _$BacktestingSymbolSupportResponseDto([
    void Function(BacktestingSymbolSupportResponseDtoBuilder)? updates,
  ]) =>
      (BacktestingSymbolSupportResponseDtoBuilder()..update(updates))._build();

  _$BacktestingSymbolSupportResponseDto._({
    required this.status,
    this.reasonCode,
    this.args,
  }) : super._();
  @override
  BacktestingSymbolSupportResponseDto rebuild(
    void Function(BacktestingSymbolSupportResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingSymbolSupportResponseDtoBuilder toBuilder() =>
      BacktestingSymbolSupportResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingSymbolSupportResponseDto &&
        status == other.status &&
        reasonCode == other.reasonCode &&
        args == other.args;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, reasonCode.hashCode);
    _$hash = $jc(_$hash, args.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingSymbolSupportResponseDto')
          ..add('status', status)
          ..add('reasonCode', reasonCode)
          ..add('args', args))
        .toString();
  }
}

class BacktestingSymbolSupportResponseDtoBuilder
    implements
        Builder<
          BacktestingSymbolSupportResponseDto,
          BacktestingSymbolSupportResponseDtoBuilder
        > {
  _$BacktestingSymbolSupportResponseDto? _$v;

  BacktestingSymbolSupportResponseDtoStatusEnum? _status;
  BacktestingSymbolSupportResponseDtoStatusEnum? get status => _$this._status;
  set status(BacktestingSymbolSupportResponseDtoStatusEnum? status) =>
      _$this._status = status;

  String? _reasonCode;
  String? get reasonCode => _$this._reasonCode;
  set reasonCode(String? reasonCode) => _$this._reasonCode = reasonCode;

  MapBuilder<String, JsonObject?>? _args;
  MapBuilder<String, JsonObject?> get args =>
      _$this._args ??= MapBuilder<String, JsonObject?>();
  set args(MapBuilder<String, JsonObject?>? args) => _$this._args = args;

  BacktestingSymbolSupportResponseDtoBuilder() {
    BacktestingSymbolSupportResponseDto._defaults(this);
  }

  BacktestingSymbolSupportResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _status = $v.status;
      _reasonCode = $v.reasonCode;
      _args = $v.args?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingSymbolSupportResponseDto other) {
    _$v = other as _$BacktestingSymbolSupportResponseDto;
  }

  @override
  void update(
    void Function(BacktestingSymbolSupportResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingSymbolSupportResponseDto build() => _build();

  _$BacktestingSymbolSupportResponseDto _build() {
    _$BacktestingSymbolSupportResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingSymbolSupportResponseDto._(
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'BacktestingSymbolSupportResponseDto',
              'status',
            ),
            reasonCode: reasonCode,
            args: _args?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'args';
        _args?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingSymbolSupportResponseDto',
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

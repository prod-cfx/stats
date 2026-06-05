// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_action_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AccountAiQuantActionRequestDtoActionEnum
_$accountAiQuantActionRequestDtoActionEnum_run =
    const AccountAiQuantActionRequestDtoActionEnum._('run');
const AccountAiQuantActionRequestDtoActionEnum
_$accountAiQuantActionRequestDtoActionEnum_stop =
    const AccountAiQuantActionRequestDtoActionEnum._('stop');
const AccountAiQuantActionRequestDtoActionEnum
_$accountAiQuantActionRequestDtoActionEnum_liquidateAndStop =
    const AccountAiQuantActionRequestDtoActionEnum._('liquidateAndStop');

AccountAiQuantActionRequestDtoActionEnum
_$accountAiQuantActionRequestDtoActionEnumValueOf(String name) {
  switch (name) {
    case 'run':
      return _$accountAiQuantActionRequestDtoActionEnum_run;
    case 'stop':
      return _$accountAiQuantActionRequestDtoActionEnum_stop;
    case 'liquidateAndStop':
      return _$accountAiQuantActionRequestDtoActionEnum_liquidateAndStop;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AccountAiQuantActionRequestDtoActionEnum>
_$accountAiQuantActionRequestDtoActionEnumValues =
    BuiltSet<AccountAiQuantActionRequestDtoActionEnum>(
      const <AccountAiQuantActionRequestDtoActionEnum>[
        _$accountAiQuantActionRequestDtoActionEnum_run,
        _$accountAiQuantActionRequestDtoActionEnum_stop,
        _$accountAiQuantActionRequestDtoActionEnum_liquidateAndStop,
      ],
    );

Serializer<AccountAiQuantActionRequestDtoActionEnum>
_$accountAiQuantActionRequestDtoActionEnumSerializer =
    _$AccountAiQuantActionRequestDtoActionEnumSerializer();

class _$AccountAiQuantActionRequestDtoActionEnumSerializer
    implements PrimitiveSerializer<AccountAiQuantActionRequestDtoActionEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'run': 'run',
    'stop': 'stop',
    'liquidateAndStop': 'liquidate_and_stop',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'run': 'run',
    'stop': 'stop',
    'liquidate_and_stop': 'liquidateAndStop',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AccountAiQuantActionRequestDtoActionEnum,
  ];
  @override
  final String wireName = 'AccountAiQuantActionRequestDtoActionEnum';

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantActionRequestDtoActionEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AccountAiQuantActionRequestDtoActionEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AccountAiQuantActionRequestDtoActionEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AccountAiQuantActionRequestDto extends AccountAiQuantActionRequestDto {
  @override
  final AccountAiQuantActionRequestDtoActionEnum action;

  factory _$AccountAiQuantActionRequestDto([
    void Function(AccountAiQuantActionRequestDtoBuilder)? updates,
  ]) => (AccountAiQuantActionRequestDtoBuilder()..update(updates))._build();

  _$AccountAiQuantActionRequestDto._({required this.action}) : super._();
  @override
  AccountAiQuantActionRequestDto rebuild(
    void Function(AccountAiQuantActionRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantActionRequestDtoBuilder toBuilder() =>
      AccountAiQuantActionRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantActionRequestDto && action == other.action;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, action.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AccountAiQuantActionRequestDto',
    )..add('action', action)).toString();
  }
}

class AccountAiQuantActionRequestDtoBuilder
    implements
        Builder<
          AccountAiQuantActionRequestDto,
          AccountAiQuantActionRequestDtoBuilder
        > {
  _$AccountAiQuantActionRequestDto? _$v;

  AccountAiQuantActionRequestDtoActionEnum? _action;
  AccountAiQuantActionRequestDtoActionEnum? get action => _$this._action;
  set action(AccountAiQuantActionRequestDtoActionEnum? action) =>
      _$this._action = action;

  AccountAiQuantActionRequestDtoBuilder() {
    AccountAiQuantActionRequestDto._defaults(this);
  }

  AccountAiQuantActionRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _action = $v.action;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantActionRequestDto other) {
    _$v = other as _$AccountAiQuantActionRequestDto;
  }

  @override
  void update(void Function(AccountAiQuantActionRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantActionRequestDto build() => _build();

  _$AccountAiQuantActionRequestDto _build() {
    final _$result =
        _$v ??
        _$AccountAiQuantActionRequestDto._(
          action: BuiltValueNullFieldError.checkNotNull(
            action,
            r'AccountAiQuantActionRequestDto',
            'action',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

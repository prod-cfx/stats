// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_backtest_range_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n7d =
    const AiQuantConversationBacktestRangeResponseDtoPresetEnum._('n7d');
const AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n30d =
    const AiQuantConversationBacktestRangeResponseDtoPresetEnum._('n30d');
const AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n90d =
    const AiQuantConversationBacktestRangeResponseDtoPresetEnum._('n90d');
const AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n1y =
    const AiQuantConversationBacktestRangeResponseDtoPresetEnum._('n1y');
const AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnum_CUSTOM =
    const AiQuantConversationBacktestRangeResponseDtoPresetEnum._('CUSTOM');

AiQuantConversationBacktestRangeResponseDtoPresetEnum
_$aiQuantConversationBacktestRangeResponseDtoPresetEnumValueOf(String name) {
  switch (name) {
    case 'n7d':
      return _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n7d;
    case 'n30d':
      return _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n30d;
    case 'n90d':
      return _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n90d;
    case 'n1y':
      return _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n1y;
    case 'CUSTOM':
      return _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_CUSTOM;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AiQuantConversationBacktestRangeResponseDtoPresetEnum>
_$aiQuantConversationBacktestRangeResponseDtoPresetEnumValues =
    BuiltSet<AiQuantConversationBacktestRangeResponseDtoPresetEnum>(
      const <AiQuantConversationBacktestRangeResponseDtoPresetEnum>[
        _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n7d,
        _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n30d,
        _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n90d,
        _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n1y,
        _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_CUSTOM,
      ],
    );

Serializer<AiQuantConversationBacktestRangeResponseDtoPresetEnum>
_$aiQuantConversationBacktestRangeResponseDtoPresetEnumSerializer =
    _$AiQuantConversationBacktestRangeResponseDtoPresetEnumSerializer();

class _$AiQuantConversationBacktestRangeResponseDtoPresetEnumSerializer
    implements
        PrimitiveSerializer<
          AiQuantConversationBacktestRangeResponseDtoPresetEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n7d': '7D',
    'n30d': '30D',
    'n90d': '90D',
    'n1y': '1Y',
    'CUSTOM': 'CUSTOM',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '7D': 'n7d',
    '30D': 'n30d',
    '90D': 'n90d',
    '1Y': 'n1y',
    'CUSTOM': 'CUSTOM',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AiQuantConversationBacktestRangeResponseDtoPresetEnum,
  ];
  @override
  final String wireName =
      'AiQuantConversationBacktestRangeResponseDtoPresetEnum';

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestRangeResponseDtoPresetEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AiQuantConversationBacktestRangeResponseDtoPresetEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AiQuantConversationBacktestRangeResponseDtoPresetEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AiQuantConversationBacktestRangeResponseDto
    extends AiQuantConversationBacktestRangeResponseDto {
  @override
  final AiQuantConversationBacktestRangeResponseDtoPresetEnum preset;
  @override
  final String? startAt;
  @override
  final String? endAt;

  factory _$AiQuantConversationBacktestRangeResponseDto([
    void Function(AiQuantConversationBacktestRangeResponseDtoBuilder)? updates,
  ]) => (AiQuantConversationBacktestRangeResponseDtoBuilder()..update(updates))
      ._build();

  _$AiQuantConversationBacktestRangeResponseDto._({
    required this.preset,
    this.startAt,
    this.endAt,
  }) : super._();
  @override
  AiQuantConversationBacktestRangeResponseDto rebuild(
    void Function(AiQuantConversationBacktestRangeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationBacktestRangeResponseDtoBuilder toBuilder() =>
      AiQuantConversationBacktestRangeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationBacktestRangeResponseDto &&
        preset == other.preset &&
        startAt == other.startAt &&
        endAt == other.endAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, preset.hashCode);
    _$hash = $jc(_$hash, startAt.hashCode);
    _$hash = $jc(_$hash, endAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationBacktestRangeResponseDto',
          )
          ..add('preset', preset)
          ..add('startAt', startAt)
          ..add('endAt', endAt))
        .toString();
  }
}

class AiQuantConversationBacktestRangeResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationBacktestRangeResponseDto,
          AiQuantConversationBacktestRangeResponseDtoBuilder
        > {
  _$AiQuantConversationBacktestRangeResponseDto? _$v;

  AiQuantConversationBacktestRangeResponseDtoPresetEnum? _preset;
  AiQuantConversationBacktestRangeResponseDtoPresetEnum? get preset =>
      _$this._preset;
  set preset(AiQuantConversationBacktestRangeResponseDtoPresetEnum? preset) =>
      _$this._preset = preset;

  String? _startAt;
  String? get startAt => _$this._startAt;
  set startAt(String? startAt) => _$this._startAt = startAt;

  String? _endAt;
  String? get endAt => _$this._endAt;
  set endAt(String? endAt) => _$this._endAt = endAt;

  AiQuantConversationBacktestRangeResponseDtoBuilder() {
    AiQuantConversationBacktestRangeResponseDto._defaults(this);
  }

  AiQuantConversationBacktestRangeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _preset = $v.preset;
      _startAt = $v.startAt;
      _endAt = $v.endAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationBacktestRangeResponseDto other) {
    _$v = other as _$AiQuantConversationBacktestRangeResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationBacktestRangeResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationBacktestRangeResponseDto build() => _build();

  _$AiQuantConversationBacktestRangeResponseDto _build() {
    final _$result =
        _$v ??
        _$AiQuantConversationBacktestRangeResponseDto._(
          preset: BuiltValueNullFieldError.checkNotNull(
            preset,
            r'AiQuantConversationBacktestRangeResponseDto',
            'preset',
          ),
          startAt: startAt,
          endAt: endAt,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

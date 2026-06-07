// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_strategy_instance_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LlmStrategyInstanceResponseDtoStatusEnum
_$llmStrategyInstanceResponseDtoStatusEnum_running =
    const LlmStrategyInstanceResponseDtoStatusEnum._('running');
const LlmStrategyInstanceResponseDtoStatusEnum
_$llmStrategyInstanceResponseDtoStatusEnum_paused =
    const LlmStrategyInstanceResponseDtoStatusEnum._('paused');
const LlmStrategyInstanceResponseDtoStatusEnum
_$llmStrategyInstanceResponseDtoStatusEnum_stopped =
    const LlmStrategyInstanceResponseDtoStatusEnum._('stopped');

LlmStrategyInstanceResponseDtoStatusEnum
_$llmStrategyInstanceResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'running':
      return _$llmStrategyInstanceResponseDtoStatusEnum_running;
    case 'paused':
      return _$llmStrategyInstanceResponseDtoStatusEnum_paused;
    case 'stopped':
      return _$llmStrategyInstanceResponseDtoStatusEnum_stopped;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmStrategyInstanceResponseDtoStatusEnum>
_$llmStrategyInstanceResponseDtoStatusEnumValues =
    BuiltSet<LlmStrategyInstanceResponseDtoStatusEnum>(
      const <LlmStrategyInstanceResponseDtoStatusEnum>[
        _$llmStrategyInstanceResponseDtoStatusEnum_running,
        _$llmStrategyInstanceResponseDtoStatusEnum_paused,
        _$llmStrategyInstanceResponseDtoStatusEnum_stopped,
      ],
    );

const LlmStrategyInstanceResponseDtoModeEnum
_$llmStrategyInstanceResponseDtoModeEnum_LIVE =
    const LlmStrategyInstanceResponseDtoModeEnum._('LIVE');
const LlmStrategyInstanceResponseDtoModeEnum
_$llmStrategyInstanceResponseDtoModeEnum_PAPER =
    const LlmStrategyInstanceResponseDtoModeEnum._('PAPER');
const LlmStrategyInstanceResponseDtoModeEnum
_$llmStrategyInstanceResponseDtoModeEnum_BACKTEST =
    const LlmStrategyInstanceResponseDtoModeEnum._('BACKTEST');

LlmStrategyInstanceResponseDtoModeEnum
_$llmStrategyInstanceResponseDtoModeEnumValueOf(String name) {
  switch (name) {
    case 'LIVE':
      return _$llmStrategyInstanceResponseDtoModeEnum_LIVE;
    case 'PAPER':
      return _$llmStrategyInstanceResponseDtoModeEnum_PAPER;
    case 'BACKTEST':
      return _$llmStrategyInstanceResponseDtoModeEnum_BACKTEST;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmStrategyInstanceResponseDtoModeEnum>
_$llmStrategyInstanceResponseDtoModeEnumValues =
    BuiltSet<LlmStrategyInstanceResponseDtoModeEnum>(
      const <LlmStrategyInstanceResponseDtoModeEnum>[
        _$llmStrategyInstanceResponseDtoModeEnum_LIVE,
        _$llmStrategyInstanceResponseDtoModeEnum_PAPER,
        _$llmStrategyInstanceResponseDtoModeEnum_BACKTEST,
      ],
    );

Serializer<LlmStrategyInstanceResponseDtoStatusEnum>
_$llmStrategyInstanceResponseDtoStatusEnumSerializer =
    _$LlmStrategyInstanceResponseDtoStatusEnumSerializer();
Serializer<LlmStrategyInstanceResponseDtoModeEnum>
_$llmStrategyInstanceResponseDtoModeEnumSerializer =
    _$LlmStrategyInstanceResponseDtoModeEnumSerializer();

class _$LlmStrategyInstanceResponseDtoStatusEnumSerializer
    implements PrimitiveSerializer<LlmStrategyInstanceResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'running': 'running',
    'paused': 'paused',
    'stopped': 'stopped',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'running': 'running',
    'paused': 'paused',
    'stopped': 'stopped',
  };

  @override
  final Iterable<Type> types = const <Type>[
    LlmStrategyInstanceResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'LlmStrategyInstanceResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmStrategyInstanceResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmStrategyInstanceResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmStrategyInstanceResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmStrategyInstanceResponseDtoModeEnumSerializer
    implements PrimitiveSerializer<LlmStrategyInstanceResponseDtoModeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LIVE': 'LIVE',
    'PAPER': 'PAPER',
    'BACKTEST': 'BACKTEST',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LIVE': 'LIVE',
    'PAPER': 'PAPER',
    'BACKTEST': 'BACKTEST',
  };

  @override
  final Iterable<Type> types = const <Type>[
    LlmStrategyInstanceResponseDtoModeEnum,
  ];
  @override
  final String wireName = 'LlmStrategyInstanceResponseDtoModeEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmStrategyInstanceResponseDtoModeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmStrategyInstanceResponseDtoModeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmStrategyInstanceResponseDtoModeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmStrategyInstanceResponseDto extends LlmStrategyInstanceResponseDto {
  @override
  final String id;
  @override
  final String strategyId;
  @override
  final String strategyName;
  @override
  final String? strategyDescription;
  @override
  final String name;
  @override
  final String? description;
  @override
  final LlmStrategyInstanceResponseDtoStatusEnum status;
  @override
  final LlmStrategyInstanceResponseDtoModeEnum mode;
  @override
  final String llmModel;
  @override
  final String? lastRunAt;
  @override
  final bool isSubscribed;
  @override
  final String createdAt;
  @override
  final String updatedAt;

  factory _$LlmStrategyInstanceResponseDto([
    void Function(LlmStrategyInstanceResponseDtoBuilder)? updates,
  ]) => (LlmStrategyInstanceResponseDtoBuilder()..update(updates))._build();

  _$LlmStrategyInstanceResponseDto._({
    required this.id,
    required this.strategyId,
    required this.strategyName,
    this.strategyDescription,
    required this.name,
    this.description,
    required this.status,
    required this.mode,
    required this.llmModel,
    this.lastRunAt,
    required this.isSubscribed,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  LlmStrategyInstanceResponseDto rebuild(
    void Function(LlmStrategyInstanceResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmStrategyInstanceResponseDtoBuilder toBuilder() =>
      LlmStrategyInstanceResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmStrategyInstanceResponseDto &&
        id == other.id &&
        strategyId == other.strategyId &&
        strategyName == other.strategyName &&
        strategyDescription == other.strategyDescription &&
        name == other.name &&
        description == other.description &&
        status == other.status &&
        mode == other.mode &&
        llmModel == other.llmModel &&
        lastRunAt == other.lastRunAt &&
        isSubscribed == other.isSubscribed &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, strategyId.hashCode);
    _$hash = $jc(_$hash, strategyName.hashCode);
    _$hash = $jc(_$hash, strategyDescription.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, mode.hashCode);
    _$hash = $jc(_$hash, llmModel.hashCode);
    _$hash = $jc(_$hash, lastRunAt.hashCode);
    _$hash = $jc(_$hash, isSubscribed.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmStrategyInstanceResponseDto')
          ..add('id', id)
          ..add('strategyId', strategyId)
          ..add('strategyName', strategyName)
          ..add('strategyDescription', strategyDescription)
          ..add('name', name)
          ..add('description', description)
          ..add('status', status)
          ..add('mode', mode)
          ..add('llmModel', llmModel)
          ..add('lastRunAt', lastRunAt)
          ..add('isSubscribed', isSubscribed)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class LlmStrategyInstanceResponseDtoBuilder
    implements
        Builder<
          LlmStrategyInstanceResponseDto,
          LlmStrategyInstanceResponseDtoBuilder
        > {
  _$LlmStrategyInstanceResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _strategyId;
  String? get strategyId => _$this._strategyId;
  set strategyId(String? strategyId) => _$this._strategyId = strategyId;

  String? _strategyName;
  String? get strategyName => _$this._strategyName;
  set strategyName(String? strategyName) => _$this._strategyName = strategyName;

  String? _strategyDescription;
  String? get strategyDescription => _$this._strategyDescription;
  set strategyDescription(String? strategyDescription) =>
      _$this._strategyDescription = strategyDescription;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  LlmStrategyInstanceResponseDtoStatusEnum? _status;
  LlmStrategyInstanceResponseDtoStatusEnum? get status => _$this._status;
  set status(LlmStrategyInstanceResponseDtoStatusEnum? status) =>
      _$this._status = status;

  LlmStrategyInstanceResponseDtoModeEnum? _mode;
  LlmStrategyInstanceResponseDtoModeEnum? get mode => _$this._mode;
  set mode(LlmStrategyInstanceResponseDtoModeEnum? mode) => _$this._mode = mode;

  String? _llmModel;
  String? get llmModel => _$this._llmModel;
  set llmModel(String? llmModel) => _$this._llmModel = llmModel;

  String? _lastRunAt;
  String? get lastRunAt => _$this._lastRunAt;
  set lastRunAt(String? lastRunAt) => _$this._lastRunAt = lastRunAt;

  bool? _isSubscribed;
  bool? get isSubscribed => _$this._isSubscribed;
  set isSubscribed(bool? isSubscribed) => _$this._isSubscribed = isSubscribed;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  LlmStrategyInstanceResponseDtoBuilder() {
    LlmStrategyInstanceResponseDto._defaults(this);
  }

  LlmStrategyInstanceResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _strategyId = $v.strategyId;
      _strategyName = $v.strategyName;
      _strategyDescription = $v.strategyDescription;
      _name = $v.name;
      _description = $v.description;
      _status = $v.status;
      _mode = $v.mode;
      _llmModel = $v.llmModel;
      _lastRunAt = $v.lastRunAt;
      _isSubscribed = $v.isSubscribed;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmStrategyInstanceResponseDto other) {
    _$v = other as _$LlmStrategyInstanceResponseDto;
  }

  @override
  void update(void Function(LlmStrategyInstanceResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmStrategyInstanceResponseDto build() => _build();

  _$LlmStrategyInstanceResponseDto _build() {
    final _$result =
        _$v ??
        _$LlmStrategyInstanceResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'LlmStrategyInstanceResponseDto',
            'id',
          ),
          strategyId: BuiltValueNullFieldError.checkNotNull(
            strategyId,
            r'LlmStrategyInstanceResponseDto',
            'strategyId',
          ),
          strategyName: BuiltValueNullFieldError.checkNotNull(
            strategyName,
            r'LlmStrategyInstanceResponseDto',
            'strategyName',
          ),
          strategyDescription: strategyDescription,
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'LlmStrategyInstanceResponseDto',
            'name',
          ),
          description: description,
          status: BuiltValueNullFieldError.checkNotNull(
            status,
            r'LlmStrategyInstanceResponseDto',
            'status',
          ),
          mode: BuiltValueNullFieldError.checkNotNull(
            mode,
            r'LlmStrategyInstanceResponseDto',
            'mode',
          ),
          llmModel: BuiltValueNullFieldError.checkNotNull(
            llmModel,
            r'LlmStrategyInstanceResponseDto',
            'llmModel',
          ),
          lastRunAt: lastRunAt,
          isSubscribed: BuiltValueNullFieldError.checkNotNull(
            isSubscribed,
            r'LlmStrategyInstanceResponseDto',
            'isSubscribed',
          ),
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'LlmStrategyInstanceResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'LlmStrategyInstanceResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

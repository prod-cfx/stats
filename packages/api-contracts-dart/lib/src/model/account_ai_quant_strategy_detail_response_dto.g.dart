// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_strategy_detail_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AccountAiQuantStrategyDetailResponseDtoStatusEnum
_$accountAiQuantStrategyDetailResponseDtoStatusEnum_running =
    const AccountAiQuantStrategyDetailResponseDtoStatusEnum._('running');
const AccountAiQuantStrategyDetailResponseDtoStatusEnum
_$accountAiQuantStrategyDetailResponseDtoStatusEnum_stopped =
    const AccountAiQuantStrategyDetailResponseDtoStatusEnum._('stopped');
const AccountAiQuantStrategyDetailResponseDtoStatusEnum
_$accountAiQuantStrategyDetailResponseDtoStatusEnum_draft =
    const AccountAiQuantStrategyDetailResponseDtoStatusEnum._('draft');

AccountAiQuantStrategyDetailResponseDtoStatusEnum
_$accountAiQuantStrategyDetailResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'running':
      return _$accountAiQuantStrategyDetailResponseDtoStatusEnum_running;
    case 'stopped':
      return _$accountAiQuantStrategyDetailResponseDtoStatusEnum_stopped;
    case 'draft':
      return _$accountAiQuantStrategyDetailResponseDtoStatusEnum_draft;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AccountAiQuantStrategyDetailResponseDtoStatusEnum>
_$accountAiQuantStrategyDetailResponseDtoStatusEnumValues =
    BuiltSet<AccountAiQuantStrategyDetailResponseDtoStatusEnum>(
      const <AccountAiQuantStrategyDetailResponseDtoStatusEnum>[
        _$accountAiQuantStrategyDetailResponseDtoStatusEnum_running,
        _$accountAiQuantStrategyDetailResponseDtoStatusEnum_stopped,
        _$accountAiQuantStrategyDetailResponseDtoStatusEnum_draft,
      ],
    );

Serializer<AccountAiQuantStrategyDetailResponseDtoStatusEnum>
_$accountAiQuantStrategyDetailResponseDtoStatusEnumSerializer =
    _$AccountAiQuantStrategyDetailResponseDtoStatusEnumSerializer();

class _$AccountAiQuantStrategyDetailResponseDtoStatusEnumSerializer
    implements
        PrimitiveSerializer<AccountAiQuantStrategyDetailResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AccountAiQuantStrategyDetailResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'AccountAiQuantStrategyDetailResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantStrategyDetailResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AccountAiQuantStrategyDetailResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AccountAiQuantStrategyDetailResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AccountAiQuantStrategyDetailResponseDto
    extends AccountAiQuantStrategyDetailResponseDto {
  @override
  final String id;
  @override
  final String name;
  @override
  final AccountAiQuantStrategyDetailResponseDtoStatusEnum status;
  @override
  final String? exchange;
  @override
  final String? symbol;
  @override
  final String? timeframe;
  @override
  final num? positionPct;
  @override
  final BuiltMap<String, JsonObject?>? paramSchema;
  @override
  final BuiltMap<String, JsonObject?>? paramValues;
  @override
  final String? schemaVersion;
  @override
  final bool isSubscribed;
  @override
  final BuiltMap<String, JsonObject?> metrics;
  @override
  final String updatedAt;
  @override
  final num? totalPnl;
  @override
  final num? todayPnl;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> equitySeries;
  @override
  final BuiltMap<String, JsonObject?> snapshot;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> timeline;
  @override
  final BuiltMap<String, JsonObject?> accountOverview;
  @override
  final BuiltMap<String, JsonObject?> positionOverview;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> latestOrders;
  @override
  final BuiltMap<String, JsonObject?>? deployment;

  factory _$AccountAiQuantStrategyDetailResponseDto([
    void Function(AccountAiQuantStrategyDetailResponseDtoBuilder)? updates,
  ]) => (AccountAiQuantStrategyDetailResponseDtoBuilder()..update(updates))
      ._build();

  _$AccountAiQuantStrategyDetailResponseDto._({
    required this.id,
    required this.name,
    required this.status,
    this.exchange,
    this.symbol,
    this.timeframe,
    this.positionPct,
    this.paramSchema,
    this.paramValues,
    this.schemaVersion,
    required this.isSubscribed,
    required this.metrics,
    required this.updatedAt,
    this.totalPnl,
    this.todayPnl,
    required this.equitySeries,
    required this.snapshot,
    required this.timeline,
    required this.accountOverview,
    required this.positionOverview,
    required this.latestOrders,
    this.deployment,
  }) : super._();
  @override
  AccountAiQuantStrategyDetailResponseDto rebuild(
    void Function(AccountAiQuantStrategyDetailResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantStrategyDetailResponseDtoBuilder toBuilder() =>
      AccountAiQuantStrategyDetailResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantStrategyDetailResponseDto &&
        id == other.id &&
        name == other.name &&
        status == other.status &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        timeframe == other.timeframe &&
        positionPct == other.positionPct &&
        paramSchema == other.paramSchema &&
        paramValues == other.paramValues &&
        schemaVersion == other.schemaVersion &&
        isSubscribed == other.isSubscribed &&
        metrics == other.metrics &&
        updatedAt == other.updatedAt &&
        totalPnl == other.totalPnl &&
        todayPnl == other.todayPnl &&
        equitySeries == other.equitySeries &&
        snapshot == other.snapshot &&
        timeline == other.timeline &&
        accountOverview == other.accountOverview &&
        positionOverview == other.positionOverview &&
        latestOrders == other.latestOrders &&
        deployment == other.deployment;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, positionPct.hashCode);
    _$hash = $jc(_$hash, paramSchema.hashCode);
    _$hash = $jc(_$hash, paramValues.hashCode);
    _$hash = $jc(_$hash, schemaVersion.hashCode);
    _$hash = $jc(_$hash, isSubscribed.hashCode);
    _$hash = $jc(_$hash, metrics.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jc(_$hash, totalPnl.hashCode);
    _$hash = $jc(_$hash, todayPnl.hashCode);
    _$hash = $jc(_$hash, equitySeries.hashCode);
    _$hash = $jc(_$hash, snapshot.hashCode);
    _$hash = $jc(_$hash, timeline.hashCode);
    _$hash = $jc(_$hash, accountOverview.hashCode);
    _$hash = $jc(_$hash, positionOverview.hashCode);
    _$hash = $jc(_$hash, latestOrders.hashCode);
    _$hash = $jc(_$hash, deployment.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AccountAiQuantStrategyDetailResponseDto',
          )
          ..add('id', id)
          ..add('name', name)
          ..add('status', status)
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('timeframe', timeframe)
          ..add('positionPct', positionPct)
          ..add('paramSchema', paramSchema)
          ..add('paramValues', paramValues)
          ..add('schemaVersion', schemaVersion)
          ..add('isSubscribed', isSubscribed)
          ..add('metrics', metrics)
          ..add('updatedAt', updatedAt)
          ..add('totalPnl', totalPnl)
          ..add('todayPnl', todayPnl)
          ..add('equitySeries', equitySeries)
          ..add('snapshot', snapshot)
          ..add('timeline', timeline)
          ..add('accountOverview', accountOverview)
          ..add('positionOverview', positionOverview)
          ..add('latestOrders', latestOrders)
          ..add('deployment', deployment))
        .toString();
  }
}

class AccountAiQuantStrategyDetailResponseDtoBuilder
    implements
        Builder<
          AccountAiQuantStrategyDetailResponseDto,
          AccountAiQuantStrategyDetailResponseDtoBuilder
        > {
  _$AccountAiQuantStrategyDetailResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  AccountAiQuantStrategyDetailResponseDtoStatusEnum? _status;
  AccountAiQuantStrategyDetailResponseDtoStatusEnum? get status =>
      _$this._status;
  set status(AccountAiQuantStrategyDetailResponseDtoStatusEnum? status) =>
      _$this._status = status;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _timeframe;
  String? get timeframe => _$this._timeframe;
  set timeframe(String? timeframe) => _$this._timeframe = timeframe;

  num? _positionPct;
  num? get positionPct => _$this._positionPct;
  set positionPct(num? positionPct) => _$this._positionPct = positionPct;

  MapBuilder<String, JsonObject?>? _paramSchema;
  MapBuilder<String, JsonObject?> get paramSchema =>
      _$this._paramSchema ??= MapBuilder<String, JsonObject?>();
  set paramSchema(MapBuilder<String, JsonObject?>? paramSchema) =>
      _$this._paramSchema = paramSchema;

  MapBuilder<String, JsonObject?>? _paramValues;
  MapBuilder<String, JsonObject?> get paramValues =>
      _$this._paramValues ??= MapBuilder<String, JsonObject?>();
  set paramValues(MapBuilder<String, JsonObject?>? paramValues) =>
      _$this._paramValues = paramValues;

  String? _schemaVersion;
  String? get schemaVersion => _$this._schemaVersion;
  set schemaVersion(String? schemaVersion) =>
      _$this._schemaVersion = schemaVersion;

  bool? _isSubscribed;
  bool? get isSubscribed => _$this._isSubscribed;
  set isSubscribed(bool? isSubscribed) => _$this._isSubscribed = isSubscribed;

  MapBuilder<String, JsonObject?>? _metrics;
  MapBuilder<String, JsonObject?> get metrics =>
      _$this._metrics ??= MapBuilder<String, JsonObject?>();
  set metrics(MapBuilder<String, JsonObject?>? metrics) =>
      _$this._metrics = metrics;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  num? _totalPnl;
  num? get totalPnl => _$this._totalPnl;
  set totalPnl(num? totalPnl) => _$this._totalPnl = totalPnl;

  num? _todayPnl;
  num? get todayPnl => _$this._todayPnl;
  set todayPnl(num? todayPnl) => _$this._todayPnl = todayPnl;

  ListBuilder<BuiltMap<String, JsonObject?>>? _equitySeries;
  ListBuilder<BuiltMap<String, JsonObject?>> get equitySeries =>
      _$this._equitySeries ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set equitySeries(ListBuilder<BuiltMap<String, JsonObject?>>? equitySeries) =>
      _$this._equitySeries = equitySeries;

  MapBuilder<String, JsonObject?>? _snapshot;
  MapBuilder<String, JsonObject?> get snapshot =>
      _$this._snapshot ??= MapBuilder<String, JsonObject?>();
  set snapshot(MapBuilder<String, JsonObject?>? snapshot) =>
      _$this._snapshot = snapshot;

  ListBuilder<BuiltMap<String, JsonObject?>>? _timeline;
  ListBuilder<BuiltMap<String, JsonObject?>> get timeline =>
      _$this._timeline ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set timeline(ListBuilder<BuiltMap<String, JsonObject?>>? timeline) =>
      _$this._timeline = timeline;

  MapBuilder<String, JsonObject?>? _accountOverview;
  MapBuilder<String, JsonObject?> get accountOverview =>
      _$this._accountOverview ??= MapBuilder<String, JsonObject?>();
  set accountOverview(MapBuilder<String, JsonObject?>? accountOverview) =>
      _$this._accountOverview = accountOverview;

  MapBuilder<String, JsonObject?>? _positionOverview;
  MapBuilder<String, JsonObject?> get positionOverview =>
      _$this._positionOverview ??= MapBuilder<String, JsonObject?>();
  set positionOverview(MapBuilder<String, JsonObject?>? positionOverview) =>
      _$this._positionOverview = positionOverview;

  ListBuilder<BuiltMap<String, JsonObject?>>? _latestOrders;
  ListBuilder<BuiltMap<String, JsonObject?>> get latestOrders =>
      _$this._latestOrders ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set latestOrders(ListBuilder<BuiltMap<String, JsonObject?>>? latestOrders) =>
      _$this._latestOrders = latestOrders;

  MapBuilder<String, JsonObject?>? _deployment;
  MapBuilder<String, JsonObject?> get deployment =>
      _$this._deployment ??= MapBuilder<String, JsonObject?>();
  set deployment(MapBuilder<String, JsonObject?>? deployment) =>
      _$this._deployment = deployment;

  AccountAiQuantStrategyDetailResponseDtoBuilder() {
    AccountAiQuantStrategyDetailResponseDto._defaults(this);
  }

  AccountAiQuantStrategyDetailResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _status = $v.status;
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _timeframe = $v.timeframe;
      _positionPct = $v.positionPct;
      _paramSchema = $v.paramSchema?.toBuilder();
      _paramValues = $v.paramValues?.toBuilder();
      _schemaVersion = $v.schemaVersion;
      _isSubscribed = $v.isSubscribed;
      _metrics = $v.metrics.toBuilder();
      _updatedAt = $v.updatedAt;
      _totalPnl = $v.totalPnl;
      _todayPnl = $v.todayPnl;
      _equitySeries = $v.equitySeries.toBuilder();
      _snapshot = $v.snapshot.toBuilder();
      _timeline = $v.timeline.toBuilder();
      _accountOverview = $v.accountOverview.toBuilder();
      _positionOverview = $v.positionOverview.toBuilder();
      _latestOrders = $v.latestOrders.toBuilder();
      _deployment = $v.deployment?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantStrategyDetailResponseDto other) {
    _$v = other as _$AccountAiQuantStrategyDetailResponseDto;
  }

  @override
  void update(
    void Function(AccountAiQuantStrategyDetailResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantStrategyDetailResponseDto build() => _build();

  _$AccountAiQuantStrategyDetailResponseDto _build() {
    _$AccountAiQuantStrategyDetailResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantStrategyDetailResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AccountAiQuantStrategyDetailResponseDto',
              'id',
            ),
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'AccountAiQuantStrategyDetailResponseDto',
              'name',
            ),
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'AccountAiQuantStrategyDetailResponseDto',
              'status',
            ),
            exchange: exchange,
            symbol: symbol,
            timeframe: timeframe,
            positionPct: positionPct,
            paramSchema: _paramSchema?.build(),
            paramValues: _paramValues?.build(),
            schemaVersion: schemaVersion,
            isSubscribed: BuiltValueNullFieldError.checkNotNull(
              isSubscribed,
              r'AccountAiQuantStrategyDetailResponseDto',
              'isSubscribed',
            ),
            metrics: metrics.build(),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'AccountAiQuantStrategyDetailResponseDto',
              'updatedAt',
            ),
            totalPnl: totalPnl,
            todayPnl: todayPnl,
            equitySeries: equitySeries.build(),
            snapshot: snapshot.build(),
            timeline: timeline.build(),
            accountOverview: accountOverview.build(),
            positionOverview: positionOverview.build(),
            latestOrders: latestOrders.build(),
            deployment: _deployment?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'paramSchema';
        _paramSchema?.build();
        _$failedField = 'paramValues';
        _paramValues?.build();

        _$failedField = 'metrics';
        metrics.build();

        _$failedField = 'equitySeries';
        equitySeries.build();
        _$failedField = 'snapshot';
        snapshot.build();
        _$failedField = 'timeline';
        timeline.build();
        _$failedField = 'accountOverview';
        accountOverview.build();
        _$failedField = 'positionOverview';
        positionOverview.build();
        _$failedField = 'latestOrders';
        latestOrders.build();
        _$failedField = 'deployment';
        _deployment?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountAiQuantStrategyDetailResponseDto',
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

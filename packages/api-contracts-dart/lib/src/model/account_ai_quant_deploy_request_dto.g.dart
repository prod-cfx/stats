// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_deploy_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountAiQuantDeployRequestDto extends AccountAiQuantDeployRequestDto {
  @override
  final String name;
  @override
  final String deployRequestId;
  @override
  final String publishedSnapshotId;
  @override
  final String? exchangeAccountId;
  @override
  final String? exchangeAccountName;
  @override
  final BuiltMap<String, JsonObject?>? deploymentExecutionConfig;

  factory _$AccountAiQuantDeployRequestDto([
    void Function(AccountAiQuantDeployRequestDtoBuilder)? updates,
  ]) => (AccountAiQuantDeployRequestDtoBuilder()..update(updates))._build();

  _$AccountAiQuantDeployRequestDto._({
    required this.name,
    required this.deployRequestId,
    required this.publishedSnapshotId,
    this.exchangeAccountId,
    this.exchangeAccountName,
    this.deploymentExecutionConfig,
  }) : super._();
  @override
  AccountAiQuantDeployRequestDto rebuild(
    void Function(AccountAiQuantDeployRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantDeployRequestDtoBuilder toBuilder() =>
      AccountAiQuantDeployRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantDeployRequestDto &&
        name == other.name &&
        deployRequestId == other.deployRequestId &&
        publishedSnapshotId == other.publishedSnapshotId &&
        exchangeAccountId == other.exchangeAccountId &&
        exchangeAccountName == other.exchangeAccountName &&
        deploymentExecutionConfig == other.deploymentExecutionConfig;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, deployRequestId.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotId.hashCode);
    _$hash = $jc(_$hash, exchangeAccountId.hashCode);
    _$hash = $jc(_$hash, exchangeAccountName.hashCode);
    _$hash = $jc(_$hash, deploymentExecutionConfig.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AccountAiQuantDeployRequestDto')
          ..add('name', name)
          ..add('deployRequestId', deployRequestId)
          ..add('publishedSnapshotId', publishedSnapshotId)
          ..add('exchangeAccountId', exchangeAccountId)
          ..add('exchangeAccountName', exchangeAccountName)
          ..add('deploymentExecutionConfig', deploymentExecutionConfig))
        .toString();
  }
}

class AccountAiQuantDeployRequestDtoBuilder
    implements
        Builder<
          AccountAiQuantDeployRequestDto,
          AccountAiQuantDeployRequestDtoBuilder
        > {
  _$AccountAiQuantDeployRequestDto? _$v;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _deployRequestId;
  String? get deployRequestId => _$this._deployRequestId;
  set deployRequestId(String? deployRequestId) =>
      _$this._deployRequestId = deployRequestId;

  String? _publishedSnapshotId;
  String? get publishedSnapshotId => _$this._publishedSnapshotId;
  set publishedSnapshotId(String? publishedSnapshotId) =>
      _$this._publishedSnapshotId = publishedSnapshotId;

  String? _exchangeAccountId;
  String? get exchangeAccountId => _$this._exchangeAccountId;
  set exchangeAccountId(String? exchangeAccountId) =>
      _$this._exchangeAccountId = exchangeAccountId;

  String? _exchangeAccountName;
  String? get exchangeAccountName => _$this._exchangeAccountName;
  set exchangeAccountName(String? exchangeAccountName) =>
      _$this._exchangeAccountName = exchangeAccountName;

  MapBuilder<String, JsonObject?>? _deploymentExecutionConfig;
  MapBuilder<String, JsonObject?> get deploymentExecutionConfig =>
      _$this._deploymentExecutionConfig ??= MapBuilder<String, JsonObject?>();
  set deploymentExecutionConfig(
    MapBuilder<String, JsonObject?>? deploymentExecutionConfig,
  ) => _$this._deploymentExecutionConfig = deploymentExecutionConfig;

  AccountAiQuantDeployRequestDtoBuilder() {
    AccountAiQuantDeployRequestDto._defaults(this);
  }

  AccountAiQuantDeployRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _name = $v.name;
      _deployRequestId = $v.deployRequestId;
      _publishedSnapshotId = $v.publishedSnapshotId;
      _exchangeAccountId = $v.exchangeAccountId;
      _exchangeAccountName = $v.exchangeAccountName;
      _deploymentExecutionConfig = $v.deploymentExecutionConfig?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantDeployRequestDto other) {
    _$v = other as _$AccountAiQuantDeployRequestDto;
  }

  @override
  void update(void Function(AccountAiQuantDeployRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantDeployRequestDto build() => _build();

  _$AccountAiQuantDeployRequestDto _build() {
    _$AccountAiQuantDeployRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantDeployRequestDto._(
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'AccountAiQuantDeployRequestDto',
              'name',
            ),
            deployRequestId: BuiltValueNullFieldError.checkNotNull(
              deployRequestId,
              r'AccountAiQuantDeployRequestDto',
              'deployRequestId',
            ),
            publishedSnapshotId: BuiltValueNullFieldError.checkNotNull(
              publishedSnapshotId,
              r'AccountAiQuantDeployRequestDto',
              'publishedSnapshotId',
            ),
            exchangeAccountId: exchangeAccountId,
            exchangeAccountName: exchangeAccountName,
            deploymentExecutionConfig: _deploymentExecutionConfig?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'deploymentExecutionConfig';
        _deploymentExecutionConfig?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountAiQuantDeployRequestDto',
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

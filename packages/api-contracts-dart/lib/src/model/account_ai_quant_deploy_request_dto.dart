//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_deploy_request_dto.g.dart';

/// AccountAiQuantDeployRequestDto
///
/// Properties:
/// * [name] 
/// * [deployRequestId] - 部署请求幂等 ID（前端点击一次生成一次）
/// * [publishedSnapshotId] - Published snapshot that owns the runtime settings
/// * [exchangeAccountId] 
/// * [exchangeAccountName] 
/// * [deploymentExecutionConfig] - Deployment execution config passthrough (currently leverage override).
@BuiltValue()
abstract class AccountAiQuantDeployRequestDto implements Built<AccountAiQuantDeployRequestDto, AccountAiQuantDeployRequestDtoBuilder> {
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 部署请求幂等 ID（前端点击一次生成一次）
  @BuiltValueField(wireName: r'deployRequestId')
  String get deployRequestId;

  /// Published snapshot that owns the runtime settings
  @BuiltValueField(wireName: r'publishedSnapshotId')
  String get publishedSnapshotId;

  @BuiltValueField(wireName: r'exchangeAccountId')
  String? get exchangeAccountId;

  @BuiltValueField(wireName: r'exchangeAccountName')
  String? get exchangeAccountName;

  /// Deployment execution config passthrough (currently leverage override).
  @BuiltValueField(wireName: r'deploymentExecutionConfig')
  BuiltMap<String, JsonObject?>? get deploymentExecutionConfig;

  AccountAiQuantDeployRequestDto._();

  factory AccountAiQuantDeployRequestDto([void updates(AccountAiQuantDeployRequestDtoBuilder b)]) = _$AccountAiQuantDeployRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantDeployRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantDeployRequestDto> get serializer => _$AccountAiQuantDeployRequestDtoSerializer();
}

class _$AccountAiQuantDeployRequestDtoSerializer implements PrimitiveSerializer<AccountAiQuantDeployRequestDto> {
  @override
  final Iterable<Type> types = const [AccountAiQuantDeployRequestDto, _$AccountAiQuantDeployRequestDto];

  @override
  final String wireName = r'AccountAiQuantDeployRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantDeployRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'deployRequestId';
    yield serializers.serialize(
      object.deployRequestId,
      specifiedType: const FullType(String),
    );
    yield r'publishedSnapshotId';
    yield serializers.serialize(
      object.publishedSnapshotId,
      specifiedType: const FullType(String),
    );
    if (object.exchangeAccountId != null) {
      yield r'exchangeAccountId';
      yield serializers.serialize(
        object.exchangeAccountId,
        specifiedType: const FullType(String),
      );
    }
    if (object.exchangeAccountName != null) {
      yield r'exchangeAccountName';
      yield serializers.serialize(
        object.exchangeAccountName,
        specifiedType: const FullType(String),
      );
    }
    if (object.deploymentExecutionConfig != null) {
      yield r'deploymentExecutionConfig';
      yield serializers.serialize(
        object.deploymentExecutionConfig,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantDeployRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantDeployRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'deployRequestId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.deployRequestId = valueDes;
          break;
        case r'publishedSnapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.publishedSnapshotId = valueDes;
          break;
        case r'exchangeAccountId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchangeAccountId = valueDes;
          break;
        case r'exchangeAccountName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchangeAccountName = valueDes;
          break;
        case r'deploymentExecutionConfig':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.deploymentExecutionConfig.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountAiQuantDeployRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantDeployRequestDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}


//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_job_response_dto.g.dart';

/// BacktestingJobResponseDto
///
/// Properties:
/// * [id] 
/// * [status] 
/// * [createdAt] 
/// * [startedAt] 
/// * [finishedAt] 
/// * [error] 
/// * [errorDetails] 
/// * [inputSummary] 
/// * [resultSummary] 
@BuiltValue()
abstract class BacktestingJobResponseDto implements Built<BacktestingJobResponseDto, BacktestingJobResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'status')
  BacktestingJobResponseDtoStatusEnum get status;
  // enum statusEnum {  queued,  running,  succeeded,  failed,  };

  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  @BuiltValueField(wireName: r'startedAt')
  String? get startedAt;

  @BuiltValueField(wireName: r'finishedAt')
  String? get finishedAt;

  @BuiltValueField(wireName: r'error')
  String? get error;

  @BuiltValueField(wireName: r'errorDetails')
  BuiltMap<String, JsonObject?>? get errorDetails;

  @BuiltValueField(wireName: r'inputSummary')
  BuiltMap<String, JsonObject?> get inputSummary;

  @BuiltValueField(wireName: r'resultSummary')
  BuiltMap<String, JsonObject?>? get resultSummary;

  BacktestingJobResponseDto._();

  factory BacktestingJobResponseDto([void updates(BacktestingJobResponseDtoBuilder b)]) = _$BacktestingJobResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingJobResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingJobResponseDto> get serializer => _$BacktestingJobResponseDtoSerializer();
}

class _$BacktestingJobResponseDtoSerializer implements PrimitiveSerializer<BacktestingJobResponseDto> {
  @override
  final Iterable<Type> types = const [BacktestingJobResponseDto, _$BacktestingJobResponseDto];

  @override
  final String wireName = r'BacktestingJobResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingJobResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(BacktestingJobResponseDtoStatusEnum),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
    if (object.startedAt != null) {
      yield r'startedAt';
      yield serializers.serialize(
        object.startedAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.finishedAt != null) {
      yield r'finishedAt';
      yield serializers.serialize(
        object.finishedAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.error != null) {
      yield r'error';
      yield serializers.serialize(
        object.error,
        specifiedType: const FullType(String),
      );
    }
    if (object.errorDetails != null) {
      yield r'errorDetails';
      yield serializers.serialize(
        object.errorDetails,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    yield r'inputSummary';
    yield serializers.serialize(
      object.inputSummary,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    if (object.resultSummary != null) {
      yield r'resultSummary';
      yield serializers.serialize(
        object.resultSummary,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingJobResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingJobResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingJobResponseDtoStatusEnum),
          ) as BacktestingJobResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        case r'startedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.startedAt = valueDes;
          break;
        case r'finishedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.finishedAt = valueDes;
          break;
        case r'error':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.error = valueDes;
          break;
        case r'errorDetails':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.errorDetails.replace(valueDes);
          break;
        case r'inputSummary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.inputSummary.replace(valueDes);
          break;
        case r'resultSummary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.resultSummary.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingJobResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingJobResponseDtoBuilder();
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

class BacktestingJobResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'queued')
  static const BacktestingJobResponseDtoStatusEnum queued = _$backtestingJobResponseDtoStatusEnum_queued;
  @BuiltValueEnumConst(wireName: r'running')
  static const BacktestingJobResponseDtoStatusEnum running = _$backtestingJobResponseDtoStatusEnum_running;
  @BuiltValueEnumConst(wireName: r'succeeded')
  static const BacktestingJobResponseDtoStatusEnum succeeded = _$backtestingJobResponseDtoStatusEnum_succeeded;
  @BuiltValueEnumConst(wireName: r'failed')
  static const BacktestingJobResponseDtoStatusEnum failed = _$backtestingJobResponseDtoStatusEnum_failed;

  static Serializer<BacktestingJobResponseDtoStatusEnum> get serializer => _$backtestingJobResponseDtoStatusEnumSerializer;

  const BacktestingJobResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<BacktestingJobResponseDtoStatusEnum> get values => _$backtestingJobResponseDtoStatusEnumValues;
  static BacktestingJobResponseDtoStatusEnum valueOf(String name) => _$backtestingJobResponseDtoStatusEnumValueOf(name);
}


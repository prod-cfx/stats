//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_create_job_input_summary_dto.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_summary_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/backtesting_create_job_error_details_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_response_dto.g.dart';

/// BacktestingCreateJobResponseDto
///
/// Properties:
/// * [id] - 回测任务 ID
/// * [status] - 回测任务状态
/// * [createdAt] - 任务创建时间（ISO 8601）
/// * [startedAt] 
/// * [finishedAt] 
/// * [error] 
/// * [errorDetails] 
/// * [inputSummary] 
/// * [resultSummary] 
@BuiltValue()
abstract class BacktestingCreateJobResponseDto implements Built<BacktestingCreateJobResponseDto, BacktestingCreateJobResponseDtoBuilder> {
  /// 回测任务 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 回测任务状态
  @BuiltValueField(wireName: r'status')
  BacktestingCreateJobResponseDtoStatusEnum get status;
  // enum statusEnum {  queued,  running,  succeeded,  failed,  };

  /// 任务创建时间（ISO 8601）
  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  @BuiltValueField(wireName: r'startedAt')
  String? get startedAt;

  @BuiltValueField(wireName: r'finishedAt')
  String? get finishedAt;

  @BuiltValueField(wireName: r'error')
  String? get error;

  @BuiltValueField(wireName: r'errorDetails')
  BacktestingCreateJobErrorDetailsDto? get errorDetails;

  @BuiltValueField(wireName: r'inputSummary')
  BacktestingCreateJobInputSummaryDto get inputSummary;

  @BuiltValueField(wireName: r'resultSummary')
  BacktestingCreateJobSummaryDto? get resultSummary;

  BacktestingCreateJobResponseDto._();

  factory BacktestingCreateJobResponseDto([void updates(BacktestingCreateJobResponseDtoBuilder b)]) = _$BacktestingCreateJobResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobResponseDto> get serializer => _$BacktestingCreateJobResponseDtoSerializer();
}

class _$BacktestingCreateJobResponseDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobResponseDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobResponseDto, _$BacktestingCreateJobResponseDto];

  @override
  final String wireName = r'BacktestingCreateJobResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobResponseDto object, {
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
      specifiedType: const FullType(BacktestingCreateJobResponseDtoStatusEnum),
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
        specifiedType: const FullType(BacktestingCreateJobErrorDetailsDto),
      );
    }
    yield r'inputSummary';
    yield serializers.serialize(
      object.inputSummary,
      specifiedType: const FullType(BacktestingCreateJobInputSummaryDto),
    );
    if (object.resultSummary != null) {
      yield r'resultSummary';
      yield serializers.serialize(
        object.resultSummary,
        specifiedType: const FullType(BacktestingCreateJobSummaryDto),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobResponseDtoBuilder result,
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
            specifiedType: const FullType(BacktestingCreateJobResponseDtoStatusEnum),
          ) as BacktestingCreateJobResponseDtoStatusEnum;
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
            specifiedType: const FullType(BacktestingCreateJobErrorDetailsDto),
          ) as BacktestingCreateJobErrorDetailsDto;
          result.errorDetails.replace(valueDes);
          break;
        case r'inputSummary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobInputSummaryDto),
          ) as BacktestingCreateJobInputSummaryDto;
          result.inputSummary.replace(valueDes);
          break;
        case r'resultSummary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobSummaryDto),
          ) as BacktestingCreateJobSummaryDto;
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
  BacktestingCreateJobResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobResponseDtoBuilder();
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

class BacktestingCreateJobResponseDtoStatusEnum extends EnumClass {

  /// 回测任务状态
  @BuiltValueEnumConst(wireName: r'queued')
  static const BacktestingCreateJobResponseDtoStatusEnum queued = _$backtestingCreateJobResponseDtoStatusEnum_queued;
  /// 回测任务状态
  @BuiltValueEnumConst(wireName: r'running')
  static const BacktestingCreateJobResponseDtoStatusEnum running = _$backtestingCreateJobResponseDtoStatusEnum_running;
  /// 回测任务状态
  @BuiltValueEnumConst(wireName: r'succeeded')
  static const BacktestingCreateJobResponseDtoStatusEnum succeeded = _$backtestingCreateJobResponseDtoStatusEnum_succeeded;
  /// 回测任务状态
  @BuiltValueEnumConst(wireName: r'failed')
  static const BacktestingCreateJobResponseDtoStatusEnum failed = _$backtestingCreateJobResponseDtoStatusEnum_failed;

  static Serializer<BacktestingCreateJobResponseDtoStatusEnum> get serializer => _$backtestingCreateJobResponseDtoStatusEnumSerializer;

  const BacktestingCreateJobResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobResponseDtoStatusEnum> get values => _$backtestingCreateJobResponseDtoStatusEnumValues;
  static BacktestingCreateJobResponseDtoStatusEnum valueOf(String name) => _$backtestingCreateJobResponseDtoStatusEnumValueOf(name);
}


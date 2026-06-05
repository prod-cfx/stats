// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_alert_side.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleAlertSide _$long = const WhaleAlertSide._('long');
const WhaleAlertSide _$short = const WhaleAlertSide._('short');

WhaleAlertSide _$valueOf(String name) {
  switch (name) {
    case 'long':
      return _$long;
    case 'short':
      return _$short;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleAlertSide> _$values = BuiltSet<WhaleAlertSide>(
  const <WhaleAlertSide>[_$long, _$short],
);

class _$WhaleAlertSideMeta {
  const _$WhaleAlertSideMeta();
  WhaleAlertSide get long => _$long;
  WhaleAlertSide get short => _$short;
  WhaleAlertSide valueOf(String name) => _$valueOf(name);
  BuiltSet<WhaleAlertSide> get values => _$values;
}

mixin _$WhaleAlertSideMixin {
  // ignore: non_constant_identifier_names
  _$WhaleAlertSideMeta get WhaleAlertSide => const _$WhaleAlertSideMeta();
}

Serializer<WhaleAlertSide> _$whaleAlertSideSerializer =
    _$WhaleAlertSideSerializer();

class _$WhaleAlertSideSerializer
    implements PrimitiveSerializer<WhaleAlertSide> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'long': 'Long',
    'short': 'Short',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'Long': 'long',
    'Short': 'short',
  };

  @override
  final Iterable<Type> types = const <Type>[WhaleAlertSide];
  @override
  final String wireName = 'WhaleAlertSide';

  @override
  Object serialize(
    Serializers serializers,
    WhaleAlertSide object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleAlertSide deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleAlertSide.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint

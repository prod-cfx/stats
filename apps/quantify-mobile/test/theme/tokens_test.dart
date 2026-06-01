import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/theme/tokens.dart';

/// Helper: assert that `actual` is `base` channels overlaid with `alpha`.
void _expectDarkSoft(Color actual, {required Color base, required double alpha}) {
  expect(actual.a, closeTo(alpha, 0.005),
      reason: 'alpha for dark-soft over $base');
  final Color rgb = Color.fromARGB(
    255,
    (actual.r * 255).round(),
    (actual.g * 255).round(),
    (actual.b * 255).round(),
  );
  expect(rgb, base, reason: 'base RGB for dark-soft over $base @ $alpha');
}

void main() {
  group('QzRadii / QzCurves / QzSpacing', () {
    test('radius tokens match tokens.css', () {
      expect(QzRadii.card, 14);
      expect(QzRadii.input, 10);
      expect(QzRadii.pill, 999);
    });

    test('curve duration tokens match prototype 240ms / 360ms', () {
      expect(QzCurves.short.inMilliseconds, 240);
      expect(QzCurves.long.inMilliseconds, 360);
      expect(QzCurves.standard, const Cubic(0.32, 0.72, 0.0, 1.0));
      expect(QzCurves.sheetPanel, const Cubic(0.2, 0.8, 0.2, 1.0));
      expect(QzCurves.sheetPanelDuration.inMilliseconds, 260);
      expect(QzCurves.sheetScrimDuration.inMilliseconds, 180);
    });

    test('spacing scale present and monotonic', () {
      expect(QzSpacing.xxs < QzSpacing.xs, isTrue);
      expect(QzSpacing.xs < QzSpacing.sm, isTrue);
      expect(QzSpacing.sm < QzSpacing.md, isTrue);
      expect(QzSpacing.md < QzSpacing.lg, isTrue);
      expect(QzSpacing.lg < QzSpacing.xl, isTrue);
      expect(QzSpacing.xl < QzSpacing.xxl, isTrue);
    });
  });

  group('qzColors — 1:1 with tokens.css', () {
    test('light + violet surfaces', () {
      final QzColorScheme c = qzColors(QzBg.light, QzAccent.violet);
      expect(c.bg, const Color(0xFFF4F5F8));
      expect(c.bgElev, const Color(0xFFFFFFFF));
      expect(c.bgSoft, const Color(0xFFF8F9FC));
      expect(c.text, const Color(0xFF0F1623));
      expect(c.border, const Color(0xFFE6E8EE));
      expect(c.brightness, Brightness.light);
      // violet accent
      expect(c.accent, const Color(0xFF7C5CFF));
      expect(c.accentSoft, const Color(0xFFF2EEFF));
      expect(c.accentOn, const Color(0xFFFFFFFF));
    });

    test('pink + violet surfaces', () {
      final QzColorScheme c = qzColors(QzBg.pink, QzAccent.violet);
      expect(c.bg, const Color(0xFFFFF1F5));
      expect(c.text, const Color(0xFF2A0F1F));
      expect(c.brightness, Brightness.light);
    });

    test('dark + cyan surfaces and alpha-baked soft', () {
      final QzColorScheme c = qzColors(QzBg.dark, QzAccent.cyan);
      expect(c.bg, const Color(0xFF0F0B22));
      expect(c.text, const Color(0xFFF5F4FB));
      expect(c.brightness, Brightness.dark);
      expect(c.accent, const Color(0xFF06B6D4));
      // tokens.css: rgba(34,211,238,0.18) = accent2 @ 0.18
      _expectDarkSoft(c.accentSoft, base: const Color(0xFF22D3EE), alpha: 0.18);
    });

    test(
      'dark accent-soft base color matches tokens.css per accent (C1 fix)',
      () {
        // violet → accent (#7C5CFF) per `[data-theme="dark"][data-accent="violet"]`
        _expectDarkSoft(
          qzColors(QzBg.dark, QzAccent.violet).accentSoft,
          base: const Color(0xFF7C5CFF),
          alpha: 0.18,
        );
        // cyan → accent2 (#22D3EE)
        _expectDarkSoft(
          qzColors(QzBg.dark, QzAccent.cyan).accentSoft,
          base: const Color(0xFF22D3EE),
          alpha: 0.18,
        );
        // amber → accent2 (#F59E0B), alpha 0.20
        _expectDarkSoft(
          qzColors(QzBg.dark, QzAccent.amber).accentSoft,
          base: const Color(0xFFF59E0B),
          alpha: 0.20,
        );
      },
    );

    test('all 9 (bg, accent) combinations produce non-transparent core colors',
        () {
      for (final QzBg bg in QzBg.values) {
        for (final QzAccent ac in QzAccent.values) {
          final QzColorScheme c = qzColors(bg, ac);
          expect(c.bg.a, greaterThan(0.99),
              reason: 'bg solid for $bg/$ac');
          expect(c.accent.a, greaterThan(0.99),
              reason: 'accent solid for $bg/$ac');
          expect(c.text.a, greaterThan(0.99),
              reason: 'text solid for $bg/$ac');
        }
      }
    });
  });

  group('Status color routing (M3 fix)', () {
    test('light + pink themes use the light status palette', () {
      for (final QzBg bg in <QzBg>[QzBg.light, QzBg.pink]) {
        final QzColorScheme c = qzColors(bg, QzAccent.violet);
        expect(c.statusDanger, const Color(0xFFDC4646));
        expect(c.statusOk, const Color(0xFF16A36B));
        expect(c.statusWarn, const Color(0xFFD98008));
        expect(c.statusInfo, const Color(0xFF2A6FDB));
        expect(c.marketUp, const Color(0xFF16A36B));
        expect(c.marketDown, const Color(0xFFE5484D));
      }
    });

    test('dark theme uses the dark status palette', () {
      final QzColorScheme c = qzColors(QzBg.dark, QzAccent.violet);
      expect(c.statusDanger, const Color(0xFFF87171));
      expect(c.statusOk, const Color(0xFF34D399));
      expect(c.statusWarn, const Color(0xFFFBBF24));
      expect(c.statusInfo, const Color(0xFF60A5FA));
      expect(c.marketUp, const Color(0xFF34D399));
      expect(c.marketDown, const Color(0xFFF87171));
    });

    test(
      'buildQzThemeData wires the per-bg statusDanger into ColorScheme.error',
      () {
        for (final QzBg bg in QzBg.values) {
          for (final QzAccent ac in QzAccent.values) {
            final ThemeData td = buildQzThemeData(QzTheme(bg: bg, accent: ac));
            expect(td.colorScheme.error, qzColors(bg, ac).statusDanger,
                reason: 'error matches statusDanger for $bg/$ac');
          }
        }
      },
    );
  });

  group('QzShadow', () {
    test('exposes 3 elevation steps per bg theme', () {
      expect(QzShadow.lightSm.length, 1);
      expect(QzShadow.lightMd.length, 1);
      expect(QzShadow.lightLg.length, 1);
      expect(QzShadow.pinkMd.first.blurRadius, 14);
      expect(QzShadow.darkLg.first.blurRadius, 40);
    });
  });
}

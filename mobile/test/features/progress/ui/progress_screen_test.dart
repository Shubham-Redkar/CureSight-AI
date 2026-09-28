import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/progress/ui/progress_screen.dart';
import 'package:mobile/features/assessments/models/assessment_model.dart';
import 'package:mobile/features/assessments/providers/assessment_provider.dart';

void main() {
  group('ProgressScreen', () {
    testWidgets('Shows loading state', (tester) async {
      final completer = Completer<List<AssessmentModel>>();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => completer.future),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      completer.complete([]);
    });

    testWidgets('Shows error state', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.error(Exception('Failed to load'))),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Failed to load'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('Shows empty state when no valid assessments', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'PENDING', verified: false,
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('No completed assessments available.'), findsOneWidget);
    });

    testWidgets('Shows insufficient historical measurements when only 1 valid assessment', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
                woundDetected: true,
                measurements: {'total_area_cm2': 10.0},
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Not enough historical measurements'), findsOneWidget);
      // Ledger should still be present
      expect(find.text('Historical Ledger'), findsOneWidget);
    });

    testWidgets('Shows chart and correct percentage when 2+ assessments', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now().subtract(const Duration(days: 2)), status: 'COMPLETED', verified: true,
                woundDetected: true,
                measurements: {'total_area_cm2': 20.0},
              ),
              AssessmentModel(
                id: 2, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
                woundDetected: true,
                measurements: {'total_area_cm2': 15.0},
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Area change since first measurement'), findsOneWidget);
      
      // Absolute change: 15 - 20 = -5
      // % change: -5/20 = -25%
      expect(find.text('-25.0%'), findsOneWidget);
      expect(find.text('20.0 cm²'), findsOneWidget); // Baseline
      expect(find.text('15.0 cm²'), findsOneWidget); // Latest
    });

    testWidgets('No wound detected event handling', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
                woundDetected: false,
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Clinical Event: No wound detected'), findsOneWidget);
    });

    testWidgets('Doctor override: AI says yes, doctor says no', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'VERIFIED', verified: true,
                woundDetected: true,
                measurements: {'total_area_cm2': 12.5},
                verifiedResult: {'woundDetected': false}, // Doctor override
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      // Should NOT plot 12.5 (empty state)
      expect(find.text('Not enough historical measurements'), findsOneWidget);
      // Ledger should show clinical event instead of measurements
      expect(find.text('Clinical Event: No wound detected'), findsOneWidget);
    });

    testWidgets('Doctor override: AI says no, doctor says yes', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            assessmentsProvider(1).overrideWith((ref) => Future.value([
              AssessmentModel(
                id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'VERIFIED', verified: true,
                woundDetected: false,
                measurements: {'total_area_cm2': 12.5},
                verifiedResult: {'woundDetected': true}, // Doctor override
              )
            ])),
          ],
          child: const MaterialApp(home: ProgressScreen(woundId: 1)),
        ),
      );

      await tester.pumpAndSettle();
      // Only 1 point, so it says not enough
      expect(find.text('Not enough historical measurements'), findsOneWidget);
      // Ledger should show the area measurements
      expect(find.text('12.5 cm²'), findsOneWidget);
    });
  });
}

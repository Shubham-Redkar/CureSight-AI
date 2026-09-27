import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/reports/models/report_list_model.dart';
import 'package:mobile/features/reports/providers/report_provider.dart';
import 'package:mobile/features/reports/ui/reports_list_screen.dart';

void main() {
  group('ReportsListScreen', () {
    testWidgets('Shows loading state', (tester) async {
      final completer = Completer<List<ReportListItemModel>>();
      
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            reportListProvider.overrideWith(
              (ref) => completer.future,
            ),
          ],
          child: const MaterialApp(
            home: ReportsListScreen(),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      completer.complete([]);
    });

    testWidgets('Shows empty state', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            reportListProvider.overrideWith((ref) => Future.value([])),
          ],
          child: const MaterialApp(
            home: ReportsListScreen(),
          ),
        ),
      );
      
      await tester.pumpAndSettle();

      expect(find.text('No clinical reports available yet.'), findsOneWidget);
    });

    testWidgets('Shows list of reports', (tester) async {
      final reports = [
        ReportListItemModel(
          id: 1,
          woundId: 1,
          assessmentDate: DateTime.now(),
          status: 'COMPLETED',
          verified: true,
          wound: ReportListWoundModel(
            id: 1,
            location: 'Right Arm',
            patient: ReportListPatientModel(
              id: 1,
              patientCode: 'P-TEST',
              name: 'Alice',
            ),
          ),
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            reportListProvider.overrideWith((ref) => Future.value(reports)),
          ],
          child: const MaterialApp(
            home: ReportsListScreen(),
          ),
        ),
      );
      
      await tester.pumpAndSettle();

      expect(find.text('Alice'), findsOneWidget);
      expect(find.text('P-TEST'), findsOneWidget);
      expect(find.text('Wound: Right Arm'), findsOneWidget);
      expect(find.byIcon(Icons.verified), findsOneWidget);
    });

    testWidgets('Shows error state', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            reportListProvider.overrideWith((ref) => Future.error(Exception('Failed to load'))),
          ],
          child: const MaterialApp(
            home: ReportsListScreen(),
          ),
        ),
      );
      
      await tester.pumpAndSettle();

      expect(find.text('Failed to load'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}

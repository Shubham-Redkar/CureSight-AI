import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/assessments/ui/assessment_detail_screen.dart';
import 'package:mobile/features/assessments/models/assessment_model.dart';

import 'package:dio/dio.dart';
import 'package:mobile/core/network/dio_client.dart';

void main() {
  setUpAll(() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/auth/me')) {
          return handler.resolve(Response(
            requestOptions: options,
            statusCode: 200,
            data: {'authenticated': true, 'user': {'id': '1', 'username': 'test_user', 'role': 'DOCTOR'}}
          ));
        }
        if (options.path.contains('/assessments')) {
          return handler.resolve(Response(
            requestOptions: options,
            statusCode: 200,
            data: {'assessments': []}
          ));
        }
        return handler.resolve(Response(
          requestOptions: options,
          statusCode: 200,
          data: {}
        ));
      }
    ));
    DioClient.setMockDio(dio);
  });

  group('AssessmentDetailScreen Measurements Section', () {
    Widget buildTestWidget(AssessmentModel assessment) {
      return ProviderScope(
        child: MaterialApp(
          home: AssessmentDetailScreen(assessment: assessment),
        ),
      );
    }

    testWidgets('1. One wound with length/width', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 12.5,
          'total_perimeter_cm': 15.2,
          'wound_count': 1,
          'color_classification': {'label': 'Granulation', 'emoji': '🔴'},
          'physical_measurement_available': true,
          'wounds': [
            {'length_cm': 5.2, 'width_cm': 3.1}
          ]
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Total Area'), findsOneWidget);
      expect(find.text('12.50 cm²'), findsOneWidget);
      expect(find.text('Total Perimeter'), findsOneWidget);
      expect(find.text('15.20 cm'), findsOneWidget);
      expect(find.text('Wound Count'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('Length'), findsOneWidget);
      expect(find.text('5.20 cm'), findsOneWidget);
      expect(find.text('Width'), findsOneWidget);
      expect(find.text('3.10 cm'), findsOneWidget);
      expect(find.text('🔴 Granulation'), findsOneWidget);
      expect(find.text('Available'), findsOneWidget); // Calibration
      expect(find.textContaining('calibrated using the reference object'), findsOneWidget);
    });
    
    testWidgets('2. Multiple wounds', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 25.0,
          'total_perimeter_cm': 30.0,
          'wound_count': 2,
          'color_classification': 'Mixed',
          'physical_measurement_available': true,
          'wounds': [
            {'length_cm': 5.2, 'width_cm': 3.1, 'area_cm2': 15.0, 'perimeter_cm': 18.0, 'detection_confidence': 0.95},
            {'length_cm': 2.0, 'width_cm': 2.0, 'area_cm2': 10.0, 'perimeter_cm': 12.0, 'detection_confidence': 0.88}
          ]
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Total Area'), findsOneWidget);
      expect(find.text('25.00 cm²'), findsOneWidget);
      expect(find.text('Total Perimeter'), findsOneWidget);
      expect(find.text('30.00 cm'), findsOneWidget);
      expect(find.text('Wound Count'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      
      // Should NOT have a global Length/Width
      expect(find.text('Length'), findsNWidgets(2)); // Only inside the two Wound cards
      expect(find.text('Width'), findsNWidgets(2));
      
      // Should have Wound Dimensions section
      expect(find.text('Wound Dimensions'), findsOneWidget);
      expect(find.text('Wound 1'), findsOneWidget);
      expect(find.text('5.20 cm'), findsOneWidget);
      expect(find.text('3.10 cm'), findsOneWidget);
      expect(find.text('15.00 cm²'), findsOneWidget);
      expect(find.text('18.00 cm'), findsOneWidget);
      expect(find.text('95%'), findsOneWidget);

      expect(find.text('Wound 2'), findsOneWidget);
      expect(find.text('2.00 cm'), findsNWidgets(2)); // length and width
      expect(find.text('10.00 cm²'), findsOneWidget);
      expect(find.text('12.00 cm'), findsOneWidget);
      expect(find.text('88%'), findsOneWidget);
    });

    testWidgets('3. Missing length/width', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 12.5,
          'wound_count': 1,
          'wounds': [] // No length/width
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Total Area'), findsOneWidget);
      expect(find.text('Length'), findsNothing);
      expect(find.text('Width'), findsNothing);
      expect(find.text('Wound Dimensions'), findsNothing);
    });

    testWidgets('4. Physical measurement unavailable (uncalibrated)', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 12.5,
          'physical_measurement_available': false,
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Unavailable'), findsOneWidget); // Calibration
      expect(find.textContaining('uncalibrated (no reference object found)'), findsOneWidget);
    });

    testWidgets('5. Zero-wound assessment', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: false,
        measurements: {
          'total_area_cm2': 12.5, // Should be ignored
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Physical Measurements'), findsOneWidget);
      expect(find.text('Not available'), findsOneWidget);
      expect(find.text('No wound detected'), findsOneWidget); // Under AI Analysis
    });

    testWidgets('6. Missing/null measurement fields', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {}, // empty map
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('No data available'), findsOneWidget); // Physical measurements
    });

    testWidgets('7. Verified assessment (Doctor Override)', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'VERIFIED', verified: true,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 12.5,
        },
        verifiedResult: {
          'woundDetected': false // Doctor override
        }
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      // Because Doctor says no wound, physical measurements are not available
      expect(find.text('Not available'), findsOneWidget);
      
      // AI analysis still says detected
      expect(find.text('Detected'), findsOneWidget);

      // Doctor verification section
      expect(find.text('Doctor Verification'), findsOneWidget);
      expect(find.text('No wound detected'), findsOneWidget); // For Doctor
      expect(find.text('Verified'), findsOneWidget);
    });
    
    testWidgets('8. Existing UI behavior/regression - Unverified assessment', (tester) async {
      final assessment = AssessmentModel(
        id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false,
        woundDetected: true,
        measurements: {
          'total_area_cm2': 12.5,
        },
      );

      await tester.pumpWidget(buildTestWidget(assessment));
      await tester.pumpAndSettle();

      expect(find.text('Doctor Verification'), findsOneWidget); // Because mocked user is DOCTOR
      expect(find.text('Verified'), findsNothing);
    });
  });
}

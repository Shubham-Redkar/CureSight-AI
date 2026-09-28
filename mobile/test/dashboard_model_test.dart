import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/dashboard/models/dashboard_summary_model.dart';

void main() {
  group('DashboardSummaryModel Tests', () {
    test('fromJson parses correctly', () {
      final json = {
        'totalPatients': 10,
        'activeWounds': 5,
        'pendingReview': 2,
        'verifiedAssessments': 8,
        'recentAssessments': [
          {
            'id': 1,
            'woundId': 100,
            'assessmentDate': '2023-10-01T12:00:00Z',
            'status': 'COMPLETED',
            'verified': true,
            'createdAt': '2023-10-01T12:00:00Z',
            'wound': {
              'id': 100,
              'patientId': 50,
              'location': 'Left Leg',
              'patient': {
                'id': 50,
                'patientCode': 'P001',
                'name': 'John Doe'
              }
            }
          }
        ]
      };

      final model = DashboardSummaryModel.fromJson(json);

      expect(model.totalPatients, 10);
      expect(model.activeWounds, 5);
      expect(model.pendingReview, 2);
      expect(model.verifiedAssessments, 8);
      expect(model.recentAssessments.length, 1);
      
      final assessment = model.recentAssessments.first;
      expect(assessment.id, 1);
      expect(assessment.status, 'COMPLETED');
      expect(assessment.verified, true);
      expect(assessment.wound?.location, 'Left Leg');
      expect(assessment.wound?.patient?.name, 'John Doe');
    });

    test('fromJson handles null values gracefully', () {
      final json = <String, dynamic>{};
      final model = DashboardSummaryModel.fromJson(json);

      expect(model.totalPatients, 0);
      expect(model.activeWounds, 0);
      expect(model.pendingReview, 0);
      expect(model.verifiedAssessments, 0);
      expect(model.recentAssessments.isEmpty, true);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reports/models/report_list_model.dart';

void main() {
  group('ReportListResponse', () {
    final validJson = {
      'status': 'ok',
      'reports': [
        {
          'id': 100,
          'woundId': 10,
          'assessmentDate': '2023-10-01T12:00:00Z',
          'status': 'COMPLETED',
          'verified': true,
          'wound': {
            'id': 10,
            'location': 'Left Leg',
            'patient': {
              'id': 1,
              'patientCode': 'P123',
              'name': 'John Doe',
            }
          }
        }
      ]
    };

    test('Test Successful report list parsing', () {
      final response = ReportListResponse.fromJson(validJson);
      
      expect(response.reports.length, 1);
      
      final report = response.reports.first;
      expect(report.id, 100);
      expect(report.woundId, 10);
      expect(report.status, 'COMPLETED');
      expect(report.verified, true);
      
      expect(report.wound.id, 10);
      expect(report.wound.location, 'Left Leg');
      
      expect(report.wound.patient.id, 1);
      expect(report.wound.patient.patientCode, 'P123');
      expect(report.wound.patient.name, 'John Doe');
    });

    test('Test Empty report list', () {
      final emptyJson = {
        'status': 'ok',
        'reports': []
      };

      final response = ReportListResponse.fromJson(emptyJson);
      
      expect(response.reports, isEmpty);
    });
  });
}

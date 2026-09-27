import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reports/models/report_model.dart';

void main() {
  group('ClinicalReportModel', () {
    final validJson = {
      'patient': {
        'id': 1,
        'patientCode': 'P123',
        'name': 'John Doe',
        'age': 45,
      },
      'wound': {
        'id': 10,
        'patientId': 1,
        'location': 'Left Leg',
        'description': 'A small wound',
      },
      'assessment': {
        'id': 100,
        'woundId': 10,
        'assessmentDate': '2023-10-01T12:00:00Z',
        'status': 'COMPLETED',
        'woundDetected': true,
        'notes': 'Looking good',
        'measurements': {
          'total_area_cm2': 12.5,
          'wound_count': 1,
        }
      },
      'images': {
        'originalUrl': 'img1.jpg',
        'annotatedUrl': 'img2.jpg',
      },
      'progress': {
        'previousAssessment': {
          'id': 99,
          'date': '2023-09-25T12:00:00Z',
          'area_cm2': 15.0,
        },
        'currentArea_cm2': 12.5,
        'areaChangePct': -16.6,
        'status': 'improving',
      },
    };

    test('Test 1 & 3 - Successful report parsing including progress data', () {
      final model = ClinicalReportModel.fromJson(validJson);
      
      expect(model.patient.name, 'John Doe');
      expect(model.wound.location, 'Left Leg');
      expect(model.assessment.woundDetected, true);
      expect(model.assessment.measurements?['total_area_cm2'], 12.5);
      expect(model.images.originalUrl, 'img1.jpg');
      
      // Progress data
      expect(model.progress.status, 'improving');
      expect(model.progress.areaChangePct, -16.6);
      expect(model.progress.previousAssessment?.id, 99);
      expect(model.progress.previousAssessment?.areaCm2, 15.0);
    });

    test('Test 2 & 4 - Nullable fields and Empty historical data', () {
      final nullJson = {
        'patient': {
          'id': 1,
          'patientCode': 'P123',
          'name': 'John Doe',
          'age': null,
        },
        'wound': {
          'id': 10,
          'patientId': 1,
          'location': 'Left Leg',
          'description': null,
        },
        'assessment': {
          'id': 100,
          'woundId': 10,
          'assessmentDate': '2023-10-01T12:00:00Z',
          'status': 'COMPLETED',
          'woundDetected': null,
          'notes': null,
          'measurements': null,
        },
        'images': {
          'originalUrl': null,
          'annotatedUrl': null,
        },
        'progress': {
          'previousAssessment': null,
          'currentArea_cm2': null,
          'areaChangePct': null,
          'status': 'insufficient_data',
        },
      };

      final model = ClinicalReportModel.fromJson(nullJson);
      
      expect(model.patient.age, null);
      expect(model.wound.description, null);
      expect(model.assessment.woundDetected, null);
      expect(model.assessment.measurements, null);
      expect(model.images.originalUrl, null);
      
      expect(model.progress.previousAssessment, null);
      expect(model.progress.areaChangePct, null);
      expect(model.progress.status, 'insufficient_data');
    });
  });
}

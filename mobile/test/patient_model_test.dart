import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/patients/models/patient_model.dart';

void main() {
  group('PatientModel Tests', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 1,
        'patientCode': 'P-1001',
        'name': 'John Doe',
        'age': 35,
        'createdAt': '2023-10-01T12:00:00Z',
        'updatedAt': '2023-10-02T12:00:00Z',
      };

      final model = PatientModel.fromJson(json);

      expect(model.id, 1);
      expect(model.patientCode, 'P-1001');
      expect(model.name, 'John Doe');
      expect(model.age, 35);
      expect(model.createdAt, DateTime.parse('2023-10-01T12:00:00Z'));
      expect(model.updatedAt, DateTime.parse('2023-10-02T12:00:00Z'));
    });

    test('fromJson parses correctly with missing optional fields', () {
      final json = {
        'id': 2,
        'patientCode': 'P-1002',
        'name': 'Jane Doe',
        'createdAt': '2023-10-01T12:00:00Z',
        'updatedAt': '2023-10-01T12:00:00Z',
      };

      final model = PatientModel.fromJson(json);

      expect(model.id, 2);
      expect(model.patientCode, 'P-1002');
      expect(model.name, 'Jane Doe');
      expect(model.age, null);
    });
  });
}

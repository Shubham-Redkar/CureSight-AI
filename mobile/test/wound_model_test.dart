import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/wounds/models/wound_model.dart';

void main() {
  group('WoundModel Tests', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 1,
        'patientId': 5,
        'location': 'Left Arm',
        'description': 'Small scratch',
        'createdAt': '2023-10-01T12:00:00Z',
        'updatedAt': '2023-10-02T12:00:00Z',
      };

      final model = WoundModel.fromJson(json);

      expect(model.id, 1);
      expect(model.patientId, 5);
      expect(model.location, 'Left Arm');
      expect(model.description, 'Small scratch');
      expect(model.createdAt, DateTime.parse('2023-10-01T12:00:00Z'));
      expect(model.updatedAt, DateTime.parse('2023-10-02T12:00:00Z'));
    });

    test('fromJson parses correctly with missing optional fields', () {
      final json = {
        'id': 2,
        'patientId': 10,
        'location': 'Right Leg',
        'createdAt': '2023-10-01T12:00:00Z',
        'updatedAt': '2023-10-01T12:00:00Z',
      };

      final model = WoundModel.fromJson(json);

      expect(model.id, 2);
      expect(model.patientId, 10);
      expect(model.location, 'Right Leg');
      expect(model.description, null);
    });
  });
}

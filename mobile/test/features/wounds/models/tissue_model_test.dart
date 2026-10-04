import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/wounds/models/tissue_model.dart';

void main() {
  group('TissueModel', () {
    test('response deserialization with all tissue fields', () {
      final json = {
        "tissue_composition": {
          "epithelial": 10.5,
          "granulation": 65.5,
          "slough": 20.0,
          "necrotic": 14.5,
          "fibrin": 5.0,
          "callus": 2.0,
          "other": 1.0
        },
        "inference_metadata": {
          "model_name": "Tversky_ResNet34",
          "model_version": "a06_b04",
          "message": "Successfully calculated tissue composition."
        },
        "annotated_image_base64": "data:image/jpeg;base64,12345"
      };

      final response = AnalyzeTissueResponse.fromJson(json);

      expect(response.tissueComposition.epithelial, 10.5);
      expect(response.tissueComposition.granulation, 65.5);
      expect(response.tissueComposition.slough, 20.0);
      expect(response.tissueComposition.necrotic, 14.5);
      expect(response.tissueComposition.fibrin, 5.0);
      expect(response.tissueComposition.callus, 2.0);
      expect(response.tissueComposition.other, 1.0);
      
      expect(response.inferenceMetadata.modelName, 'Tversky_ResNet34');
      expect(response.inferenceMetadata.modelVersion, 'a06_b04');
      
      expect(response.annotatedImageBase64, 'data:image/jpeg;base64,12345');
    });

    test('zero/background-only prediction', () {
      final Map<String, dynamic> json = {
        "tissue_composition": <String, dynamic>{},
        "inference_metadata": <String, dynamic>{
          "model_name": "Tversky_ResNet34",
          "model_version": "a06_b04",
          "message": "No wound detected in image."
        },
        "annotated_image_base64": null
      };

      final response = AnalyzeTissueResponse.fromJson(json);

      expect(response.tissueComposition.epithelial, 0.0);
      expect(response.tissueComposition.granulation, 0.0);
      expect(response.tissueComposition.necrotic, 0.0);
      expect(response.annotatedImageBase64, null);
    });
  });
}

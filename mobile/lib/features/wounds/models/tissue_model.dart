class TissueCompositionPercentages {
  final double epithelial;
  final double granulation;
  final double slough;
  final double necrotic;
  final double fibrin;
  final double callus;
  final double other;

  TissueCompositionPercentages({
    required this.epithelial,
    required this.granulation,
    required this.slough,
    required this.necrotic,
    required this.fibrin,
    required this.callus,
    required this.other,
  });

  factory TissueCompositionPercentages.fromJson(Map<String, dynamic> json) {
    return TissueCompositionPercentages(
      epithelial: (json['epithelial'] ?? 0.0).toDouble(),
      granulation: (json['granulation'] ?? 0.0).toDouble(),
      slough: (json['slough'] ?? 0.0).toDouble(),
      necrotic: (json['necrotic'] ?? 0.0).toDouble(),
      fibrin: (json['fibrin'] ?? 0.0).toDouble(),
      callus: (json['callus'] ?? 0.0).toDouble(),
      other: (json['other'] ?? 0.0).toDouble(),
    );
  }
}

class InferenceMetadata {
  final String modelName;
  final String modelVersion;
  final String message;

  InferenceMetadata({
    required this.modelName,
    required this.modelVersion,
    required this.message,
  });

  factory InferenceMetadata.fromJson(Map<String, dynamic> json) {
    return InferenceMetadata(
      modelName: json['model_name'] ?? '',
      modelVersion: json['model_version'] ?? '',
      message: json['message'] ?? '',
    );
  }
}

class AnalyzeTissueResponse {
  final TissueCompositionPercentages tissueComposition;
  final InferenceMetadata inferenceMetadata;
  final String? annotatedImageBase64;

  AnalyzeTissueResponse({
    required this.tissueComposition,
    required this.inferenceMetadata,
    this.annotatedImageBase64,
  });

  factory AnalyzeTissueResponse.fromJson(Map<String, dynamic> json) {
    return AnalyzeTissueResponse(
      tissueComposition: TissueCompositionPercentages.fromJson(json['tissue_composition'] ?? {}),
      inferenceMetadata: InferenceMetadata.fromJson(json['inference_metadata'] ?? {}),
      annotatedImageBase64: json['annotated_image_base64'],
    );
  }
}

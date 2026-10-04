export interface TissueCompositionPercentages {
  epithelial: number;
  granulation: number;
  slough: number;
  necrotic: number;
  fibrin: number;
  callus: number;
  other: number;
}

export interface InferenceMetadata {
  model_name: string;
  model_version: string;
  message: string;
}

export interface AnalyzeTissueResponse {
  tissue_composition: TissueCompositionPercentages;
  inference_metadata: InferenceMetadata;
  annotated_image_base64: string | null;
}

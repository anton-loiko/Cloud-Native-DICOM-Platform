export interface StudyMetadata {
  studyInstanceUid: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  studyDescription: string;
  modalities: string[];
  seriesCount: number;
  totalInstances: number;
  createdAt: string;
}

export interface SeriesMetadata {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfInstances: number;
  bodyPartExamined?: string;
}

export interface InstanceMetadata {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number;
  s3Key: string;
  downloadUrl?: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  windowCenter?: number[];
  windowWidth?: number[];
  rescaleIntercept?: number;
  rescaleSlope?: number;
  pixelSpacing?: number[];
  imagePosition?: number[];
  imageOrientation?: number[];
}

export interface WindowLevelPreset {
  name: string;
  window: number;
  level: number;
  description: string;
}

export const COMMON_WL_PRESETS: WindowLevelPreset[] = [
  { name: 'Soft Tissue', window: 400, level: 40, description: 'General abdomen, muscles, organs' },
  { name: 'Lung', window: 1500, level: -600, description: 'Airways and lung parenchyma' },
  { name: 'Bone', window: 1800, level: 400, description: 'Cortical and trabecular bone' },
  { name: 'Brain', window: 80, level: 40, description: 'Gray/white matter differentiation' },
  { name: 'Stroke', window: 40, level: 40, description: 'Early ischemic changes' },
  { name: 'Liver', window: 150, level: 30, description: 'Hepatic lesions with contrast' },
];

export type ActiveTool = 'WindowLevel' | 'Pan' | 'Zoom' | 'Length' | 'Crosshairs';
export type ViewportLayout = '1x1' | '1x2' | '2x2' | 'MPR';

export interface PresignedUploadRequest {
  filename: string;
  contentType?: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}



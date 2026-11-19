export type SvgMode = 'text' | 'image';
export type SvgStyle = 'illustration' | 'icon' | 'logo' | 'line-art';
export type SvgAspect = '1:1' | '4:3' | '3:4';
export interface SvgSample {
  id: string;
  name: string;
  prompt: string;
  svg: string;
  category: string;
  style?: SvgStyle;
}
export interface SvgGenerationRequest {
  requestId: string;
  prompt: string;
  style: SvgStyle;
  aspect: SvgAspect;
}
export interface SvgGenerationResult {
  taskId: string;
  status: 'processing' | 'succeeded' | 'failed' | 'awaiting_credits';
  credits: number;
  requiredCredits?: number;
  svg?: string;
}
export interface SvgTrialResult {
  previewId: string;
  mode: SvgMode;
  status: 'processing' | 'succeeded' | 'failed';
  locked: true;
  credits: number;
  previewUrl?: string;
  stats?: {
    width: number;
    height: number;
    paths: number;
    bytes: number;
    colors: string[];
  };
}
export interface SvgAvailability {
  ready: boolean;
  imageEdit: boolean;
  reservedCredits: number;
  balance: number | null;
  paid: boolean;
  canPreview: boolean;
  preview: SvgTrialResult | null;
}
export interface SvgGeneratorCopy {
  [key: string]: string;
}

export type ScreenName =
  | 'camera_select'
  | 'idle'
  | 'countdown_preview'
  | 'review'
  | 'photo_grid';

export interface Shot {
  blob: Blob;
  objectUrl: string;
}

export interface CameraInfo {
  platform: string;
  gphoto2Available: boolean;
  cameraMode: 'webcam' | 'tethered';
}

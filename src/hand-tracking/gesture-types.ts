export interface HandData {
  landmarks: any[][];
  worldLandmarks: any[][];
  handedness: any[][];
}

export interface GestureState {
  pinchStrength: number;      // 0-1, for zoom control
  palmRotation: number;       // -1 to 1, for horizontal rotation
  palmTilt: number;          // -1 to 1, for vertical rotation
  isHandVisible: boolean;
  handCount: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}
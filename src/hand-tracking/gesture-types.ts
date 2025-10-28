export interface HandData {
  landmarks: any[][];
  worldLandmarks: any[][];
  handedness: any[][];
}

export type GestureMode = 'Idle' | 'Zoom' | 'Orbit';

export interface GestureSnapshot {
  t: number;            // timestamp in ms
  mode: GestureMode;
  pinch: number;        // 0..1 (filtered, normalized)
  pinchDelta: number;   // per-frame delta (filtered & clamped)
  yaw: number;          // radians (delta from neutral)
  pitch: number;        // radians (delta from neutral)
  roll: number;         // radians (optional)
  hands: number;        // 0..2
  quality: number;      // 0..1 confidence
}

export type FingerGesture = 'open_palm' | 'closed_fist' | 'one_finger' | 'two_fingers' | 'unknown';

export interface FingerGestureState {
  gesture: FingerGesture;
  fingerCount: number;
  confidence: number;
  isHandVisible: boolean;
}

export interface GestureStateReader {
  read(): GestureSnapshot;
}

export interface CalibrationData {
  neutralYaw: number;
  neutralPitch: number;
  neutralRoll: number;
  handBaseline: number;  // intrinsic hand scale (wrist to index MCP distance)
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandFrame {
  wrist: NormalizedLandmark;       // 0
  thumbTip: NormalizedLandmark;    // 4
  indexMCP: NormalizedLandmark;    // 5
  indexTip: NormalizedLandmark;    // 8
  middleMCP: NormalizedLandmark;   // 9
  pinkyMCP: NormalizedLandmark;    // 17
}
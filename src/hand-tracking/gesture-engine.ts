import { 
  GestureSnapshot, 
  GestureStateReader, 
  GestureMode, 
  CalibrationData, 
  HandFrame, 
  NormalizedLandmark,
  FingerGestureState,
  FingerGesture
} from './gesture-types';
import { GestureFilter } from './filters/one-euro';
import { GestureRecognizer } from './gesture-recognizer';
import { eventBus } from '../voice/eventBus';

/**
 * State machine with hysteresis for gesture mode transitions
 */
class GestureStateMachine {
  private currentMode: GestureMode = 'Idle';
  private modeTimer: number = 0;
  private lastTransition: number = 0;

  // Hysteresis parameters (ms)
  private readonly ENTER_DELAY = 80;
  private readonly EXIT_DELAY = 120;
  private readonly MIN_MODE_DURATION = 100;

  update(
    pinch: number, 
    palmActive: boolean, 
    dt: number
  ): GestureMode {
    this.modeTimer += dt;
    const now = performance.now();

    // Prevent rapid mode switching
    if (now - this.lastTransition < this.MIN_MODE_DURATION) {
      return this.currentMode;
    }

    const newMode = this.determineMode(pinch, palmActive);
    
    if (newMode !== this.currentMode) {
      const requiredDelay = this.currentMode === 'Idle' ? this.ENTER_DELAY : this.EXIT_DELAY;
      
      if (this.modeTimer >= requiredDelay) {
        this.currentMode = newMode;
        this.modeTimer = 0;
        this.lastTransition = now;
      }
    } else {
      this.modeTimer = 0; // Reset timer when consistent
    }

    return this.currentMode;
  }

  private determineMode(pinch: number, palmActive: boolean): GestureMode {
    // Priority: Zoom > Orbit > Idle
    if (pinch > 0.4) return 'Zoom';  // Lowered threshold for easier pinch detection
    if (palmActive) return 'Orbit';
    return 'Idle';
  }

  reset(): void {
    this.currentMode = 'Idle';
    this.modeTimer = 0;
    this.lastTransition = 0;
  }
}

/**
 * Core gesture recognition engine with proper normalization and filtering
 */
export class GestureEngine implements GestureStateReader {
  private filter: GestureFilter;
  private stateMachine: GestureStateMachine;
  private calibration: CalibrationData;
  private lastSnapshot: GestureSnapshot;
  private previousValues: { pinch: number; yaw: number; pitch: number } | null = null;
  // Track fingertip lateral motion for one-finger slide control
  private lastIndexTipX: number | null = null;
  private lastTimestampMs: number | null = null;
  // Debounce for gesture-based voice toggling
  private lastVoiceToggleAt: number = 0;
  private readonly VOICE_TOGGLE_COOLDOWN_MS = 1200;
  
  // Finger gesture recognition (now the only system)
  private gestureRecognizer: GestureRecognizer;
  private lastFingerGesture: FingerGestureState;

  // Gesture thresholds
  private readonly PINCH_EXIT_THRESHOLD = 0.45;
  private readonly PALM_ACTIVE_THRESHOLD = 0.08;
  private readonly PALM_EXIT_THRESHOLD = 0.05;
  private readonly CONFIDENCE_THRESHOLD = 0.5;
  private readonly MAX_VELOCITY_CLAMP = 5.0; // radians/second

  constructor() {
    this.filter = new GestureFilter();
    this.stateMachine = new GestureStateMachine();
    this.calibration = {
      neutralYaw: 0,
      neutralPitch: 0,
      neutralRoll: 0,
      handBaseline: 0.1 // default baseline
    };
    
    this.gestureRecognizer = new GestureRecognizer();
    this.lastFingerGesture = {
      gesture: 'unknown',
      fingerCount: 0,
      confidence: 0,
      isHandVisible: false
    };
    
    this.lastSnapshot = this.createIdleSnapshot();
  }

  /**
   * Process new hand landmarks and update gesture state
   */
  ingest(landmarks: any[][], tMs: number): void {
    if (!landmarks || landmarks.length === 0) {
      this.lastSnapshot = this.createIdleSnapshot(tMs);
      this.lastFingerGesture = {
        gesture: 'unknown',
        fingerCount: 0,
        confidence: 0,
        isHandVisible: false
      };
      return;
    }

    // Process finger gestures (now the only system)
    this.lastFingerGesture = this.gestureRecognizer.recognizeFingerGestures(landmarks);
    this.processFingerGestures(landmarks, tMs);
  }

  /**
   * Process finger-based gestures
   */
  private processFingerGestures(landmarks: any[][], tMs: number): void {
    const fingerGesture = this.lastFingerGesture;
    
    // Map finger gestures to modes and values
    let mode: GestureMode = 'Idle';
    let pinchDelta = 0;
    let yaw = 0;
    let pitch = 0;
    
    // Lower confidence threshold for more responsive gestures
    if (fingerGesture.confidence > 0.5) {
      switch (fingerGesture.gesture) {
        case 'open_palm':
          mode = 'Zoom';
          pinchDelta = -0.8; // Zoom out
          break;
        case 'closed_fist':
          mode = 'Zoom';
          pinchDelta = 0.8; // Zoom in
          break;
        case 'one_finger': {
          // Slide-based rotation: use index fingertip horizontal velocity
          mode = 'Orbit';
          const primary = landmarks[0];
          const indexTip = primary && primary[8] ? primary[8] : null;
          if (indexTip) {
            const currentX = indexTip.x; // 0..1 image coords (right is larger)
            if (this.lastIndexTipX !== null && this.lastTimestampMs !== null) {
              const dt = Math.max(0.001, (tMs - this.lastTimestampMs) / 1000);
              const vx = (currentX - this.lastIndexTipX) / dt; // units per second
              // Gain to convert fingertip velocity to yaw rate (rad/s)
              const gain = 2.0;
              yaw = vx * gain; // right swipe -> positive yaw (rotate right)
              // Limit extreme spikes
              const MAX_YAW_RATE = Math.PI; // 180 deg/s cap
              yaw = Math.max(-MAX_YAW_RATE, Math.min(MAX_YAW_RATE, yaw));
            }
            this.lastIndexTipX = currentX;
            this.lastTimestampMs = tMs;
          }
          break;
        }
        case 'two_fingers': {
          // Peace sign toggles voice listen on/off with cooldown
          if (tMs - this.lastVoiceToggleAt > this.VOICE_TOGGLE_COOLDOWN_MS) {
            this.lastVoiceToggleAt = tMs;
            try {
              eventBus.emit('voiceListenToggle', {} as any);
            } catch {}
          }
          // Do not rotate camera on this gesture
          mode = 'Idle';
          yaw = 0;
          break;
        }
      }
    }

    // Reset fingertip tracker when not in one-finger mode to avoid stale deltas
    if (fingerGesture.gesture !== 'one_finger') {
      this.lastIndexTipX = null;
      this.lastTimestampMs = tMs;
    }

    this.lastSnapshot = {
      t: tMs,
      mode,
      pinch: fingerGesture.gesture === 'closed_fist' ? 0.9 : 0.1,
      pinchDelta,
      yaw,
      pitch,
      roll: 0,
      hands: landmarks.length,
      quality: fingerGesture.confidence
    };
  }


  /**
   * Read the latest gesture snapshot
   */
  read(): GestureSnapshot {
    return this.lastSnapshot;
  }

  /**
   * Calibrate neutral pose from current hand position
   */
  calibrateNeutral(landmarks: any[][]): boolean {
    if (!landmarks || landmarks.length === 0) return false;

    const handFrame = this.extractHandFrame(landmarks[0]);
    if (!handFrame) return false;

    const { yaw, pitch, roll } = this.calculatePalmOrientation(handFrame);
    const handBaseline = this.calculateHandBaseline(handFrame);

    this.calibration = {
      neutralYaw: yaw,
      neutralPitch: pitch,
      neutralRoll: roll,
      handBaseline: handBaseline
    };

    // Reset filters to start fresh
    this.filter.reset();
    this.stateMachine.reset();
    this.previousValues = null;

    console.log('Neutral pose calibrated:', this.calibration);
    return true;
  }

  /**
   * Get current calibration data
   */
  getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  /**
   * Set calibration data
   */
  setCalibration(calibration: CalibrationData): void {
    this.calibration = { ...calibration };
  }

  /**
   * Get last finger gesture state
   */
  getLastFingerGesture(): FingerGestureState {
    return this.lastFingerGesture;
  }

  private extractHandFrame(landmarks: NormalizedLandmark[]): HandFrame | null {
    if (!landmarks || landmarks.length < 21) return null;

    return {
      wrist: landmarks[0],
      thumbTip: landmarks[4],
      indexMCP: landmarks[5],
      indexTip: landmarks[8],
      middleMCP: landmarks[9],
      pinkyMCP: landmarks[17]
    };
  }

  private calculateHandBaseline(frame: HandFrame): number {
    // Distance from wrist to index MCP as intrinsic scale
    const dx = frame.indexMCP.x - frame.wrist.x;
    const dy = frame.indexMCP.y - frame.wrist.y;
    const dz = frame.indexMCP.z || 0;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateNormalizedPinch(frame: HandFrame, baseline: number): number {
    const dx = frame.thumbTip.x - frame.indexTip.x;
    const dy = frame.thumbTip.y - frame.indexTip.y;
    const dz = (frame.thumbTip.z || 0) - (frame.indexTip.z || 0);
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const normalizedDistance = distance / (baseline * 2.0); // k = 2.0 as suggested
    
    return Math.max(0, Math.min(1, 1 - normalizedDistance));
  }

  private calculateHandOpenness(landmarks: any[]): number {
    // Simple hand openness based on finger extension
    // Compare fingertip positions to knuckle positions
    
    // Index finger: tip (8) vs MCP (5)
    const indexExtended = landmarks[8].y < landmarks[5].y;
    
    // Middle finger: tip (12) vs MCP (9) 
    const middleExtended = landmarks[12].y < landmarks[9].y;
    
    // Ring finger: tip (16) vs MCP (13)
    const ringExtended = landmarks[16].y < landmarks[13].y;
    
    // Pinky finger: tip (20) vs MCP (17)
    const pinkyExtended = landmarks[20].y < landmarks[17].y;
    
    // Count extended fingers (0-4)
    const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended]
      .reduce((count, extended) => count + (extended ? 1 : 0), 0);
    
    // Return 0-1 scale (0 = closed fist, 1 = open palm)
    return extendedCount / 4;
  }

  private calculatePalmOrientation(frame: HandFrame): { yaw: number; pitch: number; roll: number } {
    // Estimate palm coordinate frame
    const { wrist, indexMCP, middleMCP, pinkyMCP } = frame;

    // Palm plane vectors
    const xPalm = this.normalize({
      x: pinkyMCP.x - indexMCP.x,
      y: pinkyMCP.y - indexMCP.y,
      z: (pinkyMCP.z || 0) - (indexMCP.z || 0)
    });

    const yPalm = this.normalize({
      x: middleMCP.x - wrist.x,
      y: middleMCP.y - wrist.y,
      z: (middleMCP.z || 0) - (wrist.z || 0)
    });

    // Cross product for palm normal
    const zPalm = this.normalize(this.cross(xPalm, yPalm));

    // Extract Euler angles (simplified)
    const yaw = Math.atan2(xPalm.y, xPalm.x);
    const pitch = Math.asin(-yPalm.z);
    const roll = Math.atan2(zPalm.y, zPalm.z);

    return { yaw, pitch, roll };
  }

  private calculateDelta(current: number, previous: number, t: number): number {
    if (!this.previousValues) return 0;
    const dt = Math.max(0.001, t - this.lastSnapshot.t / 1000);
    return (current - previous) / dt;
  }

  private clampVelocity(current: number, previous: number, t: number): number {
    if (!this.previousValues) return current;
    
    const dt = Math.max(0.001, t - this.lastSnapshot.t / 1000);
    const velocity = (current - previous) / dt;
    const clampedVelocity = Math.max(-this.MAX_VELOCITY_CLAMP, 
                                    Math.min(this.MAX_VELOCITY_CLAMP, velocity));
    
    return previous + clampedVelocity * dt;
  }

  private calculateQuality(landmarks: any[][]): number {
    // Simple heuristic: more hands and consistent detection = higher quality
    const handCount = landmarks.length;
    const baseQuality = Math.min(1.0, handCount * 0.7);
    
    // Could add more sophisticated quality metrics here
    return baseQuality;
  }

  private createIdleSnapshot(t: number = performance.now()): GestureSnapshot {
    return {
      t,
      mode: 'Idle',
      pinch: 0,
      pinchDelta: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
      hands: 0,
      quality: 0
    };
  }

  private normalize(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }

  private cross(
    a: { x: number; y: number; z: number }, 
    b: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
}

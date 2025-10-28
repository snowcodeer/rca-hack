import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as THREE from 'three';
import { GestureSnapshot, GestureMode } from './gesture-types';

/**
 * Proper OrbitControls integration - no more camera tug-of-war!
 * 
 * Key principle: Only use OrbitControls public API, never directly manipulate camera.
 * This eliminates conflicts with damping, constraints, and internal state.
 */
export class HandGestureControlsV2 {
  private controls: OrbitControls;
  private isEnabled: boolean = true;
  
  // Sensitivity parameters (exposed for calibration UI)
  public zoomGain: number = 0.8;     // Moderate zoom sensitivity
  public yawGain: number = 1.2;      // Horizontal rotation sensitivity  
  public pitchGain: number = 1.0;    // Vertical rotation sensitivity
  
  // Mouse activity detection (pause gestures during mouse use)
  private lastMouseActivity: number = 0;
  private readonly MOUSE_PRIORITY_WINDOW = 300; // ms
  
  // Rate limiting (prevent nausea-inducing speeds)
  private readonly MAX_ROTATION_PER_FRAME = Math.PI / 60; // 3 degrees max per frame
  private readonly MAX_ZOOM_SCALE_PER_FRAME = 1.08;       // 8% max zoom change per frame

  constructor(controls: OrbitControls) {
    this.controls = controls;
    this.setupMouseActivityDetection();
  }

  /**
   * Apply gesture deltas to OrbitControls using only its public API
   */
  apply(gesture: GestureSnapshot, dt: number): void {
    if (!this.isEnabled || !this.shouldAcceptGestures()) {
      return;
    }

    switch (gesture.mode) {
      case 'Zoom':
        this.applyZoom(gesture, dt);
        break;
      case 'Orbit':
        this.applyRotation(gesture, dt);
        break;
      case 'Idle':
      default:
        // No camera movement in idle mode
        break;
    }

    // Single update call - OrbitControls handles the rest
    this.controls.update();
  }

  /**
   * Apply zoom using OrbitControls distance property
   */
  private applyZoom(gesture: GestureSnapshot, dt: number): void {
    if (Math.abs(gesture.pinchDelta) < 0.01) return;

    // Scale zoom by dt for frame rate independence
    const scaledDelta = gesture.pinchDelta * this.zoomGain * dt;
    
    // Rate limit to prevent zoom explosions
    const clampedDelta = Math.max(-0.5, Math.min(0.5, scaledDelta));
    
    // Convert to multiplicative scale
    const scale = 1 + Math.abs(clampedDelta);
    const clampedScale = Math.min(this.MAX_ZOOM_SCALE_PER_FRAME, scale);

    // Apply zoom by modifying the distance directly
    const currentDistance = this.controls.getDistance();
    let newDistance;
    
    if (clampedDelta > 0) {
      // Zoom in - decrease distance
      newDistance = currentDistance / clampedScale;
    } else {
      // Zoom out - increase distance
      newDistance = currentDistance * clampedScale;
    }
    
    // Respect min/max distance constraints
    newDistance = Math.max(this.controls.minDistance, 
                          Math.min(this.controls.maxDistance, newDistance));
    
    // Set the new distance
    const direction = this.controls.object.position.clone().sub(this.controls.target).normalize();
    this.controls.object.position.copy(this.controls.target).add(direction.multiplyScalar(newDistance));
  }

  /**
   * Apply rotation using OrbitControls spherical coordinates
   */
  private applyRotation(gesture: GestureSnapshot, dt: number): void {
    // Scale by dt for frame rate independence
    const yawDelta = gesture.yaw * this.yawGain * dt * 10;
    const pitchDelta = gesture.pitch * this.pitchGain * dt * 10;

    // Rate limit rotation speed
    const clampedYaw = Math.max(-this.MAX_ROTATION_PER_FRAME,
                                Math.min(this.MAX_ROTATION_PER_FRAME, yawDelta));
    const clampedPitch = Math.max(-this.MAX_ROTATION_PER_FRAME,
                                  Math.min(this.MAX_ROTATION_PER_FRAME, pitchDelta));

    // Apply by manipulating spherical coordinates around target
    const object = this.controls.object as THREE.Camera;
    const target = this.controls.target;
    const offset = object.position.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    // Positive yawDelta -> rotate right; Positive pitchDelta -> tilt down
    spherical.theta += clampedYaw;
    spherical.phi += clampedPitch;

    // Clamp phi to avoid flipping over the poles
    const EPS = 0.01;
    spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, spherical.phi));

    // Recompute position and look at target
    const newPos = new THREE.Vector3().setFromSpherical(spherical);
    object.position.copy(target).add(newPos);
    object.lookAt(target);
  }

  /**
   * Check if we should accept gesture input (respect mouse priority)
   */
  private shouldAcceptGestures(): boolean {
    const now = performance.now();
    return now - this.lastMouseActivity > this.MOUSE_PRIORITY_WINDOW;
  }

  /**
   * Setup mouse activity detection to pause gestures during mouse use
   */
  private setupMouseActivityDetection(): void {
    const canvas = this.controls.domElement;
    
    const updateMouseActivity = () => {
      this.lastMouseActivity = performance.now();
    };

    // Track mouse interactions
    canvas.addEventListener('mousedown', updateMouseActivity);
    canvas.addEventListener('mousemove', updateMouseActivity);
    canvas.addEventListener('wheel', updateMouseActivity);
    canvas.addEventListener('contextmenu', updateMouseActivity);
    
    // Track touch interactions (mobile)
    canvas.addEventListener('touchstart', updateMouseActivity);
    canvas.addEventListener('touchmove', updateMouseActivity);
  }

  /**
   * Enable/disable gesture controls
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Update sensitivity parameters
   */
  setSensitivity(zoom?: number, yaw?: number, pitch?: number): void {
    if (zoom !== undefined) this.zoomGain = Math.max(0.1, Math.min(5.0, zoom));
    if (yaw !== undefined) this.yawGain = Math.max(0.1, Math.min(5.0, yaw));
    if (pitch !== undefined) this.pitchGain = Math.max(0.1, Math.min(5.0, pitch));
  }

  // Compatibility: GUI calls this in v1; keep a no-op to avoid errors
  setDeadZone(_value: number): void {
    // No dead zone in v2; filtering handled in engine
  }

  /**
   * Get current sensitivity settings
   */
  getSensitivity(): { zoom: number; yaw: number; pitch: number } {
    return {
      zoom: this.zoomGain,
      yaw: this.yawGain,
      pitch: this.pitchGain
    };
  }

  /**
   * Invert rotation directions (for user preference)
   */
  setInvertRotation(invertYaw: boolean, invertPitch: boolean): void {
    // Store inversion state for UI, apply in rotation calculations if needed
    // For now, users can adjust sensitivity to negative values
  }

  /**
   * Force immediate pause of gesture input (useful for debugging)
   */
  pauseGestures(durationMs: number = 1000): void {
    this.lastMouseActivity = performance.now() + durationMs - this.MOUSE_PRIORITY_WINDOW;
  }

  /**
   * Get debug information about control state
   */
  getDebugInfo(): any {
    const now = performance.now();
    return {
      enabled: this.isEnabled,
      acceptingGestures: this.shouldAcceptGestures(),
      lastMouseActivity: now - this.lastMouseActivity,
      sensitivity: this.getSensitivity(),
      orbitControlsState: {
        target: this.controls.target.toArray(),
        position: this.controls.object.position.toArray(),
        minDistance: this.controls.minDistance,
        maxDistance: this.controls.maxDistance,
        enableDamping: this.controls.enableDamping
      }
    };
  }
}

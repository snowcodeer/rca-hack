import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GestureState, FingerGestureState } from './gesture-types';
import * as THREE from 'three';

export class HandGestureControls {
  private camera: THREE.Camera;
  private orbitControls: OrbitControls;
  private isEnabled = true;
  
  // Finger gesture control parameters
  private zoomSensitivity = 2.5;      // Smooth zoom speed
  private rotationSensitivity = 1.2;  // Good rotation speed
  
  // Gesture timing and smoothing
  private gestureStartTime = 0;
  private minGestureDuration = 100; // ms - prevent accidental gestures
  private currentGesture: string = 'unknown';
  private gestureConfidenceThreshold = 0.7;

  constructor(camera: THREE.Camera, orbitControls: OrbitControls) {
    this.camera = camera;
    this.orbitControls = orbitControls;
  }

  update(gesture: GestureState): void {
    if (!this.isEnabled || !gesture.isHandVisible) {
      return;
    }

    // Only move camera if hand is actually moving
    if (gesture.isMoving) {
      this.handleZoom(gesture.pinchStrength);
      this.handleRotation(gesture.palmRotation, gesture.palmTilt);
    }
  }

  /**
   * Update camera controls based on finger gestures
   */
  updateWithFingerGestures(fingerGesture: FingerGestureState): void {
    if (!this.isEnabled || !fingerGesture.isHandVisible) {
      this.currentGesture = 'unknown';
      return;
    }

    // Only act on high-confidence gestures
    if (fingerGesture.confidence < this.gestureConfidenceThreshold) {
      return;
    }

    const now = performance.now();
    
    // Check if gesture changed
    if (this.currentGesture !== fingerGesture.gesture) {
      this.currentGesture = fingerGesture.gesture;
      this.gestureStartTime = now;
      return; // Wait for gesture to stabilize
    }

    // Ensure gesture has been stable for minimum duration
    if (now - this.gestureStartTime < this.minGestureDuration) {
      return;
    }

    // Execute gesture-based controls
    switch (fingerGesture.gesture) {
      case 'open_palm':
        this.executeZoomOut();
        break;
      case 'closed_fist':
        this.executeZoomIn();
        break;
      case 'one_finger':
        this.executeRotateLeft();
        break;
      case 'two_fingers':
        this.executeRotateRight();
        break;
    }
  }

  private handleZoom(pinchStrength: number): void {
    // Apply smoothing to zoom input
    const smoothedPinch = this.previousZoomInput * this.controlSmoothingFactor + 
                         pinchStrength * (1 - this.controlSmoothingFactor);
    this.previousZoomInput = smoothedPinch;
    
    // Clear dead zone - no zoom if below threshold
    if (smoothedPinch < 0.4) return;

    // Intuitive zoom: higher pinch strength = zoom in
    // Map 0.4-1.0 pinch range to zoom speed
    const normalizedPinch = (smoothedPinch - 0.4) / 0.6; // 0-1 range
    const zoomSpeed = normalizedPinch * normalizedPinch; // Quadratic for better control
    
    // Zoom in when pinching (negative delta = move camera closer)
    const zoomDelta = -zoomSpeed * this.zoomSensitivity * 0.02;
    
    // Get current distance from target
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.max(
      this.orbitControls.minDistance || 0.1,
      Math.min(this.orbitControls.maxDistance || 100, currentDistance + zoomDelta)
    );

    // Apply zoom by scaling camera position relative to target
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.orbitControls.target)
      .normalize();
    
    this.camera.position.copy(
      this.orbitControls.target.clone().add(direction.multiplyScalar(newDistance))
    );
    
    // Update orbit controls
    this.orbitControls.update();
  }

  private handleRotation(palmRotation: number, palmTilt: number): void {
    // Apply dead zone
    const rawRotationX = Math.abs(palmRotation) > this.deadZone ? palmRotation : 0;
    const rawRotationY = Math.abs(palmTilt) > this.deadZone ? palmTilt : 0;

    // Apply smoothing to rotation inputs
    const rotationX = this.previousRotationX * this.controlSmoothingFactor + 
                     rawRotationX * (1 - this.controlSmoothingFactor);
    const rotationY = this.previousRotationY * this.controlSmoothingFactor + 
                     rawRotationY * (1 - this.controlSmoothingFactor);
    
    this.previousRotationX = rotationX;
    this.previousRotationY = rotationY;

    if (Math.abs(rotationX) < 0.05 && Math.abs(rotationY) < 0.05) return;

    // Improved rotation speed with exponential curve for better control
    const rotationSpeed = this.rotationSensitivity * 0.02;
    
    // Get current spherical coordinates relative to target
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    // Apply rotation with proper direction mapping
    // Negative rotationX for intuitive left/right movement
    spherical.theta -= rotationX * rotationSpeed;
    // Positive rotationY for intuitive up/down movement  
    spherical.phi += rotationY * rotationSpeed;

    // Clamp phi to prevent camera flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Update camera position
    const newPosition = new THREE.Vector3().setFromSpherical(spherical);
    this.camera.position.copy(this.orbitControls.target.clone().add(newPosition));
    this.camera.lookAt(this.orbitControls.target);
    
    // Update orbit controls
    this.orbitControls.update();
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log('Hand gesture controls:', enabled ? 'enabled' : 'disabled');
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Execute zoom out (open palm)
   */
  private executeZoomOut(): void {
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const zoomOutDelta = this.zoomSensitivity * 0.05;
    const newDistance = Math.min(
      this.orbitControls.maxDistance || 100,
      currentDistance + zoomOutDelta
    );

    this.updateCameraDistance(newDistance);
  }

  /**
   * Execute zoom in (closed fist)
   */
  private executeZoomIn(): void {
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const zoomInDelta = this.zoomSensitivity * 0.05;
    const newDistance = Math.max(
      this.orbitControls.minDistance || 0.1,
      currentDistance - zoomInDelta
    );

    this.updateCameraDistance(newDistance);
  }

  /**
   * Execute rotate left (one finger)
   */
  private executeRotateLeft(): void {
    const rotationSpeed = this.rotationSensitivity * 0.03;
    this.rotateCamera(-rotationSpeed, 0);
  }

  /**
   * Execute rotate right (two fingers)
   */
  private executeRotateRight(): void {
    const rotationSpeed = this.rotationSensitivity * 0.03;
    this.rotateCamera(rotationSpeed, 0);
  }

  /**
   * Update camera distance from target
   */
  private updateCameraDistance(newDistance: number): void {
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.orbitControls.target)
      .normalize();
    
    this.camera.position.copy(
      this.orbitControls.target.clone().add(direction.multiplyScalar(newDistance))
    );
    
    this.orbitControls.update();
  }

  /**
   * Rotate camera around target
   */
  private rotateCamera(deltaTheta: number, deltaPhi: number): void {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta += deltaTheta;
    spherical.phi += deltaPhi;

    // Clamp phi to prevent camera flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    const newPosition = new THREE.Vector3().setFromSpherical(spherical);
    this.camera.position.copy(this.orbitControls.target.clone().add(newPosition));
    this.camera.lookAt(this.orbitControls.target);
    
    this.orbitControls.update();
  }

  setSensitivity(zoom?: number, rotation?: number): void {
    if (zoom !== undefined) this.zoomSensitivity = zoom;
    if (rotation !== undefined) this.rotationSensitivity = rotation;
    console.log(`Hand control sensitivity - Zoom: ${this.zoomSensitivity}, Rotation: ${this.rotationSensitivity}`);
  }

  setConfidenceThreshold(threshold: number): void {
    this.gestureConfidenceThreshold = Math.max(0, Math.min(1, threshold));
    console.log(`Gesture confidence threshold: ${this.gestureConfidenceThreshold}`);
  }

  // Debug method to get current control state
  getDebugInfo(): any {
    return {
      enabled: this.isEnabled,
      zoomSensitivity: this.zoomSensitivity,
      rotationSensitivity: this.rotationSensitivity,
      currentGesture: this.currentGesture,
      gestureConfidenceThreshold: this.gestureConfidenceThreshold,
      cameraDistance: this.camera.position.distanceTo(this.orbitControls.target)
    };
  }
}